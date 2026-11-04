import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { relationId } from '../shared/bia-access';
import { roPulseWaves,roPulseOpen,roPulseHref,roPulseSummary,roCommunityStage, type PulseCommunity } from '../shared/ro-pulse';
import type { AgendaAlertItem } from './agenda-alerts';

type Actor={userId:string;memberId:string|null;admin:boolean};
export type RoPulseDeps={db:any;communities:()=>Promise<any[]>;members:()=>Promise<any[]>;meeting:(id:string)=>Promise<any>;send:(input:{email:string;nome:string;meeting:any;url:string})=>Promise<{ok:boolean;skipped?:boolean}>};
const fault=(message:string,status=400)=>Object.assign(new Error(message),{status});
export class RoPulse {
 constructor(readonly deps:RoPulseDeps){}
 get db(){return this.deps.db;}
 async ready(){return !!(await this.db.execute(sql`SELECT to_regclass('ro_pulse_deliveries') IS NOT NULL AS ready`)).rows[0]?.ready;}
 async available(){if(!await this.ready())throw fault('O Pulso das ROs aguarda a atualização do banco.',503);}
 canManage(meeting:any,actor:Actor){return actor.admin||String(meeting.organizador_user_id||'')===actor.userId||!!actor.memberId&&String(meeting.organizador_membro_id||'')===actor.memberId;}
 async catalog(meeting:any){const communities=await this.deps.communities();const origin=communities.find(c=>String(c.id)===String(meeting.community_id));if(!origin)throw fault('Comunidade de origem indisponível.',409);return communities.map(c=>({id:String(c.id),nome:c.nome||c.sigla||'Comunidade BUILT',pais:c.pais,territorio:c.territorio,stage:roCommunityStage(origin,c)})).filter(c=>!!c.stage);}
 async read(meeting:any,actor:Actor){
  if(!this.canManage(meeting,actor))throw fault('Somente o criador da RO ou um administrador pode controlar este Pulso.',403);
  await this.available();
  const flow=(await this.db.execute(sql`SELECT * FROM ro_pulse_flows WHERE meeting_id=${meeting.id}`)).rows[0]||null;
  const waves=flow?(await this.db.execute(sql`SELECT * FROM ro_pulse_waves WHERE flow_id=${flow.id} ORDER BY ordem`)).rows:[];
  const states=flow?(await this.db.execute(sql`SELECT d.state,count(*)::int AS total FROM ro_pulse_deliveries d JOIN ro_pulse_waves w ON w.id=d.wave_id WHERE w.flow_id=${flow.id} AND d.channel='email' GROUP BY d.state`)).rows:[];
  return {flow,waves,email_states:states,communities:await this.catalog(meeting),can_start:roPulseOpen(meeting)};
 }
 async start(meeting:any,actor:Actor,raw:unknown,now=new Date()){
  if(!this.canManage(meeting,actor))throw fault('Sem permissão para iniciar este Pulso.',403);
  await this.available();if(!roPulseOpen(meeting,now))throw fault('Somente ROs agendadas e futuras podem iniciar o Pulso.',409);
  const catalog=await this.catalog(meeting);
  let plan:ReturnType<typeof roPulseWaves>;try{plan=roPulseWaves(String(meeting.community_id),catalog,raw);}catch(e:any){throw fault(e.message);}
  const {config,waves}=plan;
  await this.db.transaction(async(tx:any)=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'ro-pulse:'+meeting.id}))`);
   const found=(await tx.execute(sql`SELECT id FROM ro_pulse_flows WHERE meeting_id=${meeting.id}`)).rows[0];if(found)throw fault('Esta RO já tem um Pulso. Use os controles existentes.',409);
   const flow=(await tx.execute(sql`INSERT INTO ro_pulse_flows(meeting_id,creator_user_id,creator_member_id,intervalo_horas,config,next_at) VALUES(${meeting.id},${actor.userId},${actor.memberId},${config.intervalo_horas},${JSON.stringify(config)}::jsonb,${now.toISOString()}) RETURNING id`)).rows[0];
   for(const [index,wave] of waves.entries())await tx.execute(sql`INSERT INTO ro_pulse_waves(flow_id,ordem,stage,community_ids) VALUES(${flow.id},${index+1},${wave.stage},${JSON.stringify(wave.communities)}::jsonb)`);
  });
  return this.read(meeting,actor);
 }
 async action(meeting:any,actor:Actor,action:string,now=new Date()){
  if(!this.canManage(meeting,actor))throw fault('Sem permissão para controlar este Pulso.',403);
  if(!['pausar','retomar','avancar','encerrar'].includes(action))throw fault('Ação do Pulso inválida.');
  await this.available();
  await this.db.transaction(async(tx:any)=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'ro-pulse:'+meeting.id}))`);
   const flow=(await tx.execute(sql`SELECT * FROM ro_pulse_flows WHERE meeting_id=${meeting.id} FOR UPDATE`)).rows[0];
   if(!flow)throw fault('Pulso não encontrado.',404);if(flow.status==='concluido')throw fault('O Pulso já foi encerrado.',409);
   if(['retomar','avancar'].includes(action)&&!roPulseOpen(meeting,now))throw fault('Esta RO não está mais disponível para divulgação.',409);
   const status=action==='pausar'?'pausado':action==='encerrar'?'concluido':'ativo';
   const next=action==='avancar'?now.toISOString():action==='retomar'?new Date(now.getTime()+flow.intervalo_horas*3600000).toISOString():null;
   await tx.execute(sql`UPDATE ro_pulse_flows SET status=${status},reason=${action==='pausar'?'manual':action==='encerrar'?'encerrado_pelo_criador':null},next_at=${next},updated_at=now() WHERE id=${flow.id}`);
   if(action==='encerrar')await tx.execute(sql`UPDATE ro_pulse_waves SET status='cancelada',updated_at=now() WHERE flow_id=${flow.id} AND status IN ('pendente','processando')`);
  });return this.read(meeting,actor);
 }
 async creatorActive(flow:any,meeting:any){
  const accounts=(await this.db.execute(sql`SELECT id,role,ativo,membro_directus_id FROM users WHERE id=${flow.creator_user_id} OR (${flow.creator_member_id}::text IS NOT NULL AND membro_directus_id=${flow.creator_member_id})`)).rows;
  return accounts.some((u:any)=>u.ativo&&this.canManage(meeting,{userId:String(u.id),memberId:u.membro_directus_id||null,admin:String(u.id)===flow.creator_user_id&&['admin','manager','superadmin','master'].includes(u.role)}));
 }
 async stopInvalid(flow:any,meeting:any,now:Date){
  if(!meeting||!roPulseOpen(meeting,now)){
   await this.db.execute(sql`UPDATE ro_pulse_flows SET status='concluido',next_at=NULL,reason='ro_indisponivel',updated_at=now() WHERE id=${flow.id}`);
   await this.db.execute(sql`UPDATE ro_pulse_waves SET status='cancelada',updated_at=now() WHERE flow_id=${flow.id} AND status IN ('pendente','processando')`);return true;
  }
  if(!await this.creatorActive(flow,meeting)){
   await this.db.execute(sql`UPDATE ro_pulse_flows SET status='pausado',next_at=NULL,reason='criador_sem_acesso',updated_at=now() WHERE id=${flow.id}`);return true;
  }return false;
 }
 async tick(now=new Date()){
  if(!await this.ready())return;
  await this.db.execute(sql`UPDATE ro_pulse_deliveries SET state='incerto',updated_at=now() WHERE state='enviando' AND updated_at<${new Date(now.getTime()-300000).toISOString()}`);
  await this.db.execute(sql`WITH recovered AS (UPDATE ro_pulse_waves SET status='pendente',lease_id=NULL,updated_at=now() WHERE status='processando' AND updated_at<${new Date(now.getTime()-300000).toISOString()} RETURNING flow_id) UPDATE ro_pulse_flows SET next_at=${now.toISOString()} WHERE id IN (SELECT flow_id FROM recovered) AND status='ativo'`);
  const flows=(await this.db.execute(sql`SELECT * FROM ro_pulse_flows WHERE status='ativo' AND next_at<=${now.toISOString()} ORDER BY next_at LIMIT 20`)).rows;
  for(const flow of flows){
   const meeting=await this.deps.meeting(String(flow.meeting_id));if(await this.stopInvalid(flow,meeting,now))continue;
   const wave=await this.db.transaction(async(tx:any)=>{
    const owned=(await tx.execute(sql`UPDATE ro_pulse_flows SET next_at=NULL WHERE id=${flow.id} AND status='ativo' AND next_at<=${now.toISOString()} RETURNING id`)).rows[0];if(!owned)return null;
    return (await tx.execute(sql`UPDATE ro_pulse_waves SET status='processando',lease_id=${randomUUID()},updated_at=${now.toISOString()} WHERE id=(SELECT id FROM ro_pulse_waves WHERE flow_id=${flow.id} AND status IN ('pendente','processando') ORDER BY ordem LIMIT 1) AND status='pendente' RETURNING *`)).rows[0];
   });if(!wave)continue;
   try {await this.deliver(flow,wave,meeting,now);} catch {
    const reset=(await this.db.execute(sql`UPDATE ro_pulse_waves SET status='pendente',lease_id=NULL,updated_at=now() WHERE id=${wave.id} AND status='processando' AND lease_id=${wave.lease_id} RETURNING id`)).rows[0];
    if(reset)await this.db.execute(sql`UPDATE ro_pulse_flows SET next_at=${new Date(now.getTime()+60000).toISOString()},reason='consulta_indisponivel',updated_at=now() WHERE id=${flow.id} AND status='ativo'`);
   }
  }
 }
 async deliver(flow:any,wave:any,meeting:any,now:Date){
  const started=Date.now();
  const [communities,members,userRows]=await Promise.all([this.deps.communities(),this.deps.members(),this.db.execute(sql`SELECT id,membro_directus_id FROM users WHERE ativo=true AND membro_directus_id IS NOT NULL`)]);
  const selected=new Set<string>(wave.community_ids.map(String)),targets=new Set<string>();
  for(const id of selected){const c=communities.find(c=>String(c.id)===id);if(!c)throw new Error('Comunidade indisponível');
   const ally=relationId(c.aliado);if(ally)targets.add(ally);
   for(const r of Array.isArray(c.membros)?c.membros:[]){const id=relationId(r.cadastro_geral_id)||relationId(r);if(id)targets.add(id);}
  }
  for(const member of members){if(!targets.has(String(member.id))||![true,1].includes(member.em_membros_built))continue;
   const current=(await this.db.execute(sql`SELECT f.status FROM ro_pulse_flows f JOIN ro_pulse_waves w ON w.flow_id=f.id WHERE f.id=${flow.id} AND w.id=${wave.id} AND w.lease_id=${wave.lease_id} AND w.status='processando'`)).rows[0];
   const liveMeeting=await this.deps.meeting(String(meeting.id));
   if(current?.status!=='ativo'||await this.stopInvalid(flow,liveMeeting,new Date(now.getTime()+Date.now()-started)))return;
   const user=userRows.rows.find((u:any)=>String(u.membro_directus_id)===String(member.id));
   if(user)await this.db.execute(sql`INSERT INTO ro_pulse_deliveries(wave_id,meeting_id,user_id,member_id,channel,state) VALUES(${wave.id},${meeting.id},${user.id},${String(member.id)},'interna','enviado') ON CONFLICT DO NOTHING`);
   if(!member.email)continue;
   await this.db.execute(sql`INSERT INTO ro_pulse_deliveries(wave_id,meeting_id,user_id,member_id,channel,state) VALUES(${wave.id},${meeting.id},${user?.id||null},${String(member.id)},'email','pendente') ON CONFLICT DO NOTHING`);
   const reserved=(await this.db.execute(sql`UPDATE ro_pulse_deliveries SET state='enviando',updated_at=now() WHERE wave_id=${wave.id} AND member_id=${String(member.id)} AND channel='email' AND state='pendente' RETURNING id`)).rows[0];if(!reserved)continue;
   let state='incerto';
   try {const sent=await this.deps.send({email:String(member.email),nome:member.Nome_de_usuario||member.nome||'Membro BUILT',meeting:roPulseSummary(liveMeeting),url:roPulseHref(String(meeting.id))});state=sent.skipped?'suprimido':sent.ok?'enviado':'incerto';}catch{/* SMTP ambiguity must never trigger a blind resend. */}
   await this.db.execute(sql`UPDATE ro_pulse_deliveries SET state=${state},updated_at=now() WHERE id=${reserved.id}`);
  }
  const completed=(await this.db.execute(sql`UPDATE ro_pulse_waves SET status='executada',executed_at=${now.toISOString()},updated_at=now() WHERE id=${wave.id} AND status='processando' AND lease_id=${wave.lease_id} RETURNING id`)).rows[0];if(!completed)return;
  const next=(await this.db.execute(sql`SELECT id FROM ro_pulse_waves WHERE flow_id=${flow.id} AND status='pendente' ORDER BY ordem LIMIT 1`)).rows[0];
  await this.db.execute(sql`UPDATE ro_pulse_flows SET status=${next?'ativo':'concluido'},next_at=${next?new Date(now.getTime()+flow.intervalo_horas*3600000).toISOString():null},reason=NULL,updated_at=now() WHERE id=${flow.id} AND status='ativo'`);
 }
 async invitation(meeting:any,actor:Actor){
  await this.available();
  const sent=(await this.db.execute(sql`SELECT id FROM ro_pulse_deliveries WHERE meeting_id=${meeting.id} AND ((user_id=${actor.userId}) OR (${actor.memberId}::text IS NOT NULL AND member_id=${actor.memberId})) AND state IN ('enviado','suprimido') LIMIT 1`)).rows[0];
  if(!sent&&!this.canManage(meeting,actor))throw fault('Este aviso não foi destinado a você.',403);
  return roPulseSummary(meeting);
 }
 async alerts(userId:string,memberId:string|null):Promise<AgendaAlertItem[]>{
  if(!await this.ready())return [];
  const rows=(await this.db.execute(sql`SELECT d.id,d.meeting_id,d.created_at,m.titulo,m.codigo FROM ro_pulse_deliveries d JOIN opportunity_meetings m ON m.id=d.meeting_id WHERE d.channel='interna' AND d.state='enviado' AND (d.user_id=${userId} OR (${memberId}::text IS NOT NULL AND d.member_id=${memberId})) ORDER BY d.created_at DESC LIMIT 100`)).rows;
  return rows.map((r:any)=>({id:`ro-pulso:${r.id}`,source_type:'ro_pulse',source_id:r.id,group:'atualizacoes',category:'ro',title:`RO · ${r.titulo}`,description:r.codigo,created_at:r.created_at,priority:'baixa',status:'enviado',action_required:false,active:true,href:roPulseHref(String(r.meeting_id)),actions:['consultar']}));
 }
}
