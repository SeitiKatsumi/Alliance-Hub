import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateAgendaAlertQueries } from "@/lib/agenda-alerts";
import { useToast } from "@/hooks/use-toast";

type Candidate = {
  id: string;
  membro_id: string | null;
  membro_nome: string | null;
  mensagem: string | null;
  criado_em: string;
  oferta_revisao?: number | null;
  vaga_status: "pendente" | "aprovada" | "recusada" | "vaga_preenchida";
};
type Vacancy = { id: string; numero: number; aberta: boolean; conviteDisponivel?: boolean; candidatos: Candidate[] };
const label = {pendente:"Aguardando decisão",aprovada:"Aprovada",recusada:"Recusada",vaga_preenchida:"Cota preenchida"};

export function BiaVacancyInterests({biaId,standalone=false}: {biaId:string;standalone?:boolean}) {
  const {toast}=useToast();
  const vacancy = new URLSearchParams(window.location.search).get("vaga");
  const [selected,setSelected]=useState<string | null>(vacancy);
  const endpoint="/api/bias/"+encodeURIComponent(biaId)+"/vagas-interesses";
  const key=[endpoint];
  const query=useQuery<Vacancy[]>({queryKey:key,queryFn:async()=>{
    const response=await fetch(endpoint,{credentials:"include"});
    if(response.status===403)return [];
    if(!response.ok)throw new Error("Não foi possível carregar as manifestações.");
    return response.json();
  }});
  const mutation=useMutation({
    mutationFn:async ({id,decisao}:{id:string;decisao:"aprovar"|"recusar"})=>
      (await apiRequest("PATCH",endpoint+"/"+encodeURIComponent(id),{decisao})).json(),
    onSuccess:async (result)=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:key}),
        queryClient.invalidateQueries({queryKey:["/api/bias",biaId,"map-inicial"]}),
        invalidateAgendaAlertQueries(queryClient),
      ]);
      toast({title:result.inviteSync==="pending"?"Decisão registrada. Envio do convite pendente.":"Decisão registrada."});
    },
    onError:(error:Error)=>{
      void queryClient.invalidateQueries({queryKey:key});
      toast({title:"Não foi possível registrar a decisão",description:error.message,variant:"destructive"});
    },
  });
  useEffect(()=>{
    if(!vacancy || !query.data?.some(item=>item.id===vacancy))return;
    document.getElementById("candidaturas-"+vacancy)?.scrollIntoView({block:"center"});
  },[vacancy,query.data]);
  if(query.isError)return <Button type="button" variant="outline" onClick={()=>query.refetch()}>Recarregar manifestações de interesse</Button>;
  if(query.isPending)return standalone ? <p>Carregando manifestações de interesse…</p> : null;
  if(!query.data?.length)return standalone ? <p>Nenhuma manifestação disponível.</p> : null;
  return <section className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Manifestações de interesse nas cotas</h3>
    {query.data.map(vaga=><div key={vaga.id} id={"candidaturas-"+vaga.id} className="rounded-md border p-3">
      <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 whitespace-normal text-left" aria-expanded={selected===vaga.id} onClick={()=>setSelected(selected===vaga.id?null:vaga.id)}>
        {vaga.aberta?"Cota disponível "+(vaga.numero+1):"Cota encerrada"} · Ver candidaturas ({vaga.candidatos.length})
      </Button>
      {selected===vaga.id && <div className="space-y-3 pt-3">
        {!vaga.candidatos.length && <p className="text-sm text-muted-foreground">Nenhuma manifestação registrada.</p>}
        {vaga.candidatos.map(candidate=><article key={candidate.id} className="min-w-0 space-y-2 border-t pt-3">
          <p className="break-words font-medium">{candidate.membro_nome || "Membro BUILT"}</p>
          <p className="text-xs text-muted-foreground">{label[candidate.vaga_status]} · {new Date(candidate.criado_em).toLocaleDateString("pt-BR")}{candidate.oferta_revisao ? " · Oferta v"+candidate.oferta_revisao : ""}</p>
          {candidate.mensagem && <p className="whitespace-pre-wrap break-words text-sm">{candidate.mensagem}</p>}
          <div className="flex flex-wrap gap-2">
            {candidate.membro_id && <Button asChild variant="outline" size="sm"><a href={"/membro/"+encodeURIComponent(candidate.membro_id)} target="_blank" rel="noopener noreferrer">Ver perfil</a></Button>}
            {(vaga.aberta && candidate.vaga_status==="pendente" || vaga.conviteDisponivel!==false && candidate.vaga_status==="aprovada") && <Button type="button" size="sm" loading={mutation.isPending && mutation.variables?.id===candidate.id && mutation.variables?.decisao==="aprovar"} disabled={mutation.isPending} onClick={()=>{
              if(candidate.vaga_status==="aprovada" || window.confirm("Aprovar esta pessoa e encerrar as demais manifestações da vaga?"))mutation.mutate({id:candidate.id,decisao:"aprovar"});
            }}>{candidate.vaga_status==="aprovada"?"Verificar envio do convite":"Aprovar para a cota"}</Button>}
            {vaga.aberta && candidate.vaga_status==="pendente" && <Button type="button" size="sm" variant="outline" loading={mutation.isPending && mutation.variables?.id===candidate.id && mutation.variables?.decisao==="recusar"} disabled={mutation.isPending} onClick={()=>{if(window.confirm("Recusar esta manifestação?"))mutation.mutate({id:candidate.id,decisao:"recusar"});}}>Recusar</Button>}
          </div>
        </article>)}
      </div>}
    </div>)}
  </section>;
}
