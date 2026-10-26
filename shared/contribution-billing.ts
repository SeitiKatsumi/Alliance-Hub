import { z } from "zod";
import { isCashEntry } from './initial-contributions';

export const billingSettingsSchema = z.object({
  email: z.boolean(), agenda: z.boolean(),
  offsets: z.array(z.number().int().min(-30).max(30)).min(1).max(10).transform(v => Array.from(new Set(v)).sort((a,b)=>a-b)),
  billingType: z.enum(["PIX", "BOLETO"]),
}).strict();
export const defaultBillingSettings = { email:true, agenda:true, offsets:[-5,0,3], billingType:"BOLETO" as const };

export function cashContributionProblem(entry:any):string|null {
  if(!isCashEntry(entry))return 'Propriedade, direitos e movimentos em conciliação não geram cobrança.';
  if(entry.tipo!=='entrada')return 'Somente entradas de aporte em dinheiro podem gerar cobrança.';
  if(!['pendente','agendado','vencido'].includes(entry.status) || entry.data_pagamento)return 'Aporte já pago, parcial ou sem situação de pagamento válida.';
  if(!entry.favorecido_id)return 'Selecione o participante pagador do aporte.';
  if(entry.pagamento_id || entry.pagamento_provider || entry.pagamento_url)return 'O lançamento já possui um pagamento vinculado.';
  if(!(Number(entry.valor)>0) || !Number.isFinite(Number(entry.valor)))return 'Informe um valor positivo.';
  const date=String(entry.data_vencimento || '').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)return 'Informe o vencimento do aporte.';
  return null;
}
export const revisionInputSchema = z.object({
  parcelIds:z.array(z.string().uuid()).min(1).max(200).refine(v=>new Set(v).size===v.length),
  fromDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},"Data inválida"),
  mode:z.enum(["value", "percent"]), value:z.number().finite(), reason:z.string().trim().min(3).max(500),
}).strict();
export type RevisionInput = z.infer<typeof revisionInputSchema>;
export function cents(value: unknown): number {
  const number = Number(value), result = Math.round((number + Number.EPSILON) * 100);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(result)) throw new Error("Valor financeiro inválido");
  return result;
}
export function revisedCents(original:number, input:RevisionInput) {
  if (input.mode === "percent" && (input.value <= -100 || input.value > 10000)) throw new Error("Percentual inválido");
  const next = input.mode === "value" ? cents(input.value) : Math.round(original*(1+input.value/100));
  if (!Number.isSafeInteger(next) || next <= 0) throw new Error("A parcela deve ter valor positivo");
  return next;
}
export function saoPauloClock(now=new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=(key:string)=>parts.find(p=>p.type===key)!.value;
  return {date:`${get("year")}-${get("month")}-${get("day")}`,hour:Number(get("hour"))};
}
export function dayDistance(from:string,to:string) { return Math.round((Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86400000); }
export const openPaymentStates = ["none","open","overdue"];
export function canReviseParcel(row:any, today:string) {
  return row.vigente === true && row.pendente === false && row.natureza === "caixa" && row.componente === "capital"
    && row.due_date > today && !row.pending_revision && ["queued","ready","blocked"].includes(row.job_state)
    && openPaymentStates.includes(row.payment_state) && !row.protected;
}
export function providerPaymentState(status:unknown) {
  switch(status) {
    case "RECEIVED": case "RECEIVED_IN_CASH": return "received";
    case "CONFIRMED": return "confirmed";
    case "PENDING": return "open";
    case "OVERDUE": return "overdue";
    case "REFUNDED": return "refunded";
    case "DELETED": return "cancelled";
    default:return "processing"; // analysis, partial refunds and unknown statuses are never open or paid
  }
}
export function billingTotals(rows:any[],today:string) {
  const total={expected:0,received:0,confirmed:0,upcoming:0,overdue:0,processing:0,percentage:0};
  for(const r of rows) {
    if(!r.vigente || ["cancelled","refunded"].includes(r.payment_state))continue;
    const value=Number(r.amount_cents);total.expected+=value;
    if(r.payment_state==="received")total.received+=value;
    else if(r.payment_state==="confirmed")total.confirmed+=value;
    else if(openPaymentStates.includes(r.payment_state))total[r.due_date<today?"overdue":"upcoming"]+=value;
    else total.processing+=value;
  }
  total.percentage=total.expected?Math.round(total.received/total.expected*10000)/100:0;
  return total;
}
export function canManageContributionBilling(roles:readonly string[],admin=false) { return admin || roles.some(r=>["aliado","diretor_alianca","diretor_capital"].includes(r)); }
export function safeAsaasUrl(value:unknown): string|null {
  if(typeof value!=="string")return null;
  try{const u=new URL(value);return u.protocol==="https:" && (u.hostname==="asaas.com" || u.hostname.endsWith(".asaas.com")) ? u.href : null;}catch{return null;}
}
