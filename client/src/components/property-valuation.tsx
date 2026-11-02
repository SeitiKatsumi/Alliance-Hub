import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "./ui/button";

type Source = { titulo: string; url: string; trecho?: string };
export interface PropertyAssessment {
  status: string; valor_sugerido?: number | null; valor_minimo?: number | null; valor_maximo?: number | null;
  sugestao_data_base?: string; moeda: string; fontes?: Source[]; pendencias?: string[];
  area_avaliacao?: number; area_avaliacao_tipo?: string; referencia_m2?: number;
  precisa_atualizar?: boolean; pesquisa_chave?: string; limitacoes?: string; versao_metodo?: string;
  historico?: { data: string; valor: number | null; status: string; metodo: string; motivo?: string; moeda?: string; fontes?: Source[] }[];
}
const money = (value: number | null | undefined, currency: string) => value == null ? "Sem avaliação" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
const safeUrl = (url: string) => /^https?:\/\//i.test(url) ? url : undefined;
export function PropertyValuation({ id, canManage, onEdit }: { id: string; canManage: boolean; onEdit: () => void }) {
  const client = useQueryClient();
  const query = useQuery<PropertyAssessment>({ queryKey: ["/api/carteira/imoveis", id, "avaliacao"], refetchInterval: 60_000, queryFn: async () => (await apiRequest("GET", `/api/carteira/imoveis/${id}/avaliacao`)).json() });
  const attempted = useRef("");
  const retryAt = useRef(0);
  const [research, setResearch] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const key = `${id}:${query.data?.pesquisa_chave}`;
    if (!canManage || !query.data?.precisa_atualizar || research || (attempted.current === key && Date.now() < retryAt.current)) return;
    attempted.current = key;
    retryAt.current = Date.now() + 5 * 60_000;
    setResearch(true); setError("");
    void apiRequest("POST", `/api/carteira/imoveis/${id}/avaliacao/pesquisar`).then(() => {
      client.invalidateQueries({ queryKey: ["/api/carteira/imoveis", id, "avaliacao"] });
      client.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
    }).catch((e: Error) => setError(e.message)).finally(() => setResearch(false));
  }, [id, canManage, query.data?.precisa_atualizar, query.data?.pesquisa_chave, query.dataUpdatedAt, research, client]);
  return <PropertyValuationReport data={query.data} loading={query.isLoading || research} error={error || (query.isError ? "Não foi possível consultar a avaliação." : "")} onEdit={canManage ? onEdit : undefined} />;
}
export function PropertyValuationReport({ data, loading, error, onEdit }: { data?: PropertyAssessment; loading?: boolean; error?: string; onEdit?: () => void }) {
  const current = data?.status === "atualizada";
  return <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <h3 className="text-lg font-semibold">Avaliação atual · Método BUILT</h3>
    {loading && <p role="status" className="text-sm text-muted-foreground">Consultando referências de mercado…</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <p className="break-words text-2xl font-semibold">{money(current ? data?.valor_sugerido : null, data?.moeda || "BRL")}</p>
    {!!data?.pendencias?.length && <div className="space-y-2 text-sm"><ul className="list-disc space-y-1 pl-5">{data.pendencias.map(text => <li key={text}>{text}</li>)}</ul>{onEdit && <Button variant="outline" onClick={onEdit}>Completar cadastro</Button>}</div>}
    {data && !current && !data.pendencias?.length && !loading && <p className="text-sm text-muted-foreground">{data.status === "desatualizada" ? "A avaliação anterior venceu e precisa de nova pesquisa." : "Não foram encontradas referências compatíveis suficientes para avaliar o imóvel."}</p>}
    {current && <div className="space-y-2 text-sm"><p>{data?.area_avaliacao?.toLocaleString("pt-BR")} m² de área {data?.area_avaliacao_tipo === "privativa" ? "privativa" : "construída"} × {money(data?.referencia_m2, data?.moeda || "BRL")}/m² (mediana dos anúncios).</p><p className="text-muted-foreground">Data-base: {data?.sugestao_data_base?.split("-").reverse().join("/")} · Anúncios de venda em até 10 km. Preços anunciados não comprovam transações; esta estimativa automática não é laudo.</p></div>}
    {!!data?.fontes?.length && <details><summary className="cursor-pointer text-sm font-medium">Fontes e critérios</summary><ul className="mt-3 space-y-3 text-sm">{data.fontes.map((source, i) => <li key={`${source.url}:${i}`} className="break-words"><a className="text-sky-700 underline dark:text-sky-300" href={safeUrl(source.url)} target="_blank" rel="noreferrer">{source.titulo || `Referência ${i + 1}`}</a>{source.trecho && <p className="mt-1 text-muted-foreground">{source.trecho}</p>}</li>)}</ul><p className="mt-3 text-sm text-muted-foreground">{data.limitacoes}</p></details>}
    {!!data?.historico?.length && <details><summary className="cursor-pointer text-sm font-medium">Histórico de avaliações</summary><ul className="mt-3 space-y-3 text-sm">{data.historico.map((entry, i) => <li key={`${entry.data}:${i}`} className="flex flex-wrap justify-between gap-2 border-t pt-2"><span>{new Date(entry.data).toLocaleDateString("pt-BR")} · {entry.metodo}{entry.motivo && <span className="block text-xs text-muted-foreground">{entry.motivo}</span>}</span><span>{money(entry.valor, entry.moeda || data.moeda)} · {entry.status}</span></li>)}</ul></details>}
  </section>;
}
