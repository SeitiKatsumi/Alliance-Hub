import { Redirect, useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { BiaVacancyInterests } from "@/components/bia-vacancy-interests";
import { BiaFormSheet } from "./bias";
import { EMPTY_BIA_ACCESS, hasBiaAccess } from "@shared/bia-access";

export default function BiaEditarPage() {
  const {id}=useParams<{id:string}>();
  const [,navigate]=useLocation();
  const params = new URLSearchParams(useSearch());
  const requestedSection = params.get("section");
  if(requestedSection==="equipe" && params.has("vaga") && id) return <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
    <Button variant="outline" onClick={()=>navigate("/bias/"+encodeURIComponent(id))}>Voltar para a BIA</Button>
    <BiaVacancyInterests biaId={id} standalone/>
  </div>;
  return <BiaConfigurationEditor id={id} requestedSection={requestedSection}/>;
}

function BiaConfigurationEditor({id,requestedSection}:{id:string|undefined;requestedSection:string|null}){
  const [,navigate]=useLocation();
  const bia=useQuery<any>({queryKey:["/api/bias",id],queryFn:async()=>(await apiRequest("GET",`/api/bias/${id}`)).json()});
  const access=useQuery<any>({queryKey:["/api/bias",bia.data?.id,"access-control"],enabled:!!bia.data?.id,queryFn:async()=>(await apiRequest("GET",`/api/bias/${bia.data.id}/access-control`)).json(),retry:false});
  const permissions=access.data?.current.permissions || EMPTY_BIA_ACCESS;
  const canEdit=hasBiaAccess(permissions,"configuracao_bia","edit");
  const checkDraft=!!bia.data?.id && bia.data.situacao==="em_estruturacao" && canEdit;
  const draft=useQuery<{concluido:boolean}|null>({
    queryKey:["/api/bias",bia.data?.id,"rascunho"],enabled:checkDraft,retry:false,staleTime:0,
    refetchOnMount:"always",
    queryFn:async({signal})=>{
      const response=await fetch(`/api/bias/${encodeURIComponent(bia.data.id)}/rascunho`,{credentials:"include",signal});
      if(response.status===404)return null;
      if(!response.ok)throw new Error("Não foi possível consultar o rascunho da BIA.");
      return response.json();
    },
  });
  const members=useQuery<any[]>({queryKey:["/api/membros"]});
  if(bia.isPending || access.isLoading)return <p className="p-8">Carregando edição da BIA…</p>;
  if(bia.isError || access.isError)return <div role="alert" className="space-y-4 p-8"><p>Não foi possível carregar a BIA ou suas permissões.</p><Button onClick={()=>{void bia.refetch();void access.refetch();}}>Tentar novamente</Button></div>;
  if(checkDraft && (draft.isPending || draft.isFetching))return <p className="p-8">Carregando rascunho da BIA…</p>;
  if(checkDraft && draft.isError)return <div role="alert" className="space-y-4 p-8"><p>Não foi possível consultar o rascunho da BIA.</p><Button onClick={()=>draft.refetch()}>Tentar novamente</Button></div>;
  if(checkDraft && draft.data?.concluido===false){
    const section=requestedSection ? `?section=${encodeURIComponent(requestedSection)}` : "";
    return <Redirect to={`/bias/${encodeURIComponent(bia.data.id)}/estruturacao${section}`} replace />;
  }
  if(!hasBiaAccess(permissions,"configuracao_bia","view")) {
    if(requestedSection==='equipe')return <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
      <Button variant="outline" onClick={()=>navigate("/bias/"+encodeURIComponent(id || ""))}>Voltar para a BIA</Button>
      <BiaVacancyInterests biaId={bia.data.id} standalone/>
    </div>;
    return <p role="alert" className="p-8">Sem permissão para consultar a configuração desta BIA.</p>;
  }
  const initialSection = requestedSection === 'ativos' || requestedSection === 'equipe' ? requestedSection : 'geral';
  return <BiaFormSheet key={bia.data.id} page open initialSection={initialSection} bia={bia.data} membros={members.data || []} isLoading={members.isPending} access={permissions} readOnly={!hasBiaAccess(permissions,"configuracao_bia","edit")} onClose={()=>navigate(`/bias/${id}`)}/>;
}
