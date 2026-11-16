import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchableNameSelect } from "@/components/searchable-name-select";

type Delivery = {
  id: string;
  membro_id: string;
  membro_nome: string;
  escopo: string;
  relato_entrega?: string;
  status: "em_acompanhamento" | "aguardando_aprovacao_cpp";
  criado_em: string;
  validado_em?: string | null;
};
type Member = { id:string; nome?:string; Nome_de_usuario?:string };

export function ObaDeliveries({opaId}: {opaId:string}) {
  const {toast}=useToast();
  const [newOpen,setNewOpen]=useState(false);
  const [member,setMember]=useState("");
  const [scope,setScope]=useState("");
  const [validating,setValidating]=useState<string | null>(null);
  const [report,setReport]=useState("");
  const endpoint="/api/rede/oportunidades/"+encodeURIComponent(opaId)+"/entregas";
  const query=useQuery<{entregas:Delivery[];editavel:boolean}>({queryKey:[endpoint]});
  const profiles=useQuery<Member[]>({queryKey:["/api/membros"],enabled:newOpen && !!query.data?.editavel});
  const save=useMutation({
    mutationFn:async(id:string | null)=>id
      ? apiRequest("PATCH",endpoint+"/"+encodeURIComponent(id)+"/validar",{relato_entrega:report})
      : apiRequest("POST",endpoint,{membro_id:member,escopo:scope}),
    onSuccess:async(_,id)=>{
      setNewOpen(false);setMember("");setScope("");setValidating(null);setReport("");
      await queryClient.invalidateQueries({queryKey:[endpoint]});
      toast({title:id?"Entrega validada. Aprovação de CPP pendente.":"Aliado e escopo registrados."});
    },
    onError:(error:Error)=>toast({title:"Não foi possível salvar",description:error.message,variant:"destructive"}),
  });
  return <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">Aliados e entregas</h3>
      {query.data?.editavel && !newOpen && <Button type="button" variant="outline" onClick={()=>setNewOpen(true)}>Adicionar aliado</Button>}
    </div>
    {query.isPending && <p className="text-sm text-muted-foreground">Carregando entregas…</p>}
    {query.isError && <Button type="button" variant="outline" onClick={()=>query.refetch()}>Recarregar entregas</Button>}
    {newOpen && <div className="space-y-3 rounded-md border p-3">
      <SearchableNameSelect ariaLabel="Aliado da entrega" value={member} onValueChange={setMember} disabled={profiles.isPending || profiles.isError}
        placeholder="Selecione o aliado" options={(profiles.data || []).map(m=>({value:m.id,label:m.nome || m.Nome_de_usuario || "Membro BUILT"}))} />
      {profiles.isError && <Button variant="outline" onClick={()=>profiles.refetch()}>Recarregar perfis</Button>}
      <label className="block space-y-1 text-sm"><span>Escopo da entrega</span><Textarea rows={3} value={scope} maxLength={4000} onChange={e=>setScope(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={()=>setNewOpen(false)}>Cancelar</Button>
        <Button type="button" loading={save.isPending && save.variables===null} disabled={!member || !scope.trim() || save.isPending} onClick={()=>save.mutate(null)}>Salvar aliado e escopo</Button></div>
    </div>}
    {query.data?.entregas.map(item=><article key={item.id} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a className="break-words font-medium hover:underline" href={"/membro/"+encodeURIComponent(item.membro_id)} target="_blank" rel="noopener noreferrer">{item.membro_nome}</a>
        <span className="text-sm text-muted-foreground">{item.status==="em_acompanhamento"?"Em acompanhamento":"Aguardando aprovação de CPP"}</span>
      </div>
      <p className="text-xs text-muted-foreground">Registrada em {new Date(item.criado_em).toLocaleDateString("pt-BR")}{item.validado_em ? " · Validada em "+new Date(item.validado_em).toLocaleDateString("pt-BR") : ""}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{item.escopo}</p>
      {item.relato_entrega && <p className="whitespace-pre-wrap break-words border-t pt-2 text-sm">{item.relato_entrega}</p>}
      {query.data?.editavel && item.status==="em_acompanhamento" && (validating===item.id ? <div className="space-y-2">
        <label className="block space-y-1 text-sm"><span>O que foi entregue</span><Textarea rows={3} maxLength={4000} value={report} onChange={e=>setReport(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={()=>setValidating(null)}>Cancelar</Button>
          <Button type="button" loading={save.isPending && save.variables===item.id} disabled={!report.trim() || save.isPending} onClick={()=>save.mutate(item.id)}>Validar e encaminhar para aprovação de CPP</Button></div>
      </div> : <Button type="button" size="sm" variant="outline" onClick={()=>{setValidating(item.id);setReport("");}}>Validar entrega</Button>)}
    </article>)}
  </section>;
}
