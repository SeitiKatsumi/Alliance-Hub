import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BIA_PHASES, biaPhaseLabel } from "@shared/bia-phase";
import { BiaNumberInput } from "./bia-role-composition";
import { biaPhaseProgressSchema, type BiaPhaseProgress } from "@shared/bia-phase-progress";

export function BiaPhaseProgressSummary({progress}:{progress:BiaPhaseProgress}) {
  return <section aria-label="Condições para avançar de fase" className="space-y-3">
    <h3 className="text-sm font-semibold">{progress.nextPhase ? `Próxima fase: ${BIA_PHASES[progress.nextPhase as keyof typeof BIA_PHASES]}` : "Situação da fase"}</h3>
    {!!progress.checks.length && <ul className="space-y-2 text-sm">{progress.checks.map(check=><li key={check.id} className="flex items-start gap-2">
      <span aria-hidden="true" className={check.met ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{check.met ? "✓" : "○"}</span>
      <div className="min-w-0 break-words"><span>{check.label}</span><span className="ml-2 text-muted-foreground">{check.met ? "Concluído" : "Pendente"}</span>{check.detail && <p className="mt-1 text-muted-foreground">{check.detail}</p>}</div>
    </li>)}</ul>}
    {progress.ready && <p className="text-sm text-emerald-600 dark:text-emerald-400">{progress.mode==="automatic" ? "Condições concluídas · aguardando avanço automático." : "Condições concluídas · aguardando a transição registrada."}</p>}
    {!progress.nextPhase && !progress.checks.length && <p className="text-sm text-muted-foreground">{progress.phase==="encerrada" ? "BIA encerrada." : "Sem próxima fase automática."}</p>}
  </section>;
}

export function BiaPhaseControls({id,phase,canEdit}:{id:string;phase:string;canEdit:boolean}){
  const [action,setAction]=useState(""),[reason,setReason]=useState(""),[target,setTarget]=useState("em_execucao"),[value,setValue]=useState(NaN),[key,setKey]=useState(crypto.randomUUID());
  const [open,setOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false);
  const progress=useQuery({queryKey:["/api/bias",id,"fase-requisitos",phase],enabled:open,queryFn:async()=>{
    const response=await fetch(`/api/bias/${id}/fase-requisitos`,{credentials:"include",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error("Requisitos indisponíveis");
    const result=biaPhaseProgressSchema.parse(await response.json());
    if(result.phase!==phase)void queryClient.invalidateQueries({queryKey:["/api/bias"]});
    return result;
  },retry:false,staleTime:0,refetchOnWindowFocus:true,refetchInterval:open?30000:false,refetchIntervalInBackground:false});
  const history=useQuery<any[]>({queryKey:["/api/bias",id,"fases"],enabled:open && historyOpen,staleTime:0,refetchOnWindowFocus:true});
  const recover=useMutation({mutationFn:async(eventId:string)=>{await apiRequest("POST",`/api/bias/${id}/fases`,{acao:"retomar",chaveEvento:eventId});},onSuccess:()=>queryClient.invalidateQueries({queryKey:["/api/bias"]})});
  const save=useMutation({mutationFn:async()=>{
    if(!window.confirm("Confirmar esta deliberação? A alteração será registrada no histórico."))return false;
    await apiRequest("POST",`/api/bias/${id}/fases`,{acao:action,motivo:reason,chaveEvento:key,fase:target,faseEsperada:phase,valorResultado:value,confirmar:true});return true;
  },onSuccess:confirmed=>{if(confirmed){setAction("");setReason("");setKey(crypto.randomUUID());queryClient.invalidateQueries({queryKey:["/api/bias"]});}}});
  return <details onToggle={e=>setOpen(e.currentTarget.open)} className="rounded-lg border bg-background p-4"><summary className="cursor-pointer text-sm font-medium">Fase: {biaPhaseLabel(phase)} · condições para avançar</summary><div className="mt-4 space-y-3">
    {progress.isError ? <div role="alert" className="text-sm">Não foi possível consultar as condições da fase. <Button variant="outline" onClick={()=>progress.refetch()}>Tentar novamente</Button></div> : progress.data ? <BiaPhaseProgressSummary progress={progress.data}/> : <p role="status" className="text-sm text-muted-foreground">Consultando condições…</p>}
    <details onToggle={e=>{e.stopPropagation();setHistoryOpen(e.currentTarget.open);}} className="border-t pt-3"><summary className="cursor-pointer text-sm">Histórico e deliberações</summary><div className="mt-3 space-y-3">
    {canEdit && phase!=="encerrada" && <><select aria-label="Deliberação de fase" className="h-10 w-full rounded border bg-background px-2" value={action} onChange={e=>{setAction(e.target.value);setKey(crypto.randomUUID());}}><option value="">Escolha uma ação</option>{phase==="ativa" && <option value="revisao_legada">Revisar fase da BIA antiga</option>}{phase==="em_operacao" && <option value="resultado_aprovado">Aprovar resultado para distribuição</option>}<option value="encerramento">Encerrar BIA</option></select>
      {!!action && <><label className="block text-sm">Motivo e referência da deliberação<Input value={reason} onChange={e=>setReason(e.target.value)}/></label>{action==="revisao_legada" && <select aria-label="Fase revisada" className="h-10 w-full rounded border bg-background px-2" value={target} onChange={e=>setTarget(e.target.value)}>{["em_execucao","em_operacao","em_distribuicao"].map(p=><option key={p} value={p}>{BIA_PHASES[p as keyof typeof BIA_PHASES]}</option>)}</select>}{action==="resultado_aprovado" && <label className="block text-sm">Resultado aprovado<BiaNumberInput label="Resultado aprovado" value={value} onChange={setValue}/></label>}<Button disabled={save.isPending || !reason.trim() || (action==="resultado_aprovado" && !(value>0))} onClick={()=>save.mutate()}>Registrar deliberação</Button></>}
    </>}
    {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
    {recover.isError && <p role="alert">{recover.error.message}</p>}
    {history.isError && <p role="alert">Histórico indisponível. <Button variant="outline" onClick={()=>history.refetch()}>Tentar novamente</Button></p>}
    {history.data?.map((e,i)=><div key={i} className="border-t pt-2 text-sm">{biaPhaseLabel(e.fase_anterior)} → {biaPhaseLabel(e.fase)} · {new Date(e.criado_em).toLocaleString("pt-BR")} · {e.motivo}{!e.aplicado && <> · Conciliação pendente {canEdit && <Button variant="outline" disabled={recover.isPending} onClick={()=>recover.mutate(e.evento_id)}>Retomar transição</Button>}</>}</div>)}
    </div></details>
  </div></details>;
}
