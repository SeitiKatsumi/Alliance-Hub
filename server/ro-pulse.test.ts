import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import express from 'express';
import {RoPulse} from './ro-pulse';
import {registerRoPulseRoutes} from './ro-pulse-routes';

const meetingId='11111111-1111-4111-8111-111111111111',owner={userId:'owner',memberId:'owner-member',admin:false},other={userId:'other',memberId:'other-member',admin:false};
const config={intervalo_horas:6,comunidades:{regional:['r'],nacional:['n'],global:['g']}};
async function fixture(){
 const pg=new PGlite(),db=drizzle(pg);
 await pg.exec(`CREATE TABLE opportunity_meetings(id uuid PRIMARY KEY,codigo text,titulo text,data date,hora text,timezone text,status text,community_id text,organizador_user_id text,organizador_membro_id text,ata text,link text);
 CREATE TABLE users(id text PRIMARY KEY,role text,ativo boolean,membro_directus_id text);
 INSERT INTO users VALUES('owner','user',true,'owner-member'),('receiver','membro',true,'m'),('other','membro',true,'other-member');
 INSERT INTO opportunity_meetings VALUES('${meetingId}','RO-TESTE','Encontro de teste','2032-12-31','10:00','America/Sao_Paulo','agendada','o','owner','owner-member','Ata privada','link privado');`);
 const migration=readFileSync('migrations/20261104_ro_pulses.sql','utf8');await pg.exec(migration);await pg.exec(migration);
 const communities=[{id:'o',nome:'Origem',pais:'Brasil',territorio:'Sudeste',membros:[{cadastro_geral_id:'m'},{cadastro_geral_id:'m'},'inativo']},{id:'r',nome:'Regional',pais:'Brasil',territorio:'Sudeste',membros:['m']},{id:'n',nome:'Nacional',pais:'Brasil',territorio:'Sul',membros:['m']},{id:'g',nome:'Global',pais:'Japão',territorio:'Aichi',membros:['m']}];
 const mails:any[]=[];let unavailable=false,failSmtp=false;
 const service=new RoPulse({db,communities:async()=>{if(unavailable)throw Error('Fonte indisponível');return communities;},members:async()=>[{id:'m',nome:'Pessoa de teste',email:'test@example.invalid',em_membros_built:true},{id:'inativo',email:'inactive@example.invalid',em_membros_built:false}],meeting:async(id)=>(await pg.query<any>('SELECT * FROM opportunity_meetings WHERE id::text=$1 OR codigo=$1',[id])).rows[0],send:async input=>{mails.push(input);if(failSmtp)throw Error('Timeout de teste');return {ok:true};}});
 return {pg,service,mails,meeting:await service.deps.meeting(meetingId),unavailable:(v:boolean)=>unavailable=v,failSmtp:(v:boolean)=>failSmtp=v};
}
test('ondas persistentes: intervalo escolhido, sem repetição, isolamento e recuperação sem rajada',async()=>{
 const f=await fixture(),now=new Date('2031-01-01T12:00:00Z');
 try{
  await assert.rejects(()=>f.service.start(f.meeting,other,config,now),/permissão/);
  await assert.rejects(()=>f.service.start(f.meeting,owner,{...config,comunidades:{...config.comunidades,global:['r']}},now),/alcance/);
  await f.service.start(f.meeting,owner,config,now);
  await assert.rejects(()=>f.service.start(f.meeting,owner,config,now),/já tem/);
  await Promise.all([f.service.tick(now),f.service.tick(now)]);assert.equal(f.mails.length,1);
  await f.service.tick(new Date(now.getTime()+3600000));assert.equal(f.mails.length,1);
  assert.equal((await f.service.alerts('receiver','m')).length,1);
  assert.equal((await f.service.alerts('other','other-member')).length,0);
  const invitation=await f.service.invitation(f.meeting,{userId:'receiver',memberId:'m',admin:false});
  assert.ok(!('ata' in invitation));assert.ok(!('link' in invitation));
  await assert.rejects(()=>f.service.invitation(f.meeting,other),/destinado/);
  await f.service.action(f.meeting,owner,'pausar',now);await f.service.tick(new Date('2031-01-03T12:00:00Z'));assert.equal(f.mails.length,1);
  await f.service.action(f.meeting,owner,'retomar',now);
  const late=new Date('2031-01-05T12:00:00Z');await f.service.tick(late);assert.equal(f.mails.length,2);
  await f.service.tick(late);assert.equal(f.mails.length,2,'atraso não executa todas as ondas acumuladas');
  const read=await f.service.read(f.meeting,owner);assert.equal(read.flow.intervalo_horas,6);
  assert.equal(new Date(read.flow.next_at).toISOString(),'2031-01-05T18:00:00.000Z');
  assert.deepEqual(read.waves.map((w:any)=>w.stage),['origem','regional','nacional','global']);
  f.unavailable(true);await f.service.tick(new Date('2031-01-05T18:00:00Z'));assert.equal(f.mails.length,2);
  f.unavailable(false);f.failSmtp(true);await f.service.tick(new Date('2031-01-05T18:02:00Z'));assert.equal(f.mails.length,3);
  await f.service.tick(new Date('2031-01-05T18:03:00Z'));assert.equal(f.mails.length,3,'SMTP incerto não é reenviado');
  assert.ok((await f.service.read(f.meeting,owner)).email_states.some((r:any)=>r.state==='incerto'));
  await f.service.action(f.meeting,owner,'encerrar',late);await f.service.tick(new Date('2031-01-08'));assert.equal(f.mails.length,3);
  assert.equal((await f.pg.query<any>('SELECT count(*)::int AS n FROM ro_pulse_deliveries WHERE channel=\'interna\'')).rows[0].n,3);
 }finally{await f.pg.close();}
});
test('cancelamento, data passada e criador desativado interrompem o envio',async()=>{
 for(const change of ["status='cancelada'","data='2030-01-01'",'disabled']){
  const f=await fixture(),now=new Date('2031-01-01T12:00:00Z');
  try{await f.service.start(f.meeting,owner,config,now);
   if(change==='disabled')await f.pg.exec("UPDATE users SET ativo=false WHERE id='owner'");else await f.pg.exec(`UPDATE opportunity_meetings SET ${change}`);
   await f.service.tick(now);assert.equal(f.mails.length,0);
   const flow=(await f.service.read(f.meeting,owner)).flow;assert.equal(flow.status,change==='disabled'?'pausado':'concluido');
  }finally{await f.pg.close();}
 }
});
test('API real exige identidade, criador e resumo autorizado; GET nunca inicia envio',async()=>{
 const f=await fixture(),previous=process.env.BUILT_ISOLATED_STAGE;process.env.BUILT_ISOLATED_STAGE='1';
 const app=express();app.use(express.json());
 const timer=registerRoPulseRoutes(app,f.service,req=>{if(!req.headers['x-test-actor'])throw Object.assign(Error('Não autenticado'),{status:401});return req.headers['x-test-actor']==='owner'?owner:other;});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}/api/reunioes-oportunidades/${meetingId}/pulso`;
 try{
  assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base,{headers:{'x-test-actor':'other'}})).status,403);
  assert.equal((await fetch(base,{headers:{'x-test-actor':'owner'}})).status,200);assert.equal(f.mails.length,0);
  assert.equal((await fetch(base,{method:'POST',headers:{'x-test-actor':'owner','Content-Type':'application/json'},body:JSON.stringify({...config,intervalo_horas:0})})).status,400);
  assert.equal((await fetch(base,{method:'POST',headers:{'x-test-actor':'owner','Content-Type':'application/json'},body:JSON.stringify(config)})).status,201);
  assert.equal(f.mails.length,0,'POST configura a fila, não usa SMTP durante a requisição');
  assert.equal((await fetch(base+'/convite',{headers:{'x-test-actor':'other'}})).status,403);
 }finally{clearInterval(timer);await new Promise<void>(r=>server.close(()=>r()));await f.pg.close();if(previous===undefined)delete process.env.BUILT_ISOLATED_STAGE;else process.env.BUILT_ISOLATED_STAGE=previous;}
});
