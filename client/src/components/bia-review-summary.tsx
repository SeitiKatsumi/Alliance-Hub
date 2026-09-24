import { Fragment } from "react";
import type { InitialMapCalculation } from "@shared/member-portfolio";
import { formatBiaNumber, formatBiaPercent } from "@shared/bia-numbers";

export function BiaReviewSummary({form,map}:{
  form:{nome_bia:string;destinacao:string;objetivo_alianca:string;moeda:string;localizacao:string;observacoes:string};
  map:InitialMapCalculation;
}) {
  const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:form.moeda});
  const plan=map.estrutura?.integralizacao;
  const periodicity=plan?.forma==="a_vista" ? "Não se aplica (à vista)" : ({0:"Personalizada",1:"Mensal",2:"Bimestral",3:"Trimestral",6:"Semestral",12:"Anual"} as Record<number,string>)[plan?.meses ?? -1];
  const rows=[
    ["Destinação",form.destinacao],["Objetivo",form.objetivo_alianca],["Moeda",form.moeda],
    ["Localização",form.localizacao],["Descrição",form.observacoes],
    ["Valor de Origem",money(map.valorOrigem)],
    ["Direitos econômicos / DM",formatBiaPercent(map.divisorMultiplicador)],
    ...(map.estrutura ? [["Quantidade de Cotas Iniciais",formatBiaNumber(map.estrutura.totalCotas,5)]] : [["Base Econômica Inicial",money(map.baseEconomicaInicial)]]),
  ];
  const conditions=map.estrutura ? [
      ["Forma de capitalização",({recursos_proprios:"Recursos próprios",consorcio:"Consórcio",financiamento:"Financiamento",mista:"Mista",outra:"Outra"})[map.estrutura.modalidade]],
      ...(map.estrutura.descricao ? [["Capitalização",map.estrutura.descricao]] : []),
      ...(map.estrutura.instrumentos || []).map(i=>[`Instrumento: ${i.nome}`,money(i.valor)]),
      ["Forma de integralização",({a_vista:"À vista",parcelado:"Parcelado",personalizado:"Personalizado"})[plan!.forma]],
      ["Quantidade de parcelas",String(plan!.quantidade)],
      ["Primeiro vencimento",plan!.primeiroVencimento.split("-").reverse().join("/")],
      ["Periodicidade",periodicity],["Correção contratual",plan!.correcao],["Detalhes do plano",plan!.observacoes],
    ] : [];
  return <section className="space-y-3 rounded-lg border p-5">
    <div data-print-hide><p className="text-xs font-semibold uppercase tracking-widest">BUILT Alliances</p>
    <h1 className="text-2xl font-bold">{form.nome_bia || "BIA em estruturação"}</h1>
    <p className="text-sm text-muted-foreground">Resumo para revisão - prévia em estruturação. Não substitui o MOU ou documentos assinados; não confirma aportes nem pagamentos.</p></div>
    {[{id:"dados",title:"Resumo dos dados",items:rows},{id:"condicoes",title:"Capitalização e integralização",items:conditions}].map(({id,title,items})=>items.length>0 && <div key={id} data-pdf-section={id}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[220px_1fr]">{items.map(([label,value],i)=><Fragment key={`${label}:${i}`}><dt className="font-medium">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{value?.trim() || "Não informado"}</dd></Fragment>)}</dl>
    </div>)}
  </section>;
}
