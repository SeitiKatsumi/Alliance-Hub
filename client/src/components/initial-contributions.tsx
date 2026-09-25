import { useEffect, useMemo, useState } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { buildNominalSchedule, copyParticipantSchedule, type InitialCommitment, type ScheduleSeries } from "@shared/initial-contributions";

const periods = [[0,"À vista / personalizada"],[1,"Mensal"],[2,"Bimestral"],[3,"Trimestral"],[6,"Semestral"],[12,"Anual"]] as const;

export function InitialContributions({biaId,membros,readOnly=false}: {biaId:string;readOnly?:boolean;membros:Array<{id:string;nome?:string|null;Nome_de_usuario?:string|null}>}) {
  const url=`/api/bias/${biaId}/aportes-iniciais`;
  const {toast}=useToast();
  const query=useQuery<any>({queryKey:[url],queryFn:async()=>(await apiRequest("GET",url)).json()});
  const [items,setItems]=useState<InitialCommitment[]>([]);
  const [modalidade,setModalidade]=useState("capital_proprio");
  const [dirty,setDirty]=useState(false);
  const [preview,setPreview]=useState(false);
  const [settlement,setSettlement]=useState<{id:string;status:string}|null>(null);
  const [reason,setReason]=useState("");
  const [date,setDate]=useState("");
  const [base,setBase]=useState<{revisao:number;revisaoMap:number}>();
  useUnsavedChanges(dirty || !!settlement);
  useEffect(()=>{if(query.data && !dirty){setItems(query.data.compromissos);setModalidade(query.data.modalidade);setBase({revisao:query.data.revisao,revisaoMap:query.data.revisaoMap});}},[query.data,dirty]);
  const update=(index:number,patch:Partial<InitialCommitment>)=>{setDirty(true);setPreview(false);setItems(rows=>rows.map((c,i)=>{
    if(i===index)return {...c,...patch};
    const source=rows[index];
    if(source.componente==="capital" && c.componente==="contribuicao" && c.participanteId===source.participanteId && patch.series && (!c.series.length || JSON.stringify(c.series)===JSON.stringify(copyParticipantSchedule(c.valor,source.valor,source.series)))) return {...c,series:copyParticipantSchedule(c.valor,source.valor,patch.series)};
    return c;
  }));};
  const series=(index:number,position:number,patch:Partial<ScheduleSeries>)=>update(index,{series:items[index].series.map((s,i)=>i===position?{...s,...patch}:s)});
  const validation=useMemo(()=>{try{return {rows:items.map(c=>({c,parcelas:buildNominalSchedule(c.valor,c.series)})),error:""};}catch(e:any){return{rows:[],error:e.message};}},[items]);
  const refresh=()=>{setDirty(false);setPreview(false);queryClient.invalidateQueries({queryKey:[url]});queryClient.invalidateQueries({queryKey:["/api/fluxo-caixa"]});queryClient.invalidateQueries({queryKey:["/api/bias",biaId,"map"]});};
  const save=useMutation({mutationFn:async()=>apiRequest("PUT",url,{revisaoEsperada:base?.revisao,revisaoMap:base?.revisaoMap,modalidade,compromissos:items}),onSuccess:()=>{refresh();toast({title:"Cronograma salvo",description:"Nenhum lançamento foi criado. Revise a prévia antes de confirmar."});},onError:(e:any)=>toast({title:"Não foi possível salvar",description:e.message,variant:"destructive"})});
  const confirm=useMutation({mutationFn:async()=>apiRequest("POST",`${url}/confirmar`,{revisaoEsperada:query.data.revisao}),onSuccess:()=>{refresh();toast({title:"Cronogramas confirmados"});},onError:(e:any)=>{refresh();toast({title:"Confirmação pendente",description:e.message,variant:"destructive"});}});
  const settle=useMutation({mutationFn:async()=>apiRequest("PATCH",`${url}/parcelas/${settlement!.id}`,{revisaoEsperada:query.data.revisao,status:settlement!.status,motivo:reason,dataPagamento:date}),onSuccess:()=>{refresh();setSettlement(null);setReason("");},onError:(e:any)=>{refresh();toast({title:"Não foi possível integralizar",description:e.message,variant:"destructive"});}});
  if(query.isLoading)return <p>Carregando compromissos…</p>;
  if(query.isError)return <p role="alert">Não foi possível consultar os aportes. <Button variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></p>;
  const editable=!readOnly && query.data?.canEdit && query.data.estado!=="pendente";
  const money = (n: number) => n.toLocaleString("pt-BR",{style:"currency",currency:query.data.moeda || "BRL"});
  return <Card id="aportes-iniciais"><CardHeader><CardTitle>Aportes e parcelas</CardTitle><p className="text-sm text-muted-foreground">Cronograma nominal, sem reajuste automático por IGP-M. Quitar o aporte inicial não acrescenta CPP.</p></CardHeader><CardContent className="space-y-5 min-w-0">
    {query.data.revisaoMapSalva!==query.data.revisaoMap && query.data.revisao>0 && <div role="alert" className="rounded border border-amber-300 p-3 text-sm">O MAP Inicial mudou. <Button disabled={!editable} variant="outline" onClick={()=>{setItems(query.data.esperados.map((e:InitialCommitment)=>({...e,series:items.find(c=>c.chave===e.chave)?.series || []})));setDirty(true);}}>Atualizar compromissos</Button></div>}
    {query.data.estado==="pendente" && <p role="alert" className="text-amber-700">Conciliação pendente. A confirmação pode ser repetida sem duplicar parcelas.</p>}
    <fieldset disabled={!editable || save.isPending || confirm.isPending} className="space-y-4 min-w-0">
      <label className="block text-sm">Forma de capitalização<select className="block w-full rounded border bg-background p-2 sm:max-w-sm" value={modalidade} onChange={e=>{setModalidade(e.target.value);setDirty(true);}}><option value="capital_proprio">Capital próprio</option><option value="consorcio">Consórcio</option><option value="financiamento">Financiamento</option></select></label>
      {items.map((c,index)=><section key={c.chave} className="rounded-lg border p-3 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{c.nome} · {c.componente==="ativo"?"Ativo":c.componente==="capital"?"Capital comprometido":"Contribuição econômica"}</h3><strong>{money(c.valor)}</strong></div><p className="text-xs text-muted-foreground">{c.natureza==="caixa"?"Movimentação de dinheiro":"Sem movimentação de caixa"}{c.tipoCpp?` · ${c.tipoCpp.nome}`:""}</p>
        <label className="block text-sm">Beneficiário<select className="block w-full rounded border p-2 bg-background" disabled={c.componente!=="ativo" && !!c.beneficiario} value={c.beneficiario} onChange={e=>update(index,{beneficiario:e.target.value})}><option value="">Selecione</option>{membros.map(m=><option key={m.id} value={m.id}>{m.nome || m.Nome_de_usuario || m.id}</option>)}</select></label>
        {c.series.map((s,position)=><div key={position} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 items-end"><label className="text-xs">Total da série<Input type="number" min="0.01" step="0.01" value={s.total || ""} onChange={e=>series(index,position,{total:Number(e.target.value)})}/></label><label className="text-xs">Quantidade<Input type="number" min="1" max="360" value={s.quantidade} onChange={e=>series(index,position,{quantidade:Number(e.target.value)})}/></label><label className="text-xs">Periodicidade<select className="w-full rounded border bg-background p-2" value={s.meses} onChange={e=>series(index,position,{meses:Number(e.target.value),...(e.target.value==="0"?{quantidade:1}:{})})}>{periods.map(([n,label])=><option value={n} key={n}>{label}</option>)}</select></label><label className="text-xs">Primeiro vencimento<Input type="date" value={s.primeiroVencimento} onChange={e=>series(index,position,{primeiroVencimento:e.target.value})}/></label><Button variant="outline" onClick={()=>update(index,{series:c.series.filter((_,i)=>i!==position)})}>Remover série</Button></div>)}
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>update(index,{series:[...c.series,{total:Math.max(0,c.valor-c.series.reduce((sum,s)=>sum+s.total,0)),quantidade:1,meses:0,primeiroVencimento:""}]})}>Adicionar sinal / série</Button>{c.componente==="contribuicao" && <Button variant="outline" onClick={()=>{const source=items.find(i=>i.participanteId===c.participanteId&&i.componente==="capital");if(source?.series.length){const copied=copyParticipantSchedule(c.valor,source.valor,source.series);update(index,{series:copied});}}}>Usar cronograma do participante</Button>}</div>
      </section>)}
      {validation.error && <p className="text-sm text-amber-700">{validation.error}</p>}
      {editable && <Button disabled={!!validation.error || !items.length || !dirty || save.isPending} onClick={()=>save.mutate()}>Salvar cronogramas</Button>}
    </fieldset>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!validation.error} onClick={()=>setPreview(!preview)}>Ver prévia completa</Button>{!readOnly && query.data.canEdit && <Button disabled={dirty || !query.data.revisao || confirm.isPending || query.data.revisaoMapSalva!==query.data.revisaoMap || (query.data.estado!=="pendente" && !preview)} onClick={()=>confirm.mutate()}>{confirm.isPending?"Confirmando…":query.data.estado==="pendente"?"Retomar confirmação":"Confirmar cronogramas"}</Button>}</div>
    {preview && validation.rows.map(({c,parcelas})=><details key={c.chave} className="rounded border p-3"><summary>{c.nome} · {c.componente} · {parcelas.length} parcelas · {money(c.valor)}</summary><div className="max-h-64 overflow-auto text-sm">{parcelas.map(p=><p key={p.numero} className="flex justify-between gap-2 py-1"><span>{p.numero} · {p.vencimento}</span><span>{money(p.valor)}</span></p>)}</div></details>)}
    <h3 className="font-semibold">Integralização por componente</h3><div className="grid gap-3 sm:grid-cols-2">{query.data.resumo.map((c:any)=><div key={c.chave} className="rounded border p-3 text-sm"><strong>{c.nome} · {c.tipoCpp?.nome || c.componente}</strong><p>Comprometido: {money(c.valor)}</p><p>Integralizado: {money(c.integralizado)}</p><p>Saldo: {money(c.saldo)}</p><p className="text-xs">{c.natureza==="caixa"?"Dinheiro":"Patrimonial, sem caixa"}</p></div>)}</div>
    <details className="rounded border p-3"><summary>Parcelas e integralizações ({query.data.parcelas.filter((p:any)=>p.vigente).length})</summary><div className="max-h-96 overflow-auto space-y-2 mt-3">{query.data.parcelas.filter((p:any)=>p.vigente).map((p:any)=><div key={p.id} className="rounded border p-3 text-sm flex flex-wrap justify-between gap-3"><div><strong>{items.find(c=>c.chave===p.chave)?.nome} · parcela {p.numero}</strong><p>{String(p.vencimento).slice(0,10)} · {money(p.valor)} · {p.status}</p></div>{editable && <Button variant="outline" disabled={p.pendente} onClick={()=>{setSettlement({id:p.id,status:p.liquidado?"agendado":"pago"});setReason("");setDate("");}}>{p.liquidado?"Reverter integralização":"Registrar integralização"}</Button>}</div>)}</div></details>
    <details className="rounded border p-3"><summary>Histórico patrimonial das parcelas</summary><div className="max-h-96 overflow-auto space-y-2 mt-3">{query.data.parcelas.map((p:any)=><section key={p.id} className="rounded border p-3 text-sm"><strong>Revisão {p.revisao} · parcela {p.numero} · {money(p.valor)}</strong><p>{p.natureza==="nao_caixa"?"Sem movimentação de caixa":"Dinheiro"} · {p.vigente?"Vigente":"Substituída"}</p>{p.historico.map((h:any,index:number)=><p key={index} className="break-words mt-2">{new Date(h.data).toLocaleString("pt-BR")} · {h.autor?.membroId || h.autor?.userId || "Sistema"} · {h.motivo || (h.acao==="gerado"?"Cronograma confirmado":"Cronograma revisado")}</p>)}</section>)}</div></details>
    {settlement && <div role="region" aria-label="Confirmar integralização" className="rounded border p-4 space-y-3"><p>Esta operação atualiza a parcela e seu par, se houver. Não executa transferência bancária.</p><label className="block text-sm">Motivo<Input value={reason} onChange={e=>setReason(e.target.value)}/></label>{settlement.status==="pago" && <label className="block text-sm">Data da integralização<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}<div className="flex gap-2"><Button disabled={!reason.trim() || (settlement.status==="pago"&&!date) || settle.isPending} onClick={()=>settle.mutate()}>Confirmar</Button><Button variant="outline" onClick={()=>setSettlement(null)}>Cancelar</Button></div></div>}
  </CardContent></Card>;
}
