import { useState } from "react";
import { applyPaymentPlan, type BiaBudget } from "@shared/bia-budget";
import { makePaymentSchedule, newPaymentPlan, parsePaymentAmounts, toPaymentCents, type PaymentPlan } from "@shared/bia-payment-plan";
import { BiaNumberInput } from "./bia-role-composition";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const models={a_vista:"À vista",parcelado:"Parcelado",blocos:"Entrada + intermediárias + saldo"};
const periods=[[1,"Mensal"],[2,"Bimestral"],[3,"Trimestral"],[6,"Semestral"],[12,"Anual"]] as const;
const css="block h-10 w-full rounded-md border bg-background px-2";

export function BiaPaymentPlanEditor({budget,total,onChange}:{
  budget:BiaBudget;total?:number|null;onChange:(budget:BiaBudget)=>void;
}) {
  const [error,setError]=useState("");
  const [draft,setDraft]=useState<string | null>(null);
  const plan=budget.planoPagamento || newPaymentPlan(budget.inicio);
  const fixedValues=plan.modelo!=="a_vista" ? plan.saldoValoresCentavos : undefined;
  const update=(patch:Partial<PaymentPlan>)=>{
    setError("");
    onChange({...budget,planoPagamento:{...plan,...patch}});
  };
  const money=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:budget.moeda}).format(cents/100);
  let rows:ReturnType<typeof makePaymentSchedule>=[];
  let invalid="";
  try {rows=makePaymentSchedule(plan,total ?? NaN);}catch(e){invalid=e instanceof Error?e.message:"Revise o plano.";}
  const fixedCount=plan.modelo==="blocos"
    ? plan.intermediarias.reduce((total,block)=>total+block.quantidade,0) + (toPaymentCents(plan.entrada ?? 0)>0 ? 1 : 0)
    : 0;
  const installments=rows.slice(fixedCount);
  const byAmount=new Map<number,number>();
  for(const {centavos} of installments) byAmount.set(centavos,(byAmount.get(centavos) ?? 0)+1);
  const balance=installments.reduce((total,row)=>total+row.centavos,0);
  const count=(value:string)=>Math.min(120,Math.max(1,Math.trunc(Number(value)||1)));
  const period=(value:number,change:(value:number)=>void)=><select className={css} value={value} onChange={e=>change(Number(e.target.value))}>
    {periods.map(([number,label])=><option key={number} value={number}>{label}</option>)}
  </select>;
  return <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
    <h3 className="text-lg font-semibold">Plano de pagamento do Valor de Origem</h3>
    <div className="grid gap-3 sm:grid-cols-3">
      <label>Modelo<select className={css} value={plan.modelo} onChange={e=>update({modelo:e.target.value as PaymentPlan["modelo"]})}>
        {Object.entries(models).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <label>Primeiro vencimento<Input type="month" value={plan.inicio} onChange={e=>update({inicio:e.target.value})}/></label>
      <label>Correção das parcelas<select className={css} value={plan.correcao} onChange={e=>update({correcao:e.target.value as PaymentPlan["correcao"]})}>
        {["Sem reajuste","INCC","IPCA"].map(label=><option key={label}>{label}</option>)}
      </select></label>
    </div>
    {plan.modelo==="blocos" && <>
      <label className="block max-w-xs">Entrada ({budget.moeda})<BiaNumberInput label="Entrada" value={plan.entrada ?? NaN} onChange={value=>update({entrada:Number.isFinite(value)?value:null})}/></label>
      {plan.intermediarias.map((block,index)=>{
        const change=(patch:Partial<typeof block>)=>update({intermediarias:plan.intermediarias.map((row,i)=>i===index?{...row,...patch}:row)});
        return <div key={index} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-4">
          <label>Bloco<Input maxLength={100} value={block.nome} onChange={e=>change({nome:e.target.value})}/></label>
          <label>Quantidade<Input type="number" min={1} max={120} value={block.quantidade} onChange={e=>change({quantidade:count(e.target.value)})}/></label>
          <label>Valor por parcela<BiaNumberInput label={"Valor de "+block.nome} value={block.valor ?? NaN} onChange={value=>change({valor:Number.isFinite(value)?value:null})}/></label>
          <label>Periodicidade{period(block.intervalo,intervalo=>change({intervalo}))}</label>
          <Button type="button" size="sm" variant="ghost" onClick={()=>update({intermediarias:plan.intermediarias.filter((_,i)=>i!==index)})}>Remover bloco</Button>
        </div>;
      })}
      <Button type="button" variant="outline" disabled={plan.intermediarias.length>=20} onClick={()=>update({intermediarias:[...plan.intermediarias,{nome:"Intermediárias",quantidade:1,valor:null,intervalo:1}]})}>Adicionar bloco intermediário</Button>
    </>}
    {plan.modelo!=="a_vista" && <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
      <label>{plan.modelo==="blocos"?"Parcelas do saldo":"Quantidade de parcelas"}<Input type="number" min={0} max={120} readOnly={fixedValues!==undefined} value={fixedValues?.length ?? plan.saldoQuantidade ?? ""} onChange={e=>update({saldoQuantidade:e.target.value === "" ? null : e.target.valueAsNumber})}/></label>
      <label>Periodicidade{period(plan.saldoIntervalo,saldoIntervalo=>update({saldoIntervalo}))}</label>
      <div className="space-y-1">
        <span className="block">{fixedValues ? "Total das parcelas corrigidas" : "Saldo calculado"}</span>
        <strong>{rows.length ? money(balance) : "—"}</strong>
        {!fixedValues && byAmount.size>0 && <ul className="text-sm text-muted-foreground" aria-label="Valores das parcelas do saldo">
          {[...byAmount].map(([value,quantity])=><li key={value}>{quantity} × {money(value)}</li>)}
        </ul>}
      </div>
      <label className="flex items-center gap-2 sm:col-span-3">
        <input type="checkbox" checked={fixedValues!==undefined} onChange={e=>{
          setDraft(null);
          update({saldoValoresCentavos:e.target.checked ? [] : undefined});
        }}/>
        Informar valores já corrigidos
      </label>
      {fixedValues && <div className="space-y-2 sm:col-span-3">
        <label className="block">Cole um valor por linha
          <textarea className="block min-h-32 w-full rounded-md border bg-background p-2" maxLength={12000}
            placeholder="1ª parcela: 8.625,00"
            value={draft ?? fixedValues.map(value=>(value/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})).join("\n")}
            onChange={e=>{setDraft(e.target.value);setError("");}}/>
        </label>
        <Button type="button" variant="outline" disabled={draft===null} onClick={()=>{
          try {
            update({saldoValoresCentavos:parsePaymentAmounts(draft ?? "")});
            setDraft(null);
          } catch(e) {
            setError(e instanceof Error ? e.message : "Confira a lista de parcelas.");
          }
        }}>Importar parcelas</Button>
        {draft!==null && fixedValues.length>0 && <Button type="button" variant="ghost" onClick={()=>{setDraft(null);setError("");}}>Descartar edição da lista</Button>}
      </div>}
    </div>}
    {!!rows.length && <p role="status">{rows.length} pagamentos · até {rows.at(-1)!.mes} · {money(rows.reduce((sum,row)=>sum+row.centavos,0))}
      {fixedValues && <> · Valor de Origem {money(toPaymentCents(total!))}</>}
    </p>}
    {fixedValues
      ? <p className="text-sm text-muted-foreground">Os valores importados já incluem a correção. {plan.correcao!=="Sem reajuste" && `Índice contratual: ${plan.correcao}.`}</p>
      : plan.correcao!=="Sem reajuste" && <p className="text-sm text-muted-foreground">Valores-base. Correção contratual por {plan.correcao}.</p>}
    {(error || (budget.planoPagamento && invalid)) && <p role="status" className="text-sm text-muted-foreground">{error || invalid}</p>}
    <Button type="button" disabled={!rows.length || (fixedValues!==undefined && draft!==null)} onClick={()=>{
      if(budget.capex.some(item=>!item.geradoDoPlano && item.valor===total && item.pagamentos.some(row=>row.valor))) {
        setError("Há um investimento manual com o mesmo valor do plano. Revise esses pagamentos antes de gerar para evitar duplicidade.");return;
      }
      if(budget.capex.some(item=>item.geradoDoPlano) && !window.confirm("Substituir os pagamentos previstos gerados por este plano?"))return;
      try {onChange(applyPaymentPlan(budget,plan,total!));setError("");}
      catch(e){setError(e instanceof Error?e.message:"Não foi possível gerar o plano.");}
    }}>Gerar pagamentos previstos no CAPEX</Button>
  </section>;
}
