import type { BiaSetup } from '@shared/bia-setup';
import { BUDGET_COST_STATES, emptyBiaBudget, projectBiaBudget, type BiaBudget } from '@shared/bia-budget';
import { BiaNumberInput } from './bia-role-composition';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

const css='min-h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
const card='min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5';
const uid=()=>crypto.randomUUID();
const amount=(value:number)=>Number.isFinite(value)?value:null;
type Props={value:BiaSetup;moeda:string;valorOrigem?:number|null};

export function BiaBudgetFields({value,onChange,moeda,valorOrigem,disabled=false}:Props & {onChange:(value:BiaSetup)=>void;disabled?:boolean}) {
  const b=value.orcamento ?? emptyBiaBudget(moeda);
  const update=(changes:Partial<BiaBudget>)=>onChange({...value,orcamento:{...b,...changes}});
  const patchCap=(id:string,changes:Partial<BiaBudget['capex'][number]>)=>update({capex:b!.capex.map(c=>c.id===id?{...c,...changes}:c)});
  const patchOp=(id:string,changes:Partial<BiaBudget['opex'][number]>)=>update({opex:b!.opex.map(c=>c.id===id?{...c,...changes}:c)});
  const asset=(item:{ativoId:string;ativoNome:string},change:(patch:{ativoId:string;ativoNome:string})=>void)=><label className="min-w-0">Ativo<select className={css} value={item.ativoId} onChange={e=>change({ativoId:e.target.value,ativoNome:value.ativos.find(a=>a.id===e.target.value)?.nome || ''})}><option value="">Geral da BIA</option>{item.ativoId && !value.ativos.some(a=>a.id===item.ativoId) && <option value={item.ativoId}>{item.ativoNome || 'Ativo removido'} — revisar vínculo</option>}{value.ativos.map(a=><option key={a.id} value={a.id}>{a.nome || 'Ativo sem nome'}</option>)}</select></label>;
  const state=(current:typeof BUDGET_COST_STATES[number],change:(s:typeof current)=>void)=><label>Situação<select className={css} value={current} onChange={e=>change(e.target.value as typeof current)}>{BUDGET_COST_STATES.map(s=><option key={s}>{s}</option>)}</select></label>;
  const remove=(label:string,action:()=>void)=><AlertDialog>
    <AlertDialogTrigger asChild><Button type="button" variant="ghost" className="text-destructive" disabled={disabled}>Remover {label}</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Remover {label}?</AlertDialogTitle><AlertDialogDescription>A alteração só será gravada ao salvar o orçamento. Os outros itens serão mantidos.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel type="button">Cancelar</AlertDialogCancel><AlertDialogAction type="button" disabled={disabled} onClick={()=>{if(!disabled)action();}}>Confirmar remoção</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return <section className="min-w-0 space-y-5"><h2 className="text-xl font-semibold">CAPEX e OPEX</h2><p className="text-sm text-muted-foreground">Preenchimento opcional. Informe o que já souber e continue; você pode completar o orçamento depois. Não gera lançamentos, cobranças ou alterações na BEI e no MAP.</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <div className={card}><div className="grid gap-4 sm:grid-cols-3"><label>Mês inicial<Input type="month" value={b.inicio} onChange={e=>update({inicio:e.target.value})}/></label><label>Horizonte (meses)<Input type="number" min={1} max={120} value={b.meses} onChange={e=>update({meses:Math.min(120,Math.max(1,Number(e.target.value)||1))})}/></label><div><p>Moeda do orçamento</p><strong>{b.moeda}</strong></div></div>{b.moeda!==moeda && <p role="alert" className="text-amber-800">A BIA está em {moeda}. Estes valores continuam em {b.moeda}; não há conversão automática e a comparação está suspensa.</p>}</div>
      <section className={card}><h3 className="text-lg font-semibold">1. CAPEX — investimentos previstos</h3><p className="text-sm text-muted-foreground">Ex.: aquisição do ativo, adequações e obras, instalações e equipamentos.</p>
        <ul aria-label="Investimentos CAPEX" className="divide-y border-y">
        {b.capex.map((c,i)=><li key={c.id} aria-label={`CAPEX ${i+1}`} className="grid min-w-0 gap-x-3 gap-y-2 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_auto]"><div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"><label className="min-w-0 sm:col-span-2 lg:col-span-1">Rubrica<Input maxLength={4000} placeholder="Ex.: Adequações e obras" value={c.descricao} onChange={e=>patchCap(c.id,{descricao:e.target.value})}/></label><label className="min-w-0">Valor previsto ({b.moeda})<BiaNumberInput label={`Valor CAPEX ${i+1}`} value={c.valor ?? NaN} onChange={v=>patchCap(c.id,{valor:amount(v)})}/></label>{state(c.situacao,situacao=>patchCap(c.id,{situacao}))}</div>
          <details className="min-w-0 lg:col-span-2"><summary className="cursor-pointer py-1 font-medium">Pagamentos previstos ({c.pagamentos.length}) e ativo</summary><div className="mt-3 space-y-3 rounded-md bg-muted/30 p-3"><div className="max-w-md">{asset(c,p=>patchCap(c.id,p))}</div>
          <h4 className="font-medium">Pagamentos previstos</h4>{c.pagamentos.map((p,j)=><div key={p.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><label>Mês do pagamento<Input aria-label={`Mês CAPEX ${i+1} pagamento ${j+1}`} type="month" value={p.mes} onChange={e=>patchCap(c.id,{pagamentos:c.pagamentos.map(r=>r.id===p.id?{...r,mes:e.target.value}:r)})}/></label><label>Valor ({b.moeda})<BiaNumberInput label={`Valor CAPEX ${i+1} pagamento ${j+1}`} value={p.valor ?? NaN} onChange={v=>patchCap(c.id,{pagamentos:c.pagamentos.map(r=>r.id===p.id?{...r,valor:amount(v)}:r)})}/></label>{remove('pagamento',()=>patchCap(c.id,{pagamentos:c.pagamentos.filter(r=>r.id!==p.id)}))}</div>)}
          <Button type="button" variant="outline" disabled={c.pagamentos.length>=120} onClick={()=>patchCap(c.id,{pagamentos:[...c.pagamentos,{id:uid(),mes:'',valor:null}]})}>Adicionar pagamento</Button></div></details>
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">{remove('investimento',()=>update({capex:b.capex.filter(r=>r.id!==c.id)}))}</div>
        </li>)}
        </ul>
        <Button type="button" variant="outline" disabled={b.capex.length>=200} onClick={()=>update({capex:[...b.capex,{id:uid(),descricao:'',valor:null,situacao:'Estimativa',ativoId:'',ativoNome:'',pagamentos:[{id:uid(),mes:'',valor:null}]}]})}>Adicionar investimento</Button>
      </section>
      <section className={card}><h3 className="text-lg font-semibold">2. OPEX — despesas de funcionamento</h3><p className="text-sm text-muted-foreground">Ex.: contabilidade, jurídico recorrente e licença da plataforma. Recorrência mensal, sem reajuste automático; sem mês final, segue até o fim do horizonte.</p>
        <ul aria-label="Despesas OPEX" className="divide-y border-y">
        {b.opex.map((o,i)=><li key={o.id} aria-label={`OPEX ${i+1}`} className="grid min-w-0 gap-x-3 gap-y-2 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_auto]"><div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"><label className="min-w-0">Despesa<Input maxLength={4000} placeholder="Ex.: Contabilidade" value={o.descricao} onChange={e=>patchOp(o.id,{descricao:e.target.value})}/></label><label className="min-w-0">Valor mensal ({b.moeda})<BiaNumberInput label={`Valor OPEX ${i+1}`} value={o.valorMensal ?? NaN} onChange={v=>patchOp(o.id,{valorMensal:amount(v)})}/></label><label className="min-w-0">Início<Input aria-label={`Início OPEX ${i+1}`} type="month" value={o.inicio} onChange={e=>patchOp(o.id,{inicio:e.target.value})}/></label>{state(o.situacao,situacao=>patchOp(o.id,{situacao}))}</div>
          <details className="min-w-0 lg:col-span-2"><summary className="cursor-pointer py-1 font-medium">Fim e ativo</summary><div className="mt-3 grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2"><label className="min-w-0">Fim (opcional)<Input aria-label={`Fim OPEX ${i+1}`} type="month" value={o.fim} onChange={e=>patchOp(o.id,{fim:e.target.value})}/></label>{asset(o,p=>patchOp(o.id,p))}</div></details>
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">{remove('despesa',()=>update({opex:b.opex.filter(r=>r.id!==o.id)}))}</div>
        </li>)}
        </ul>
        <Button type="button" variant="outline" disabled={b.opex.length>=200} onClick={()=>update({opex:[...b.opex,{id:uid(),descricao:'',valorMensal:null,inicio:'',fim:'',situacao:'Estimativa',ativoId:'',ativoNome:''}]})}>Adicionar despesa</Button>
      </section>
    </fieldset>
    <BiaBudgetSummary value={value} moeda={moeda} valorOrigem={valorOrigem} details={false}/>
  </section>;
}

export function BiaBudgetSummary({value,moeda,valorOrigem,details=true}:Props & {details?:boolean}) {
  const b=value.orcamento, projection=projectBiaBudget(b,moeda,value.ativos,valorOrigem);
  const money=(v:number|null|undefined,currency=b?.moeda || moeda)=>v==null || !Number.isFinite(v)?'Pendente':v.toLocaleString('pt-BR',{style:'currency',currency});
  const assetName=(item:{ativoId:string;ativoNome:string})=>item.ativoId?(value.ativos.find(a=>a.id===item.ativoId)?.nome || `${item.ativoNome || 'Ativo'} (vínculo a revisar)`):'Geral da BIA';
  return <section data-pdf-section="orcamento" className={card}><h2 className="text-xl font-semibold">CAPEX e OPEX — resumo</h2><p className="text-sm text-muted-foreground">Planejamento, não saldo bancário. Confirmações são informadas pelo responsável, sem validação bancária. Pendências não impedem a conclusão.</p>
    {b && <><p>{b.inicio || 'Início pendente'} · {b.meses} meses · {b.moeda}{projection.partial?' · Totais parciais / dados pendentes':''}</p><dl className="grid gap-2 text-sm sm:grid-cols-2"><dt>Valor de Origem — referência, não caixa</dt><dd>{money(valorOrigem,moeda)}</dd><dt>CAPEX previsto — todos os investimentos</dt><dd>{money(projection.capex)}</dd><dt>Diferença indicativa CAPEX − origem</dt><dd>{money(projection.diferenca)} · Não equivale à falta de caixa</dd><dt>OPEX projetado no horizonte</dt><dd>{money(projection.opex)}</dd></dl>
      {details && <><h3 className="font-semibold">Investimentos previstos</h3>{b.capex.map(c=><div key={c.id} className="border-b py-2"><p>{c.descricao || 'Sem descrição'} · {money(c.valor)} · {c.situacao} · {assetName(c)}</p><p>Pagamentos: {c.pagamentos.map(p=>`${p.mes || 'Mês pendente'}: ${money(p.valor)}`).join(' / ') || 'Não informados'}</p></div>)}<h3 className="font-semibold">Despesas de funcionamento</h3>{b.opex.map(o=><p key={o.id}>{o.descricao || 'Sem descrição'} · {money(o.valorMensal)}/mês · {o.inicio || 'Início pendente'} até {o.fim || 'fim do horizonte'} · {o.situacao} · {assetName(o)}</p>)}<h3 className="font-semibold">Origem dos recursos</h3>{b.fontes.map(f=><p key={f.id}>{f.descricao || 'Sem descrição'} · {f.tipo} · {money(f.valor)} · {f.mes || 'Mês pendente'} · {f.situacao} · {f.destinacao}{f.observacoes?` · ${f.observacoes}`:''}</p>)}</>}
      <h3 className="font-semibold">Cronograma mensal e cobertura acumulada</h3><p className="text-sm text-muted-foreground">Necessidade não coberta considera despesas e recursos desde o início do horizonte. Fontes restritas cobrem apenas sua categoria; sobras são carregadas. O cenário total inclui confirmadas, estimadas e condicionadas, sem duplicar recursos.{projection.partial?' Valores conhecidos são parciais; não atestam cobertura completa.':''}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="bg-muted text-left">{['Mês','CAPEX','OPEX','Recursos confirmados','Estimados / condicionados','Não coberto — confirmados','Não coberto — todas as previsões'].map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{projection.rows.map(r=><tr key={r.mes} className="border-b"><th className="p-2 text-left">{r.mes}</th>{[r.capex,r.opex,r.confirmadas,r.condicionadas,r.descobertoConfirmado,r.descobertoPrevisto].map((v,i)=><td key={i} className="p-2">{money(v)}</td>)}</tr>)}</tbody></table></div>
    </>}
    {details && projection.warnings.length>0 && <div role="status" className="space-y-1 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><h3 className="font-semibold">Pendências e avisos</h3>{projection.warnings.map(w=><p key={w}>{w}</p>)}</div>}
  </section>;
}
