import { isCashEntry } from "./initial-contributions";
import type { BiaSetup } from "./bia-setup";

export type BiaPatrimonyAsset = { id:string; name?:string; situationMissing?:boolean; value:number|null; debt:number|null; currency:string; acquired:boolean; ownershipConfirmed:boolean; ownershipPercent:number|null };
export type BiaPatrimonyIssue = { message:string; target:'assets'|'property'|'finance'; id?:string };
export type BiaPatrimonyEstimate = { value:number|null; assets:number; cash:number; debt:number; partial:boolean; issues:string[]; issueDetails?:BiaPatrimonyIssue[]; propertyIds:string[]; calculatedAt:string };
const cents=(value:number)=>Math.round(value*100);
export function setupPatrimonyAsset(asset:BiaSetup['ativos'][number],currency:string):BiaPatrimonyAsset {
  return {id:`setup:${asset.id}`,name:asset.nome || 'Ativo sem nome',situationMissing:!asset.situacao || asset.situacao==='A definir',value:asset.tipo==='consorcio'?null:asset.valorReferencia ?? null,debt:asset.dividaSaldo ?? null,ownershipPercent:asset.participacaoBiaPercentual ?? null,currency,acquired:['Adquirido','Em operação'].includes(asset.situacao),ownershipConfirmed:!asset.carteiraImovelId};
}
export function missingPatrimonyFields(asset:BiaPatrimonyAsset) {
  const fields=new Set<'situacao'|'valorReferencia'|'participacaoBiaPercentual'|'dividaSaldo'>();
  if(asset.situationMissing){fields.add('situacao');if(asset.value===null)fields.add('valorReferencia');return fields;}
  if(!asset.acquired || !asset.ownershipConfirmed)return fields;
  if(asset.ownershipPercent===null || !Number.isFinite(asset.ownershipPercent) || asset.ownershipPercent<=0 || asset.ownershipPercent>100)fields.add('participacaoBiaPercentual');
  if(asset.value===null || !Number.isFinite(asset.value) || asset.value<0)fields.add('valorReferencia');
  if(asset.debt===null || !Number.isFinite(asset.debt) || asset.debt<0)fields.add('dividaSaldo');
  return fields;
}
/** Recorded-asset/book-cash estimate, not a market appraisal or a bank balance. Never uses CPP or promised capital. */
export function assetCorrectionFields(asset:BiaSetup['ativos'][number],currency:string) {
  const fields=missingPatrimonyFields(setupPatrimonyAsset(asset,currency));
  // Completing the reference value remains an independent editor task, even if the new situation excludes the asset from the estimate.
  if(asset.tipo!=='consorcio' && (asset.valorReferencia==null || !Number.isFinite(asset.valorReferencia) || asset.valorReferencia<0))fields.add('valorReferencia');
  return fields;
}
export function estimateBiaPatrimony(input:{assets:BiaPatrimonyAsset[];entries:any[];currency:string;assetsUndefined:boolean;calculatedAt:string}):BiaPatrimonyEstimate {
  const issues=new Set<string>();let assets=0,debt=0,cash=0,observations=0;
  const issueDetails:BiaPatrimonyIssue[]=[];
  const add=(message:string,target:BiaPatrimonyIssue['target'],id?:string)=>{if(!issueDetails.some(i=>i.message===message && i.target===target && i.id===id))issueDetails.push({message,target,...(id?{id}:{})});issues.add(message);};
  const assetIssue=(asset:BiaPatrimonyAsset,message:string)=>add(`${asset.name || 'Ativo'}: ${message}`,asset.id.startsWith('property:')?'property':'assets',asset.id.replace(/^(property|setup):/,''));
  const seen=new Set<string>(),propertyIds:string[]=[];
  if(input.assetsUndefined)add("Ativos ainda não definidos. Cadastre ou vincule os imóveis e bens da BIA.",'assets');
  for(const asset of input.assets){
    if(seen.has(asset.id))continue;seen.add(asset.id);
    if(asset.situationMissing){
      assetIssue(asset,"situação não informada. Informe se já foi adquirido, está em negociação ou foi alienado.");
      if(asset.value===null)assetIssue(asset,"valor de referência não informado. Preencha o valor do ativo.");
      continue;
    }
    if(!asset.acquired)continue;
    if(!asset.ownershipConfirmed){assetIssue(asset,"Vínculo de referência não confirma propriedade da BIA. Revise o vínculo formal antes de incluir no patrimônio.");continue;}
    // Formal ownership is independent of price/FX coverage. Do not put the property back in the personal total when its valuation is missing.
    if(asset.id.startsWith("property:"))propertyIds.push(asset.id.slice(9));
    const percent=asset.ownershipPercent;
    const missing=missingPatrimonyFields(asset);
    const invalidPercent=missing.has('participacaoBiaPercentual');
    const invalidValue=missing.has('valorReferencia');
    const invalidDebt=missing.has('dividaSaldo');
    if(invalidPercent)assetIssue(asset,"Participação da BIA no ativo não informada ou inválida. Informe o percentual de propriedade.");
    if(invalidValue)assetIssue(asset,"Ativo sem valor atual registrado. Informe o valor do ativo.");
    if(invalidDebt)assetIssue(asset,"Dívida de ativo não informada. Informe o saldo devedor ou zero se não houver dívida.");
    if(invalidPercent)continue;
    const share=percent!/100;
    if(asset.currency!==input.currency){assetIssue(asset,"Ativo em moeda diferente da BIA. Revise a moeda cadastrada.");continue;}
    if(invalidValue)continue;
    observations++;assets+=cents(asset.value!*share);
    if(!invalidDebt)debt+=cents(asset.debt!*share);
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
  if(!observations && !issues.size)add("Sem ativos ou movimentos efetivos suficientes. Revise os ativos e os lançamentos pagos.",'assets');
  for(const message of issues)if(!issueDetails.some(i=>i.message===message))issueDetails.push({message,target:'finance'});
  return {value:observations?(assets+cash-debt)/100:null,assets:assets/100,cash:cash/100,debt:debt/100,
    partial:issues.size>0,issues:[...issues],issueDetails,propertyIds,calculatedAt:input.calculatedAt};
}
