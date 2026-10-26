import {sql} from 'drizzle-orm';
import {randomUUID,createHash} from 'node:crypto';
import {contributionReminderSchema,defaultContributionReminders,contributionReminderPlan,reminderEntryEligible,reminderDate} from '../shared/contribution-reminders';
import {saoPauloClock,cents} from '../shared/contribution-billing';
import type {ContributionBilling} from './contribution-billing';
import type {AgendaAlertItem} from './agenda-alerts';
import {contributionAgendaUrl} from '../shared/contribution-reminders';
export function contributionCalendarId(flow:string,payer:string,due:string){const h=createHash('sha256').update(JSON.stringify(['aporte-calendar',flow,payer,due])).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
const fault=(message:string,statusCode=409)=>Object.assign(new Error(message),{statusCode});
export class ContributionReminders{
 constructor(private billing:ContributionBilling){}
 get deps(){return this.billing.deps;}
 async ready(){return !!(await this.deps.db.execute(sql`SELECT to_regclass('bia_aporte_reminder_settings') IS NOT NULL AND to_regclass('bia_aporte_reminder_deliveries') IS NOT NULL AS ready`)).rows[0]?.ready;}
 async entry(biaId:string,flowId:string){return(await this.deps.entries(biaId)).find(e=>String(e.id)===flowId);}
 async alerts(user:string,payer:string|null):Promise<AgendaAlertItem[]>{
  if(!payer||!await this.ready())return[];
  const rows=(await this.deps.db.execute(sql`SELECT DISTINCT ON(t.origem_tarefa_id) t.*,d.due_date::text AS due_date FROM agenda_tarefas t JOIN bia_aporte_reminder_deliveries d ON d.flow_id=t.origem_tarefa_id AND d.payer_id=t.membro_id AND d.due_date=t.data AND d.channel='agenda' AND d.state='sent' JOIN bia_aporte_reminder_settings s ON s.flow_id=d.flow_id WHERE t.user_id=${user} AND t.membro_id=${payer} AND t.contexto_tipo='aporte_reminder' AND t.status IN ('pendente','em_andamento') AND s.settings->>'enabled'='true' ORDER BY t.origem_tarefa_id,t.atualizado_em DESC`)).rows;
  const result:AgendaAlertItem[]=[];
  for(const row of rows){
   const entry=await this.entry(row.contexto_id,row.origem_tarefa_id),bia=await this.deps.bia(row.contexto_id);
   const charge=(await this.deps.db.execute(sql`SELECT payment_state FROM bia_contribution_charges WHERE flow_id=${row.origem_tarefa_id} AND environment=${this.billing.environment}`)).rows[0];
   if(!reminderEntryEligible(entry)||String(entry.favorecido_id)!==payer||reminderDate(entry.data_vencimento)!==reminderDate(row.due_date)||!['ativa','em_execucao','em_operacao','em_distribuicao'].includes(bia?.situacao)||['received','confirmed','processing','cancelled','refunded'].includes(charge?.payment_state))continue;
   result.push({id:'aporte:'+row.origem_tarefa_id,source_type:'aporte_reminder',source_id:row.origem_tarefa_id,group:'pendencias',category:'financeiro',title:row.titulo,description:row.descricao,priority:'media',status:'pendente',created_at:row.atualizado_em,due_at:row.due_date,action_required:true,active:true,href:contributionAgendaUrl(row.id),actions:['consultar']});
  }return result;
 }
 async read(biaId:string,flowId:string,manage:boolean,payerId:string|null){
  const entry=await this.entry(biaId,flowId);if(!entry)throw fault('Aporte não encontrado nesta BIA.',404);
  if(!manage&&String(entry.favorecido_id)!==payerId)throw fault('Avisos restritos ao pagador e gestores.',403);
  if(!await this.ready())throw fault('A configuração de lembretes aguarda atualização do banco.',503);
  const row=(await this.deps.db.execute(sql`SELECT settings FROM bia_aporte_reminder_settings WHERE flow_id=${flowId} AND bia_id=${biaId}`)).rows[0];
  const uncertain=(await this.deps.db.execute(sql`SELECT 1 FROM bia_aporte_reminder_deliveries WHERE flow_id=${flowId} AND (state='unknown' OR (state='queued' AND attempts>=3)) LIMIT 1`)).rows.length>0;
  return{settings:row?.settings||defaultContributionReminders,canEdit:manage,eligible:reminderEntryEligible(entry),deliveryUncertain:uncertain};
 }
 async save(biaId:string,flowId:string,raw:any,actor:string,now=new Date()){
  const settings=contributionReminderSchema.parse(raw);if(!await this.ready())throw fault('A configuração de lembretes aguarda atualização do banco.',503);
  await this.deps.lock(biaId,async(tx)=>{
   const entry=await this.entry(biaId,flowId);if(!entry)throw fault('Aporte não encontrado nesta BIA.',404);
   if(settings.enabled&&!reminderEntryEligible(entry))throw fault('Somente aportes em dinheiro em aberto e com pagador podem receber lembretes.',422);
   await tx.execute(sql`INSERT INTO bia_aporte_reminder_settings(flow_id,bia_id,settings,actor_id,created_at) VALUES(${flowId},${biaId},${JSON.stringify(settings)}::jsonb,${actor},${now.toISOString()}) ON CONFLICT(flow_id) DO UPDATE SET settings=excluded.settings,actor_id=excluded.actor_id,updated_at=now() WHERE bia_aporte_reminder_settings.bia_id=excluded.bia_id`);
  });
  // Persistência é separada da entrega: falha de e-mail não repete criação de lançamento.
  await this.process(biaId,flowId,now).catch(()=>{});
  return{settings};
 }
 async tick(now=new Date()){
  if(!await this.ready())return;
  await this.deps.db.execute(sql`UPDATE bia_aporte_reminder_deliveries SET state=CASE WHEN channel='agenda' THEN 'queued' ELSE 'unknown' END WHERE state='sending' AND updated_at<now()-interval '5 minutes'`);
  const rows=(await this.deps.db.execute(sql`SELECT flow_id,bia_id FROM bia_aporte_reminder_settings ORDER BY updated_at`)).rows;
  for(const row of rows)await this.process(row.bia_id,row.flow_id,now).catch(()=>{});
 }
 async process(biaId:string,flowId:string,now=new Date()){
  const row=(await this.deps.db.execute(sql`SELECT * FROM bia_aporte_reminder_settings WHERE flow_id=${flowId} AND bia_id=${biaId}`)).rows[0];if(!row)return;
  const settings=contributionReminderSchema.parse(row.settings),entry=await this.entry(biaId,flowId);
  const charge=(await this.deps.db.execute(sql`SELECT payment_state FROM bia_contribution_charges WHERE flow_id=${flowId} AND environment=${this.billing.environment}`)).rows[0];
  if(!settings.enabled||!reminderEntryEligible(entry)||['received','confirmed','processing','cancelled','refunded'].includes(charge?.payment_state)){
   await this.deps.db.execute(sql`UPDATE agenda_tarefas SET status='concluida',atualizado_em=now() WHERE contexto_tipo='aporte_reminder' AND origem_tarefa_id=${flowId} AND status IN ('pendente','em_andamento')`);return;
  }
  const date=saoPauloClock(now).date,due=reminderDate(entry.data_vencimento),payer=String(entry.favorecido_id);
  const calendarId=contributionCalendarId(flowId,payer,due);
  await this.deps.lock(biaId,async(tx)=>{
   const fresh=await this.entry(biaId,flowId),bia=await this.deps.bia(biaId);
   if(!reminderEntryEligible(fresh)||String(fresh.favorecido_id)!==payer||reminderDate(fresh.data_vencimento)!==due||!['ativa','em_execucao','em_operacao','em_distribuicao'].includes(bia?.situacao))return;
   const member=await this.deps.member(payer),user=await this.deps.userForMember(member);if(!user)return;
   await tx.execute(sql`UPDATE agenda_tarefas SET status='cancelada',atualizado_em=now() WHERE contexto_tipo='aporte_reminder' AND origem_tarefa_id=${flowId} AND id::text<>${calendarId} AND status IN ('pendente','em_andamento')`);
   await tx.execute(sql`INSERT INTO agenda_tarefas(id,user_id,membro_id,titulo,descricao,data,status,prioridade,contexto_tipo,contexto_id,origem_tarefa_id) VALUES(${calendarId},${user},${payer},'Pagar aporte',${`Aporte de ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(fresh.valor))} · ${fresh.descricao||'Aporte'}.`},${due},'pendente','media','aporte_reminder',${biaId},${flowId}) ON CONFLICT(id) DO UPDATE SET descricao=excluded.descricao,data=excluded.data`);
  });
  await this.deps.db.execute(sql`UPDATE agenda_tarefas t SET status='cancelada',atualizado_em=now() FROM bia_aporte_reminder_deliveries d WHERE t.id::text=d.id::text AND d.flow_id=${flowId} AND d.due_date<>${due}::date AND t.status IN ('pendente','em_andamento')`);
  await this.deps.db.execute(sql`UPDATE agenda_tarefas SET status='cancelada',atualizado_em=now() WHERE contexto_tipo='aporte_reminder' AND origem_tarefa_id=${flowId} AND membro_id<>${payer} AND status IN ('pendente','em_andamento')`);
  const plan=contributionReminderPlan(due,saoPauloClock(new Date(row.created_at)).date,settings).filter(p=>p.date<=date);
  const event=plan.at(-1);if(!event)return;
  for(const channel of ['agenda','email'] as const){
   await this.deps.db.execute(sql`INSERT INTO bia_aporte_reminder_deliveries(id,flow_id,due_date,payer_id,kind,channel) VALUES(${randomUUID()},${flowId},${due},${payer},${event.kind},${channel}) ON CONFLICT DO NOTHING`);
   const notice=(await this.deps.db.execute(sql`UPDATE bia_aporte_reminder_deliveries SET state='sending',attempts=attempts+1,updated_at=now() WHERE flow_id=${flowId} AND due_date=${due} AND payer_id=${payer} AND kind=${event.kind} AND channel=${channel} AND state='queued' AND attempts<3 RETURNING *`)).rows[0];if(!notice)continue;
   try{await this.deps.lock(biaId,async(tx)=>{
    const fresh=await this.entry(biaId,flowId),config=(await tx.execute(sql`SELECT settings FROM bia_aporte_reminder_settings WHERE flow_id=${flowId}`)).rows[0]?.settings;
    const bia=await this.deps.bia(biaId);
    const payment=(await tx.execute(sql`SELECT payment_state FROM bia_contribution_charges WHERE flow_id=${flowId} AND environment=${this.billing.environment}`)).rows[0];
    if(!config?.enabled||(event.kind!=='initial'&&!config[event.kind])||['received','confirmed','processing','cancelled','refunded'].includes(payment?.payment_state)||!reminderEntryEligible(fresh)||String(fresh.favorecido_id)!==payer||reminderDate(fresh.data_vencimento)!==due||!['ativa','em_execucao','em_operacao','em_distribuicao'].includes(bia?.situacao)){
     await tx.execute(sql`UPDATE bia_aporte_reminder_deliveries SET state='suppressed' WHERE id=${notice.id}`);return;
    }
    const member=await this.deps.member(payer);let state='sent';
    if(channel==='agenda'){
     const user=await this.deps.userForMember(member);if(!user)throw fault('Pagador sem conta.');
     if(!(await tx.execute(sql`SELECT id FROM agenda_tarefas WHERE id::text=${calendarId} AND user_id=${user}`)).rows.length)throw fault('Ação de pagamento indisponível.');
    }else{
     if(!member?.email)throw fault('Pagador sem e-mail.');
     const sent=await this.deps.sendNotice({email:member.email,name:member.nome,biaId,amount:cents(fresh.valor),dueDate:due,details:{flowId,agendaTaskId:calendarId},kind:'flow-reminder:'+event.kind});
     state=sent.skipped?'suppressed':sent.ok?'sent':'unknown';
    }
    await tx.execute(sql`UPDATE bia_aporte_reminder_deliveries SET state=${state},updated_at=now() WHERE id=${notice.id}`);
   });}catch{await this.deps.db.execute(sql`UPDATE bia_aporte_reminder_deliveries SET state=${channel==='email'?'unknown':'queued'},updated_at=now() WHERE id=${notice.id}`);}
  }
 }
}
