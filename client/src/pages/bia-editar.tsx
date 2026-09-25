import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { BiaFormSheet } from "./bias";
import { EMPTY_BIA_ACCESS, hasBiaAccess } from "@shared/bia-access";

export default function BiaEditarPage() {
  const {id}=useParams<{id:string}>();
  const [,navigate]=useLocation();
  const bia=useQuery<any>({queryKey:["/api/bias",id],queryFn:async()=>(await apiRequest("GET",`/api/bias/${id}`)).json()});
  const access=useQuery<any>({queryKey:["/api/bias",bia.data?.id,"access-control"],enabled:!!bia.data?.id,queryFn:async()=>(await apiRequest("GET",`/api/bias/${bia.data.id}/access-control`)).json(),retry:false});
  const members=useQuery<any[]>({queryKey:["/api/membros"]});
  if(bia.isPending || access.isLoading)return <p className="p-8">Carregando edição da BIA…</p>;
  if(bia.isError || access.isError)return <div role="alert" className="space-y-4 p-8"><p>Não foi possível carregar a BIA ou suas permissões.</p><Button onClick={()=>{void bia.refetch();void access.refetch();}}>Tentar novamente</Button></div>;
  const permissions=access.data?.current.permissions || EMPTY_BIA_ACCESS;
  if(!hasBiaAccess(permissions,"configuracao_bia","view"))return <p role="alert" className="p-8">Sem permissão para consultar a configuração desta BIA.</p>;
  return <BiaFormSheet key={bia.data.id} page open bia={bia.data} membros={members.data || []} isLoading={members.isPending} access={permissions} readOnly={!hasBiaAccess(permissions,"configuracao_bia","edit")} onClose={()=>navigate(`/bias/${id}`)}/>;
}
