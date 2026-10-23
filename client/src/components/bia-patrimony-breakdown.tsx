import type { BiaPatrimonyEstimate } from "@shared/bia-patrimony";
export function BiaPatrimonyBreakdown({estimate,format}:{estimate?:BiaPatrimonyEstimate;format:(value:number)=>string}) {
  if(!estimate)return <p role="status" className="text-sm text-muted-foreground">Estimativa indisponível.</p>;
  return <div className="space-y-2 text-sm" data-testid="bia-patrimony-breakdown">
    <div className="flex flex-wrap items-center justify-between gap-2"><span>{estimate.partial?"Subtotal patrimonial conhecido":"Patrimônio líquido estimado"}</span><strong>{estimate.value===null?"Dados insuficientes":format(estimate.value)}</strong></div>
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">{[["Ativos registrados",estimate.assets],["Caixa registrado",estimate.cash],["Dívidas informadas",estimate.debt]].map(([label,value])=><div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd>{format(Number(value))}</dd></div>)}</dl>
    {estimate.partial && <details><summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-300">Estimativa parcial · dados pendentes</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{estimate.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></details>}
    <p className="text-xs text-muted-foreground">Calculado em {new Date(estimate.calculatedAt).toLocaleString("pt-BR")}</p>
  </div>;
}
