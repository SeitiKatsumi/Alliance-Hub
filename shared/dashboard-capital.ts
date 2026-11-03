import {relationId} from './bia-access';
import {isCashEntry} from './initial-contributions';

// Only physical Directus fields; initial-entry metadata is added by the existing loader.
export const DASHBOARD_CAPITAL_QUERY = 'fields=id,bia,tipo,status,valor,descricao,favorecido_id&filter[status][_eq]=pago&limit=-1';
export type DashboardCapitalEntry = {
  id?:unknown;bia?:unknown;favorecido_id?:unknown;tipo?:unknown;status?:unknown;valor?:unknown;descricao?:unknown;
  natureza?:string;conciliacao_pendente?:boolean;parcela_vigente?:boolean;
};
export type DashboardMemberCapital = {invested:number;received:number;sharePercent:number};

/** Paid cash attributed to this member. MAP rights and future commitments are separate metrics. */
export function paidMemberCapital(entries:DashboardCapitalEntry[],memberId:string,biaIds:Iterable<string>):Map<string,DashboardMemberCapital> {
  const allowed=new Set(Array.from(biaIds,String));
  const totals=new Map<string,{total:number;own:number;received:number}>();
  const seen=new Set<string>();
  for(const entry of entries) {
    if(String(entry.status||'').trim().toLowerCase()!=='pago'||!isCashEntry(entry)||entry.parcela_vigente===false) continue;
    if(String(entry.descricao||'').trim().toLowerCase()==='valor de origem da bia') continue;
    const biaId=relationId(entry.bia),beneficiary=relationId(entry.favorecido_id);
    const value=typeof entry.valor==='number'||typeof entry.valor==='string'?Number(entry.valor):NaN;
    const cents=Math.round(value*100);
    const type=String(entry.tipo||'').trim().toLowerCase();
    if(!biaId||!allowed.has(biaId)||!beneficiary||!Number.isSafeInteger(cents)||cents<=0||!['entrada','saida','saída'].includes(type)) continue;
    const id=relationId(entry.id);
    if(id&&seen.has(id)) continue;
    if(id) seen.add(id);
    const row=totals.get(biaId)||{total:0,own:0,received:0};
    if(type==='entrada') {row.total+=cents;if(beneficiary===memberId)row.own+=cents;}
    else if(beneficiary===memberId) row.received+=cents;
    totals.set(biaId,row);
  }
  return new Map([...totals].map(([id,row])=>[id,{invested:row.own/100,received:row.received/100,sharePercent:row.total>0?row.own/row.total*100:0}]));
}
