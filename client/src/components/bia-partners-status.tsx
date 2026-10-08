import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";

export type BiaPartnersStatusData = {
  convitesPendentes: number;
  canReenviar?: boolean;
  socios: { membroId: string; nome: string; papeis: string[]; convitesPendentes: string[]; convites?: {id:string; tipo:"socio"|"diretor"}[] }[];
};

export function BiaPartnersStatus({ biaId }: { biaId: string }) {
  const query = useQuery<BiaPartnersStatusData>({
    queryKey: [`/api/bias/${biaId}/socios-status`],
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
  return <section className="rounded-lg border p-5" aria-label="Participantes e pendências">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Participantes e pendências</h2>
      <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar</Button>
    </div>
    {query.isPending ? <p role="status">Carregando participantes…</p> : query.isError ?
      <p role="alert" className="text-sm text-destructive">Não foi possível consultar os participantes. Clique em Atualizar para tentar novamente.</p> :
      <BiaPartnersStatusList data={query.data} biaId={biaId} onRefresh={() => void query.refetch()} />}
  </section>;
}

export function BiaPartnersStatusList({ data, biaId, onRefresh }: { data: BiaPartnersStatusData; biaId?: string; onRefresh?: () => void }) {
  return <div className="space-y-3 text-sm">
    <p role="status">{data.socios.length} participante(s) vinculado(s) ou convidado(s) · {data.convitesPendentes} convite(s) pendente(s).</p>
    {data.convitesPendentes > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">As pessoas destacadas abaixo ainda precisam aceitar os convites. Esses convites pendentes impedem a ativação da BIA.</p>}
    {data.socios.length === 0 ? <p className="text-muted-foreground">Nenhum participante vinculado ou convite pendente nesta BIA.</p> :
      <ul className="space-y-2">{data.socios.map((socio) => <li key={socio.membroId} className={`min-w-0 rounded-md border p-3 ${socio.convitesPendentes.length ? "border-amber-200 bg-amber-50/60" : ""}`}>
        <p className="break-words font-medium">{socio.nome}</p>
        {socio.papeis.map((papel) => <p key={papel} className="mt-1 text-muted-foreground">{papel} — Vinculado</p>)}
        {socio.convitesPendentes.map((papel, index) => <div key={`${papel}-${index}`} className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-amber-800">{papel} — Convite pendente de aceite</p>
          {data.canReenviar && biaId && socio.convites?.[index] && <ResendBiaInvite biaId={biaId} invite={socio.convites[index]} name={socio.nome} onRefresh={onRefresh}/>}
        </div>)}
      </li>)}</ul>}
    <p className="text-xs text-muted-foreground">Esta lista reúne sócios, diretores e Aliado BUILT, com seus vínculos e convites. Aceites de MOU e demais requisitos de ativação são verificados separadamente.</p>
  </div>;
}

function ResendBiaInvite({biaId, invite, name, onRefresh}: {biaId:string; invite:{id:string;tipo:"socio"|"diretor"}; name:string; onRefresh?:()=>void}) {
  const {toast} = useToast();
  const resend = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/bias/${encodeURIComponent(biaId)}/convites/${invite.tipo}/${encodeURIComponent(invite.id)}/reenviar`);
      return response.json();
    },
    onSuccess: (result) => {toast({title:"Convite reenviado",description:result.message}); onRefresh?.();},
    onError: (error:Error) => {toast({title:"Não foi possível reenviar",description:error.message,variant:"destructive"}); onRefresh?.();},
  });
  return <Button type="button" size="sm" variant="outline" disabled={resend.isPending} aria-label={`Reenviar convite para ${name}`} onClick={() => resend.mutate()}>{resend.isPending ? "Enviando…" : "Reenviar convite"}</Button>;
}
