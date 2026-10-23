import { isCashEntry } from "./initial-contributions";

export type BiaPatrimonyAsset = { id:string; value:number|null; debt:number|null; currency:string; acquired:boolean; ownershipConfirmed:boolean; ownershipPercent:number|null };
export type BiaPatrimonyEstimate = { value:number|null; assets:number; cash:number; debt:number; partial:boolean; issues:string[]; propertyIds:string[]; calculatedAt:string };
const cents=(value:number)=>Math.round(value*100);
/** Recorded-asset/book-cash estimate, not a market appraisal or a bank balance. Never uses CPP or promised capital. */
export function estimateBiaPatrimony(input:{assets:BiaPatrimonyAsset[];entries:any[];currency:string;assetsUndefined:boolean;calculatedAt:string}):BiaPatrimonyEstimate {
  const issues=new Set<string>();let assets=0,debt=0,cash=0,observations=0;
  const seen=new Set<string>(),propertyIds:string[]=[];
  if(input.assetsUndefined)issues.add("Ativos ainda não definidos");
  for(const asset of input.assets){
    if(seen.has(asset.id))continue;seen.add(asset.id);
    if(!asset.acquired)continue;
    if(!asset.ownershipConfirmed){issues.add("Vínculo de referência não confirma propriedade da BIA");continue;}
    // Formal ownership is independent of price/FX coverage. Do not put the property back in the personal total when its valuation is missing.
    if(asset.id.startsWith("property:"))propertyIds.push(asset.id.slice(9));
    const percent=asset.ownershipPercent;
    if(percent===null||!Number.isFinite(percent)||percent<=0||percent>100){issues.add("Participação da BIA no ativo não informada ou inválida");continue;}
    const share=percent/100;
    if(asset.currency!==input.currency){issues.add("Ativo em moeda diferente da BIA");continue;}
    if(asset.value===null||!Number.isFinite(asset.value)||asset.value<0){issues.add("Ativo sem valor atual registrado");continue;}
    observations++;assets+=cents(asset.value*share);
    if(asset.debt===null||!Number.isFinite(asset.debt)||asset.debt<0)issues.add("Dívida de ativo não informada");
    else debt+=cents(asset.debt*share);
  }
  const entriesSeen=new Set<string>();
  for(const entry of input.entries){
    if(entry.id&&entriesSeen.has(String(entry.id)))continue;
    if(entry.id)entriesSeen.add(String(entry.id));
    if(entry.natureza==="nao_caixa"||entry.parcela_vigente===false)continue;
    if(entry.conciliacao_pendente){issues.add("Lançamentos em conciliação");continue;}
    if(!isCashEntry(entry))continue;
    const type=String(entry.tipo||"").toLowerCase();
    const incoming=["entrada","receita"].includes(type),outgoing=["saida","saída","despesa"].includes(type);
    if(!incoming&&!outgoing)continue;
    if(incoming&&entry.descricao==="Valor de Origem da BIA")continue;
    if(["pendente","agendado","vencido","parcial"].includes(String(entry.status))){if(outgoing)issues.add("Obrigações pendentes não conciliadas com as dívidas dos ativos");continue;}
    if(entry.status!=="pago"){
      if(!["cancelado","cancelada"].includes(String(entry.status)))issues.add("Movimentos sem confirmação integral de pagamento");
      continue;
    }
    const value=typeof entry.valor==="number"?entry.valor:Number(entry.valor);
    if(entry.valor===null||entry.valor===""||!Number.isFinite(value)||value<0){issues.add("Lançamento pago com valor inválido");continue;}
    observations++;cash+=(incoming?1:-1)*cents(value);
  }
  if(cash<0)issues.add("Caixa registrado negativo; conferir saldo inicial e lançamentos");
  if(!observations)issues.add("Sem ativos ou movimentos efetivos suficientes");
  return {value:observations?(assets+cash-debt)/100:null,assets:assets/100,cash:cash/100,debt:debt/100,
    partial:issues.size>0,issues:[...issues],propertyIds,calculatedAt:input.calculatedAt};
}
