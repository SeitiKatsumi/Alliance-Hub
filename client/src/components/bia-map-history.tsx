import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { memberId: string; name: string; value: number; percent: number; group?: string };
type Version = { id: string; tipo: "zero" | "atual"; numero: number; revisao_base: number; criado_em: string;
  autor: { name?: string }; motivo: string; hash: string;
  snapshot?: { rows: Row[]; base: { moeda: string } } };
const label = (v: Version) => v.tipo === "zero" ? `MAP Zero — revisão ${v.numero}` : `MAP ${v.numero}`;
const money = (value: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export function BiaMapHistory({ biaId }: { biaId: string }) {
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState("");
  const prefix = `/api/bias/${biaId}/map/versoes`;
  const versions = useQuery<Version[]>({ queryKey: [prefix], queryFn: async () => (await apiRequest("GET", prefix)).json() });
  const selectedId = selected || versions.data?.[0]?.id || "";
  const detail = useQuery<Version>({ queryKey: [prefix, selectedId], enabled: !!selectedId,
    queryFn: async () => (await apiRequest("GET", `${prefix}/${selectedId}`)).json() });
  const previous = useQuery<Version>({ queryKey: [prefix, comparison], enabled: !!comparison,
    queryFn: async () => (await apiRequest("GET", `${prefix}/${comparison}`)).json() });
  const currentRows = detail.data?.snapshot?.rows || [];
  const priorRows = previous.data?.snapshot?.rows || [];
  const identities = Array.from(new Set([...currentRows, ...(comparison ? priorRows : [])].map((row) => row.memberId)));
  const currency = detail.data?.snapshot?.base.moeda || "BRL";

  return <Card><CardHeader><CardTitle>Histórico do MAP</CardTitle></CardHeader><CardContent className="space-y-4">
    {versions.isPending && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}
    {(versions.isError || detail.isError || (comparison && previous.isError)) && <p role="alert" className="text-sm text-red-600">Não foi possível carregar as versões. Atualize a página para tentar novamente.</p>}
    {versions.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão registrada. As revisões serão preservadas ao salvar o MAP Zero.</p>}
    {!!versions.data?.length && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Versão<select className="block h-10 w-full rounded-md border bg-background px-3" value={selectedId} onChange={(e) => setSelected(e.target.value)}>
          {versions.data.map((v) => <option value={v.id} key={v.id}>{label(v)}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Comparar com<select className="block h-10 w-full rounded-md border bg-background px-3" value={comparison} onChange={(e) => setComparison(e.target.value)}>
          <option value="">Sem comparação</option>{versions.data.filter((v) => v.id !== selectedId).map((v) => <option value={v.id} key={v.id}>{label(v)}</option>)}
        </select></label>
      </div>
      {detail.data && <div className="space-y-1 text-sm">
        <p>{new Date(detail.data.criado_em).toLocaleString("pt-BR")} · {detail.data.autor.name || "Sistema"}</p>
        <p>{detail.data.motivo}</p><p className="text-muted-foreground">Base: revisão {detail.data.revisao_base}</p>
        <a className="inline-block py-2 font-medium text-blue-700 underline" href={`${prefix}/${selectedId}/pdf`} target="_blank" rel="noreferrer">Abrir PDF desta versão</a>
      </div>}
      {(detail.isFetching || (comparison && previous.isFetching)) ? <p className="text-sm">Carregando composição…</p> : <div className="grid gap-3 md:grid-cols-2">
        {identities.map((id) => {
          const row = currentRows.find((r) => r.memberId === id);
          const prior = comparison ? priorRows.find((r) => r.memberId === id) : undefined;
          return <div className="min-w-0 rounded-lg border p-3 text-sm" key={id}>
            <p className="break-words font-semibold">{row?.name || prior?.name}</p>
            <p>{money(row?.value || 0, currency)} · {(row?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p>
            {comparison && previous.data && <p className="mt-1 text-xs text-muted-foreground">Comparação: {money(prior?.value || 0, previous.data.snapshot?.base.moeda || currency)} · {(prior?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p>}
          </div>;
        })}
      </div>}
    </>}
  </CardContent></Card>;
}
