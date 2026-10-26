import type { BiaPatrimonyEstimate } from "@shared/bia-patrimony";
export function BiaPatrimonyBreakdown({estimate,format,biaId,canCorrectAssets=false,canCorrectFinance=false,editablePropertyIds=[]}:{estimate?:BiaPatrimonyEstimate;format:(value:number)=>string;biaId?:string;canCorrectAssets?:boolean;canCorrectFinance?:boolean;editablePropertyIds?:string[]}) {
  if(!estimate)return <p role="status" className="text-sm text-muted-foreground">Estimativa indisponível.</p>;
  return <div className="space-y-2 text-sm" data-testid="bia-patrimony-breakdown">
    <div className="flex flex-wrap items-center justify-between gap-2"><span>{estimate.partial?"Subtotal patrimonial conhecido":"Patrimônio líquido estimado"}</span><strong>{estimate.value===null?"Dados insuficientes":format(estimate.value)}</strong></div>
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">{[["Ativos registrados",estimate.assets],["Caixa registrado",estimate.cash],["Dívidas informadas",estimate.debt]].map(([label,value])=><div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd>{format(Number(value))}</dd></div>)}</dl>
    {estimate.partial && <details className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-300">Estimativa parcial · ver o que falta e corrigir</summary><ul className="mt-3 space-y-3 text-xs text-muted-foreground">{(estimate.issueDetails || estimate.issues.map(message=>({message,target:undefined,id:undefined}))).map((issue,index)=>{
      const base=biaId?`/bias/${encodeURIComponent(biaId)}`:null;
      const href=issue.target==='assets' && canCorrectAssets && base?`${base}/editar?section=ativos${issue.id?`&asset=${encodeURIComponent(issue.id)}`:''}`:issue.target==='finance' && canCorrectFinance && base?`${base}?tab=capital&capital=financeiro`:issue.target==='property' && issue.id && editablePropertyIds.includes(issue.id)?`/carteira/${encodeURIComponent(issue.id)}`:null;
      return <li key={`${index}-${issue.message}`} className="flex flex-col items-start gap-2"><span>{issue.message}</span>{href && <a href={href} className="inline-flex min-h-9 items-center rounded-md border border-amber-500/40 px-3 py-2 font-medium text-amber-800 hover:bg-amber-500/10 dark:text-amber-200">Corrigir pendência</a>}</li>;
    })}</ul></details>}
    <p className="text-xs text-muted-foreground">Calculado em {new Date(estimate.calculatedAt).toLocaleString("pt-BR")}</p>
  </div>;
}
