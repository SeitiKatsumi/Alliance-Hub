export interface ObaQuotaOption { id:string;numero:number;tipo:string;aporte:number|null;cotas:number|null;moeda:string }

export function ObaQuotaSelect({quotas,value,onChange}:{quotas?:ObaQuotaOption[];value:string;onChange:(value:string)=>void}) {
  if (!quotas?.length) return null;
  return <label className="block space-y-1 text-sm">
    <span>Interesse</span>
    <select value={value} onChange={event=>onChange(event.target.value)} className="block w-full rounded-md border bg-background p-2">
      <option value="">Interesse na oportunidade</option>
      {quotas.map(quota=><option key={quota.id} value={quota.id}>
        Cota {quota.numero} · {quota.tipo==="guardiao"?"Guardião":"Multiplicador"}
        {quota.cotas != null ? " · "+quota.cotas+" CI" : ""}
        {quota.aporte != null ? " · "+new Intl.NumberFormat("pt-BR",{style:"currency",currency:quota.moeda || "BRL"}).format(quota.aporte) : ""}
      </option>)}
    </select>
  </label>;
}


export function obaQuotaStatusLabel(status?: string | null) {
  if (status === "aprovada") return "Aprovada";
  if (status === "recusada") return "Recusada";
  if (status === "vaga_preenchida") return "Cota preenchida";
  if (status === "pendente") return "Aguardando decisão";
  return "Interesse registrado";
}
