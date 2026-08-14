import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CircleDollarSign, Clock3, GitBranch, Loader2, Route, Split } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TraceNode {
  id: string;
  object_type: string;
  object_id: string;
  object_code?: string | null;
  titulo: string;
  status?: string | null;
  papel: string;
  etapa_nome: string;
  url?: string | null;
  criado_em: string;
}

interface TraceLink {
  id: string;
  source_node_id?: string | null;
  destination_node_id: string;
  relation_type: string;
  justificativa?: string | null;
}

interface TraceResult {
  id: string;
  economic_key: string;
  resultado: string;
  valor?: string | null;
  moeda?: string | null;
  sem_valor_financeiro: boolean;
  observacoes?: string | null;
}

interface TraceEvent {
  id: string;
  event_type: string;
  titulo: string;
  payload?: Record<string, unknown> | null;
  autor_nome?: string | null;
  criado_em: string;
}

interface TracePayload {
  codigo: string;
  titulo?: string | null;
  status: string;
  origem?: TraceNode | null;
  etapa_atual?: TraceNode | null;
  nodes: TraceNode[];
  links: TraceLink[];
  events: TraceEvent[];
  results: TraceResult[];
}

const TYPE_LABELS: Record<string, string> = {
  demanda: "Demanda",
  oportunidade: "Oportunidade",
  ro: "Reunião de Oportunidades",
  bia: "BIA",
  oba: "OBA",
  imovel: "Imóvel",
  land_bank_asset: "Ativo",
  oportunidade_externa: "Oportunidade externa",
  servico: "Prestação de serviço",
};

function formatMoney(value?: string | null, currency = "BRL") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export default function BusinessTraceDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [, navigate] = useLocation();
  const query = useQuery<TracePayload>({
    queryKey: ["/api/rastreabilidade", codigo],
    queryFn: async () => {
      const response = await fetch(`/api/rastreabilidade/${encodeURIComponent(codigo)}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Jornada não encontrada.");
      }
      return response.json();
    },
  });

  if (query.isLoading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (!query.data) return <div className="mx-auto max-w-5xl p-6"><Button variant="ghost" onClick={() => history.back()}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><p className="mt-12 text-center text-muted-foreground">{query.error?.message || "Jornada não encontrada."}</p></div>;
  const trace = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-0" onClick={() => history.back()}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
      <header className="border-y py-6">
        <div className="flex flex-wrap items-center gap-2"><Route className="h-5 w-5 text-blue-600" /><Badge variant="outline" className="font-mono">{trace.codigo}</Badge><Badge variant="secondary">{trace.status === "ativa" ? "Em andamento" : trace.status}</Badge></div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Jornada completa do negócio</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Cada etapa mantém seu próprio código. O código de rastreio reúne a história sem alterar os registros originais.</p>
      </header>

      <section>
        <div className="mb-5 flex items-center gap-2"><GitBranch className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-semibold">Etapas e ramificações</h2></div>
        <div className="relative ml-3 border-l pl-7 sm:ml-5 sm:pl-9">
          {trace.nodes.map((node, index) => {
            const incoming = trace.links.filter((link) => link.destination_node_id === node.id);
            return (
              <article key={node.id} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[37px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-blue-500 bg-background sm:-left-[45px]"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /></span>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{TYPE_LABELS[node.object_type] || node.object_type}</Badge>{node.object_code && <span className="font-mono text-xs text-muted-foreground">{node.object_code}</span>}{node.papel === "origem" && <Badge variant="outline">Origem</Badge>}</div>
                    <h3 className="mt-2 font-semibold">{node.titulo}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{node.etapa_nome}{node.status ? ` · ${node.status.replace(/_/g, " ")}` : ""}</p>
                    {incoming.map((link) => <p key={link.id} className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Split className="h-3.5 w-3.5" />{link.relation_type.replace(/_/g, " ")}{link.justificativa ? ` · ${link.justificativa}` : ""}</p>)}
                  </div>
                  {node.url && <Button type="button" size="sm" variant="outline" onClick={() => navigate(node.url!)}>Abrir etapa<ArrowRight className="ml-2 h-4 w-4" /></Button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y py-6">
        <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-semibold">Histórico auditável</h2></div>
        {trace.events.length ? (
          <div className="mt-4 divide-y">
            {trace.events.map((event) => (
              <div key={event.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{event.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.event_type.replace(/_/g, " ")}</p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right"><p>{event.autor_nome || "Sistema"}</p><time>{new Date(event.criado_em).toLocaleString("pt-BR")}</time></div>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-muted-foreground">Ainda não há eventos registrados nesta jornada.</p>}
      </section>

      <section className="border-y py-6">
        <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-semibold">Resultado econômico</h2></div>
        {trace.results.length ? <div className="mt-4 divide-y">{trace.results.map((result) => <div key={result.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{result.resultado}</p><p className="mt-1 text-xs text-muted-foreground">Chave econômica única: {result.economic_key}</p></div><p className="text-lg font-semibold text-emerald-700">{result.sem_valor_financeiro ? "Sem valor financeiro" : formatMoney(result.valor, result.moeda || "BRL")}</p></div>{result.observacoes && <p className="mt-2 text-sm text-muted-foreground">{result.observacoes}</p>}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">A jornada ainda não possui um fechamento econômico. O valor será exibido em todas as etapas relacionadas quando for registrado, mas contabilizado apenas uma vez.</p>}
      </section>
    </div>
  );
}
