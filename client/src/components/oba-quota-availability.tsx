import { Check, Plus, UserRound } from "lucide-react";

type ObaQuotaAvailabilityProps = {
  available: number;
  total: number;
  quotas?: readonly {id:string;numero:number;quantidade:number}[];
  selected?: readonly string[];
  onToggle?: (id:string)=>void;
  valorPorCota?: number;
  moeda?: string;
};

export function ObaQuotaAvailability({ available, total, quotas, selected=[], onToggle, valorPorCota, moeda="BRL" }: ObaQuotaAvailabilityProps) {
  const unavailable = Math.max(0, total - available);
  const selectedCount=quotas?.filter(quota=>selected.includes(quota.id)).reduce((sum,quota)=>sum+quota.quantidade,0) ?? 0;
  const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:moeda});
  const availableStyle = "border border-dashed border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  const unavailableStyle = "border border-border bg-muted text-muted-foreground";
  const slotStyle = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg";
  return <section aria-label="Cotas iniciais" className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
    <h2 className="font-semibold">Cotas iniciais</h2>
    {onToggle && quotas ? <div className="flex max-h-52 max-w-md flex-wrap gap-1.5 overflow-auto p-0.5">
      {unavailable > 0 && <span aria-hidden="true" className={slotStyle+" "+unavailableStyle} title={`${unavailable} indisponíveis`}><UserRound className="h-4 w-4"/></span>}
      {quotas.map(quota=>{
        const checked=selected.includes(quota.id);
        return <button type="button" key={quota.id} aria-pressed={checked} aria-label={quota.quantidade > 1 ? `Lote de ${quota.quantidade} cotas` : `Cota ${quota.numero}`} onClick={()=>onToggle(quota.id)}
          className={`${slotStyle} ${checked ? "border border-primary bg-primary text-primary-foreground" : availableStyle} ${quota.quantidade>1 ? "w-auto gap-1 px-2" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}>
          {quota.quantidade > 1 ? <span className="text-xs">Lote de {quota.quantidade} cotas</span> : checked ? <Check className="h-4 w-4"/> : <Plus className="h-4 w-4"/>}
        </button>;
      })}
    </div> : <div aria-hidden="true" className="flex max-w-md flex-wrap gap-1.5">
      {total <= 24 ? <>
        {Array.from({length:unavailable},(_,index)=><span key={index} className={slotStyle+" "+unavailableStyle}><UserRound className="h-4 w-4"/></span>)}
        {Array.from({length:available},(_,index)=><span key={index} className={slotStyle+" "+availableStyle}><Plus className="h-4 w-4"/></span>)}
      </> : <>
        <span className={"inline-flex items-center gap-2 rounded-lg px-3 py-2 tabular-nums "+availableStyle}><Plus className="h-4 w-4"/>{available}</span>
        <span className={"inline-flex items-center gap-2 rounded-lg px-3 py-2 tabular-nums "+unavailableStyle}><UserRound className="h-4 w-4"/>{unavailable}</span>
      </>}
    </div>}
    <p className="text-sm text-muted-foreground"><strong className="text-foreground">{available} de {total} cotas disponíveis</strong>{unavailable > 0 && ` · ${unavailable} ${unavailable === 1 ? "indisponível" : "indisponíveis"}`}</p>
    {onToggle && valorPorCota!==undefined && <div className="space-y-2 border-t pt-3 text-sm">
      <p className="flex justify-between gap-2 text-muted-foreground"><span>Valor por cota inicial</span><strong className="text-foreground">{money.format(valorPorCota)}</strong></p>
      {selectedCount>0 && <p role="status" className="flex justify-between gap-2"><span>Total de {selectedCount} {selectedCount===1?"cota selecionada":"cotas selecionadas"}</span><strong className="tabular-nums">{money.format(selectedCount*valorPorCota)}</strong></p>}
    </div>}
  </section>;
}
