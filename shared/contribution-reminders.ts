import {z} from 'zod';
import {isCashEntry} from './initial-contributions';
export const contributionReminderSchema=z.object({enabled:z.boolean(),month:z.boolean(),week:z.boolean(),day:z.boolean()}).strict().refine(v=>!v.enabled||v.month||v.week||v.day,'Escolha ao menos um prazo.');
export type ContributionReminderSettings=z.infer<typeof contributionReminderSchema>;
export const defaultContributionReminders:ContributionReminderSettings={enabled:false,month:true,week:true,day:true};
export const contributionAgendaUrl=(taskId:string)=>`/agenda-alertas?view=agenda&task=${encodeURIComponent(taskId)}`;
export const reminderDate=(v:any)=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10);
export function reminderEntryEligible(entry:any){
 const date=reminderDate(entry?.data_vencimento);
 return !!entry&&entry.tipo==='entrada'&&isCashEntry(entry)&&['pendente','agendado','vencido'].includes(entry.status)&&!entry.data_pagamento&&!!entry.favorecido_id&&Number(entry.valor)>0&&Number.isFinite(Number(entry.valor))&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
}
export function contributionReminderPlan(due:string,created:string,settings:ContributionReminderSettings){
 if(!settings.enabled)return[];
 const d=new Date(due+'T12:00:00Z');
 const before=(days:number)=>{const copy=new Date(d);copy.setUTCDate(copy.getUTCDate()-days);return copy.toISOString().slice(0,10);};
 const month=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0,12));
 month.setUTCDate(Math.min(d.getUTCDate(),month.getUTCDate()));
 const selected=[...(settings.month?[{kind:'month',date:month.toISOString().slice(0,10)}]:[]),...(settings.week?[{kind:'week',date:before(7)}]:[]),...(settings.day?[{kind:'day',date:before(1)}]:[])].sort((a,b)=>a.date.localeCompare(b.date));
 if(!selected.length)return[];
 return [...(created>=selected[0].date?[{kind:'initial',date:created}]:[]),...selected.filter(p=>p.date>created)];
}
