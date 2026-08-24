import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  ChevronRight,
  Clock3,
  History,
  ListChecks,
} from "lucide-react";
import AgendaPage from "@/pages/agenda";
import ConvitesPage from "@/pages/convites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleInfo } from "@/components/module-info";
import { useAuth } from "@/hooks/use-auth";
import { hasEmployeeModuleAccess } from "@/lib/company-access";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AGENDA_ALERTS_REFRESH_MS,
  invalidateAgendaAlertQueries,
  normalizeAgendaAlertsView,
  type AgendaAlertsView,
} from "@/lib/agenda-alerts";

interface AgendaPreviewItem {
  id: string;
  type: "tarefa" | "reuniao";
  title: string;
  description?: string | null;
  date?: string | null;
  time?: string | null;
  priority: string;
  overdue: boolean;
  href: string;
  external?: boolean;
}

interface AlertPreviewItem {
  id: string;
  source_type: string;
  source_id: string;
  category: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  href: string;
}

interface AgendaAlertsSummary {
  can_view_agenda: boolean;
  pending_count: number;
  pending_display: number | "99+" | null;
  agenda: {
    overdue_count: number;
    today_count: number;
    preview: AgendaPreviewItem[];
  };
  alerts: { preview: AlertPreviewItem[] };
  updates: { preview: AlertPreviewItem[] };
}

const VIEW_LABELS: Array<{ key: AgendaAlertsView; label: string; icon: typeof CalendarDays }> = [
  { key: "resumo", label: "Resumo", icon: ListChecks },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "alertas", label: "Alertas", icon: BellRing },
];

function formatPreviewDate(date?: string | null, time?: string | null) {
  if (!date) return "Sem data definida";
  const parsed = new Date(`${date}T12:00:00`);
  const label = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return time ? `${label} às ${time}` : label;
}

function priorityClass(priority: string) {
  if (priority === "critica") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "alta") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function AgendaAlertasPage() {
  const { user } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const canViewAgenda = hasEmployeeModuleAccess(user, "agenda");
  const requestedView = new URLSearchParams(search).get("view");
  const view = normalizeAgendaAlertsView(requestedView, canViewAgenda);

  const { data: summary, isLoading } = useQuery<AgendaAlertsSummary>({
    queryKey: ["/api/agenda-alertas/resumo"],
    queryFn: async () => {
      const response = await fetch("/api/agenda-alertas/resumo", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar a Agenda e Alertas.");
      return response.json();
    },
    refetchInterval: AGENDA_ALERTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (requestedView === view) return;
    navigate(`/agenda-alertas?view=${view}`, { replace: true });
  }, [navigate, requestedView, view]);

  function changeView(next: AgendaAlertsView) {
    navigate(`/agenda-alertas?view=${next}`);
  }

  async function openAlert(item: AlertPreviewItem) {
    if (item.source_type === "opportunity_delivery" && item.status === "enviado") {
      await apiRequest("PATCH", `/api/rede/oportunidades/notificacoes/${item.source_id}/lida`, {}).catch(() => undefined);
      await invalidateAgendaAlertQueries(queryClient);
    }
    navigate(item.href || "/agenda-alertas?view=alertas");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6" data-testid="agenda-alertas-page">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">Início / Agenda e Alertas</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold text-foreground">Agenda e Alertas</h1>
              <ModuleInfo
                title="Agenda e Alertas"
                description="Centraliza compromissos, convites, aprovações e pendências dos demais módulos, sempre com acesso direto à ação de origem."
              />
            </div>
            <p className="text-sm text-muted-foreground">Compromissos, pendências e atualizações em um só lugar.</p>
          </div>
        </div>
      </header>

      <nav className={`grid rounded-md border border-border/60 bg-muted/20 p-1 ${canViewAgenda ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Visualizações de Agenda e Alertas">
        {VIEW_LABELS.filter((item) => item.key !== "agenda" || canViewAgenda).map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => changeView(item.key)}
              className={`relative inline-flex min-h-10 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`agenda-alertas-tab-${item.key}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.key === "alertas" && Number(summary?.pending_count || 0) > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {summary?.pending_display}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {view === "agenda" && canViewAgenda && <AgendaPage embedded />}
      {view === "alertas" && <ConvitesPage embedded />}

      {view === "resumo" && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="rounded-lg border border-border/60 bg-card p-8 text-sm text-muted-foreground">Carregando seu resumo...</div>
          ) : (
            <>
              <section aria-labelledby="resumo-indicadores" className={`grid gap-3 ${canViewAgenda ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <h2 id="resumo-indicadores" className="sr-only">Indicadores do resumo</h2>
                {canViewAgenda && <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CalendarDays className="h-4 w-4 text-blue-600" /> Hoje</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{summary?.agenda.today_count || 0}</p>
                  <p className="text-xs text-muted-foreground">compromissos e tarefas</p>
                </div>}
                {canViewAgenda && <div className="rounded-lg border border-border/60 bg-card p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock3 className="h-4 w-4 text-amber-600" /> Atrasadas</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{summary?.agenda.overdue_count || 0}</p>
                  <p className="text-xs text-muted-foreground">tarefas que precisam de atenção</p>
                </div>}
                <div className="rounded-lg border border-red-100 bg-red-50/40 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> Pendências ativas</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{summary?.pending_count || 0}</p>
                  <p className="text-xs text-muted-foreground">itens que exigem sua ação</p>
                </div>
              </section>

              <div className={`grid gap-6 ${canViewAgenda ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                {canViewAgenda && <section className="space-y-3" aria-labelledby="proximos-compromissos">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <div>
                      <h2 id="proximos-compromissos" className="text-lg font-bold text-foreground">Próximos compromissos</h2>
                      <p className="text-xs text-muted-foreground">Até cinco itens da sua agenda.</p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => changeView("agenda")}>
                      Ver agenda <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border/60 bg-card">
                    {(summary?.agenda.preview || []).length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">Nenhum compromisso próximo.</p>
                    ) : summary?.agenda.preview.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.external ? window.open(item.href, "_blank", "noopener,noreferrer") : navigate(item.href)}
                        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                          {item.type === "reuniao" ? <CalendarDays className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{formatPreviewDate(item.date, item.time)}</span>
                        </span>
                        {item.overdue && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Atrasada</Badge>}
                      </button>
                    ))}
                  </div>
                </section>}

                <section className="space-y-3" aria-labelledby="alertas-prioritarios">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <div>
                      <h2 id="alertas-prioritarios" className="text-lg font-bold text-foreground">Alertas prioritários</h2>
                      <p className="text-xs text-muted-foreground">Itens que ainda precisam de uma decisão.</p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => changeView("alertas")}>
                      Ver alertas <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border/60 bg-card">
                    {(summary?.alerts.preview || []).length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">Você não tem pendências ativas.</p>
                    ) : summary?.alerts.preview.map((item) => (
                      <button key={item.id} type="button" onClick={() => openAlert(item)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${priorityClass(item.priority)}`}>
                          <BellRing className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                          {item.description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {(summary?.updates.preview || []).length > 0 && (
                <section className="space-y-3" aria-labelledby="atualizacoes-rede">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <History className="h-4 w-4 text-blue-600" />
                    <h2 id="atualizacoes-rede" className="text-base font-bold text-foreground">Atualizações da rede</h2>
                    <span className="text-xs text-muted-foreground">não entram no contador</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {summary?.updates.preview.map((item) => (
                      <button key={item.id} type="button" onClick={() => openAlert(item)} className="min-h-24 rounded-lg border border-border/60 bg-card p-4 text-left hover:border-blue-200 hover:bg-blue-50/20">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Consultar atualização</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
