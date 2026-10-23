import type { BiaSetup } from "@shared/bia-setup";
import { BiaNumberInput } from "./bia-role-composition";

type Asset = BiaSetup['ativos'][number];
export function BiaAssetPatrimonyFields({asset,onChange,moeda,disabled=false}:{asset:Asset;onChange:(patch:Partial<Asset>)=>void;moeda:string;disabled?:boolean}) {
  // Portfolio references do not grant ownership; their formal-origin source remains authoritative.
  if(asset.tipo==='consorcio' || asset.carteiraImovelId)return null;
  return <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
    <label>Participação da BIA no imóvel (%)<BiaNumberInput label="Participação da BIA no imóvel (%)" decimals={5} value={asset.participacaoBiaPercentual ?? NaN} onChange={v=>onChange({participacaoBiaPercentual:Number.isFinite(v)?v:null})}/></label>
    <label>Dívida total do imóvel ({moeda})<BiaNumberInput label="Dívida total do imóvel" value={asset.dividaSaldo ?? NaN} onChange={v=>onChange({dividaSaldo:Number.isFinite(v)?v:null})}/></label>
  </fieldset>;
}

export function BiaAssetPatrimonySummary({value,moeda}:{value:BiaSetup;moeda:string}) {
  const assets=value.ativos.filter(a=>a.tipo!=='consorcio' && !a.carteiraImovelId && (a.participacaoBiaPercentual!=null || a.dividaSaldo!=null));
  if(!assets.length)return null;
  return <section data-pdf-section="patrimonio-ativos" className="space-y-3 rounded border p-5"><h3 className="font-semibold">Participação e dívidas dos imóveis</h3>{assets.map(a=><div key={a.id} className="break-words text-sm"><strong>{a.nome || 'Ativo sem nome'}</strong><p>Participação da BIA: {a.participacaoBiaPercentual==null?'Não informada':`${a.participacaoBiaPercentual.toLocaleString('pt-BR')}%`}</p><p>Dívida total do imóvel: {a.dividaSaldo==null?'Não informada':a.dividaSaldo.toLocaleString('pt-BR',{style:'currency',currency:moeda})}</p></div>)}</section>;
}
