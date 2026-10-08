import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";

export type BiaPartnersStatusData = {
  convitesPendentes: number;
  socios: { membroId: string; nome: string; papeis: string[]; convitesPendentes: string[] }[];
};

export function BiaPartnersStatus({ biaId }: { biaId: string }) {
  const query = useQuery<BiaPartnersStatusData>({
    queryKey: [`/api/bias/${biaId}/socios-status`],
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
  return <section className="rounded-lg border p-5" aria-label="Sócios e pendências">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Sócios e pendências</h2>
      <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar</Button>
    </div>
    {query.isPending ? <p role="status">Carregando sócios…</p> : query.isError ?
      <p role="alert" className="text-sm text-destructive">Não foi possível consultar os sócios. Clique em Atualizar para tentar novamente.</p> :
      <BiaPartnersStatusList data={query.data} />}
  </section>;
}

export function BiaPartnersStatusList({ data }: { data: BiaPartnersStatusData }) {
  return <div className="space-y-3 text-sm">
    <p role="status">{data.socios.length} sócio(s) vinculado(s) ou convidado(s) · {data.convitesPendentes} convite(s) pendente(s).</p>
    {data.convitesPendentes > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">Os sócios destacados abaixo ainda precisam aceitar os convites. Esses convites pendentes impedem a ativação da BIA.</p>}
    {data.socios.length === 0 ? <p className="text-muted-foreground">Nenhum sócio vinculado ou convite pendente nesta BIA.</p> :
      <ul className="space-y-2">{data.socios.map((socio) => <li key={socio.membroId} className={`min-w-0 rounded-md border p-3 ${socio.convitesPendentes.length ? "border-amber-200 bg-amber-50/60" : ""}`}>
        <p className="break-words font-medium">{socio.nome}</p>
        {socio.papeis.map((papel) => <p key={papel} className="mt-1 text-muted-foreground">{papel} — Vinculado</p>)}
        {socio.convitesPendentes.map((papel, index) => <p key={`${papel}-${index}`} className="mt-1 font-medium text-amber-800">{papel} — Convite pendente de aceite</p>)}
      </li>)}</ul>}
    <p className="text-xs text-muted-foreground">Esta lista informa vínculos e convites de sócios. Aceites de MOU e demais requisitos de ativação são verificados separadamente.</p>
  </div>;
}
