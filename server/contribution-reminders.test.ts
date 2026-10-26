import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {ContributionBilling} from './contribution-billing';
import {contributionReminderPlan,contributionReminderSchema,defaultContributionReminders,reminderEntryEligible} from '../shared/contribution-reminders';
const settings={...defaultContributionReminders,enabled:true};
test('prazos de calendário, mês curto, criação dentro da janela e escolha de canais',()=>{
 assert.deepEqual(contributionReminderPlan('2031-03-31','2031-01-01',settings).map(x=>x.date),['2031-02-28','2031-03-24','2031-03-30']);
 assert.equal(contributionReminderPlan('2032-03-31','2032-01-01',settings)[0].date,'2032-02-29');
 assert.deepEqual(contributionReminderPlan('2031-11-15','2031-10-26',settings),[{kind:'initial',date:'2031-10-26'},{kind:'week',date:'2031-11-08'},{kind:'day',date:'2031-11-14'}]);
 assert.equal(contributionReminderPlan('2031-11-15','2031-11-14',settings).length,1);
 assert.deepEqual(contributionReminderPlan('2031-11-15','2031-10-26',defaultContributionReminders),[]);
 assert.equal(contributionReminderSchema.safeParse({enabled:true,month:false,week:false,day:false}).success,false);
 for(const patch of [{status:'pago'},{status:'parcial'},{natureza:'nao_caixa'},{data_vencimento:'2031-02-31'},{tipo:'saida'}])assert.equal(reminderEntryEligible({tipo:'entrada',valor:10,status:'pendente',favorecido_id:'payer',data_vencimento:'2031-11-15',...patch}),false);
});
test('entregas persistentes: imediato, sem duplicatas, próximos prazos, isolamento e pagamento',async()=>{
 const pg=new PGlite(),db=drizzle(pg);
 await pg.exec(`CREATE TABLE bia_contribution_charges(flow_id text,environment text,payment_state text); CREATE TABLE agenda_tarefas(id uuid PRIMARY KEY,user_id text,membro_id text,titulo text,descricao text,data date,status text,prioridade text,contexto_tipo text,contexto_id text,origem_tarefa_id text,atualizado_em timestamp default now());`);
 const migration=readFileSync('migrations/20261029_contribution_reminders.sql','utf8');await pg.exec(migration);await pg.exec(migration);
 const entry:any={id:'flow',tipo:'entrada',valor:10,status:'pendente',favorecido_id:'payer',data_vencimento:'2031-11-15'};let sends=0,fail=false;
 const billing=new ContributionBilling({db,lock:async(_id,fn)=>db.transaction(tx=>fn(tx,{})),entries:async id=>id==='bia'?[entry]:[],bia:async()=>({situacao:'em_execucao'}),member:async()=>({nome:'Teste',email:'fake@example.invalid'}),userForMember:async()=> 'user',sendNotice:async input=>{assert.ok(input.details.agendaTaskId);sends++;if(fail)throw Error('timeout');return{ok:true};},updateFlow:async()=>{}});
 const service=billing.reminders,now=new Date('2031-10-26T15:00:00Z');
 try{
  await assert.rejects(()=>service.save('other','flow',settings,'user',now),/encontrado/);
  await assert.rejects(()=>service.read('bia','flow',false,'other'),/restritos/);
  await service.save('bia','flow',settings,'user',now);await service.save('bia','flow',settings,'user',now);await service.tick(now);assert.equal(sends,1);
  assert.equal((await service.alerts('user','payer')).length,1);assert.equal((await service.alerts('other','payer')).length,0);
  assert.equal((await service.read('bia','flow',true,null)).settings.enabled,true);
  await service.tick(new Date('2031-11-08T15:00:00Z'));assert.equal(sends,2);assert.equal((await service.alerts('user','payer')).length,1);
  const tasks=(await pg.query<any>(`SELECT id,data::text FROM agenda_tarefas`)).rows;assert.equal(tasks.length,1);assert.equal(tasks[0].data,'2031-11-15');
  assert.equal((await service.alerts('user','payer'))[0].href,'/agenda-alertas?view=agenda&task='+tasks[0].id);
  fail=true;await service.tick(new Date('2031-11-14T15:00:00Z'));await service.tick(new Date('2031-11-14T15:00:00Z'));assert.equal(sends,3);
  entry.status='pago';assert.equal((await service.alerts('user','payer')).length,0);await service.tick(new Date('2031-11-15T15:00:00Z'));assert.equal(sends,3);
  assert.equal((await pg.query<any>(`SELECT count(*)::int n FROM agenda_tarefas WHERE status='pendente'`)).rows[0].n,0);
 }finally{await pg.close();}
});
