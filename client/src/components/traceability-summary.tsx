import { useQuery } from "@tanstack/react-query";
import { ArrowRight, GitBranch, Route } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TraceSummaryItem {
  id: string;
  codigo: string;
  status: string;
  origem?: { titulo?: string | null; etapa_nome?: string | null } | null;
  etapa_atual?: { titulo?: string | null; etapa_nome?: string | null } | null;
  resultado?: { resultado?: string | null; valor?: string | number | null; moeda?: string | null; sem_valor_financeiro?: boolean } | null;
  total_etapas: number;
}

function resultText(result?: TraceSummaryItem["resultado"]) {
  if (!result) return "Em andamento";
  if (result.sem_valor_financeiro) return result.resultado || "Sem valor financeiro";
  const amount = Number(result.valor || 0);
  if (amount > 0) return `${result.resultado || "Resultado"} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: result.moeda || "BRL" }).format(amount)}`;
  return result.resultado || "Resultado registrado";
}

export default function TraceabilitySummary({ objectType, objectId, compact = false }: { objectType: string; objectId?: string | null; compact?: boolean }) {
  const [, navigate] = useLocation();
  const query = useQuery<TraceSummaryItem[]>({
    queryKey: ["/api/rastreabilidade/objeto", objectType, objectId],
    queryFn: async () => {
      const response = await fetch(`/api/rastreabilidade/objeto/${encodeURIComponent(objectType)}/${encodeURIComponent(String(objectId))}`, { credentials: "include", cache: "no-store" });
      if (response.status === 403 || response.status === 404) return [];
      if (!response.ok) throw new Error("Não foi possível carregar a jornada.");
      return response.json();
    },
    enabled: Boolean(objectId),
    retry: false,
  });
  const items = query.data || [];
  if (!items.length) return null;

  return (
    <section className={compact ? "border-y py-4" : "border-y py-5"} aria-label="Rastreabilidade do negócio">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-600" />
          <h2 className="font-semibold">Jornada do negócio</h2>
          {items.length > 1 && <Badge variant="outline">{items.length} jornadas</Badge>}
        </div>
      </div>
      <div className="mt-3 divide-y">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
            <Badge variant="outline" className="w-fit font-mono">{item.codigo}</Badge>
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex flex-wrap items-center gap-1.5 font-medium">
                <span>{item.origem?.etapa_nome || item.origem?.titulo || "Origem"}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{item.etapa_atual?.etapa_nome || item.etapa_atual?.titulo || "Em andamento"}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.total_etapas} etapas · {resultText(item.resultado)}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/rastreabilidade/${item.codigo}`)}>
              <GitBranch className="mr-2 h-4 w-4" />Ver jornada completa
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
