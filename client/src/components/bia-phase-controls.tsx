import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BIA_PHASES, biaPhaseLabel } from "@shared/bia-phase";
import { BiaNumberInput } from "./bia-role-composition";

export function BiaPhaseControls({id,phase,canEdit}:{id:string;phase:string;canEdit:boolean}){
  const [action,setAction]=useState(""),[reason,setReason]=useState(""),[target,setTarget]=useState("em_execucao"),[value,setValue]=useState(NaN),[key,setKey]=useState(crypto.randomUUID());
  const history=useQuery<any[]>({queryKey:["/api/bias",id,"fases"]});
  const recover=useMutation({mutationFn:async(eventId:string)=>{await apiRequest("POST",`/api/bias/${id}/fases`,{acao:"retomar",chaveEvento:eventId});},onSuccess:()=>queryClient.invalidateQueries({queryKey:["/api/bias"]})});
  const save=useMutation({mutationFn:async()=>{
    if(!window.confirm("Confirmar esta deliberação? A alteração será registrada no histórico."))return false;
    await apiRequest("POST",`/api/bias/${id}/fases`,{acao:action,motivo:reason,chaveEvento:key,fase:target,faseEsperada:phase,valorResultado:value,confirmar:true});return true;
  },onSuccess:confirmed=>{if(confirmed){setAction("");setReason("");setKey(crypto.randomUUID());queryClient.invalidateQueries({queryKey:["/api/bias"]});}}});
  return <details className="rounded-lg border bg-background p-4"><summary className="cursor-pointer text-sm font-medium">Fase: {biaPhaseLabel(phase)} · histórico e deliberações</summary><div className="mt-4 space-y-3">
    <p className="text-sm text-muted-foreground">As fases avançam após os eventos validados. Receber receita não aprova uma distribuição automaticamente.</p>
    {canEdit && phase!=="encerrada" && <><select aria-label="Deliberação de fase" className="h-10 w-full rounded border bg-background px-2" value={action} onChange={e=>{setAction(e.target.value);setKey(crypto.randomUUID());}}><option value="">Escolha uma ação</option>{phase==="ativa" && <option value="revisao_legada">Revisar fase da BIA antiga</option>}{phase==="em_operacao" && <option value="resultado_aprovado">Aprovar resultado para distribuição</option>}<option value="encerramento">Encerrar BIA</option></select>
      {!!action && <><label className="block text-sm">Motivo e referência da deliberação<Input value={reason} onChange={e=>setReason(e.target.value)}/></label>{action==="revisao_legada" && <select aria-label="Fase revisada" className="h-10 w-full rounded border bg-background px-2" value={target} onChange={e=>setTarget(e.target.value)}>{["em_execucao","em_operacao","em_distribuicao"].map(p=><option key={p} value={p}>{BIA_PHASES[p as keyof typeof BIA_PHASES]}</option>)}</select>}{action==="resultado_aprovado" && <label className="block text-sm">Resultado aprovado<BiaNumberInput label="Resultado aprovado" value={value} onChange={setValue}/></label>}<Button disabled={save.isPending || !reason.trim() || (action==="resultado_aprovado" && !(value>0))} onClick={()=>save.mutate()}>Registrar deliberação</Button></>}
    </>}
    {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
    {recover.isError && <p role="alert">{recover.error.message}</p>}
    {history.isError && <p role="alert">Histórico indisponível. <Button variant="outline" onClick={()=>history.refetch()}>Tentar novamente</Button></p>}
    {history.data?.map((e,i)=><div key={i} className="border-t pt-2 text-sm">{biaPhaseLabel(e.fase_anterior)} → {biaPhaseLabel(e.fase)} · {new Date(e.criado_em).toLocaleString("pt-BR")} · {e.motivo}{!e.aplicado && <> · Conciliação pendente {canEdit && <Button variant="outline" disabled={recover.isPending} onClick={()=>recover.mutate(e.evento_id)}>Retomar transição</Button>}</>}</div>)}
  </div></details>;
}
