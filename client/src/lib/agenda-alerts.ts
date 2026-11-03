import type { QueryClient } from "@tanstack/react-query";

export type AgendaAlertsView = "resumo" | "agenda" | "alertas";

export const AGENDA_ALERTS_REFRESH_MS = 2000;

export interface AgendaPendingAlert {
  id: string;
  source_type: string;
  source_id: string;
  group: string;
  category: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  action_required: boolean;
  active: boolean;
  href: string;
}

export function agendaAlertDestination(href: string): string {
  // These legacy alerts require the existing approval controls, not this index.
  if (href === "/agenda-alertas?view=alertas" || !href) {
    return "/agenda-alertas?view=alertas&section=convites";
  }
  return href;
}

export function normalizeAgendaAlertsView(value: string | null | undefined, canViewAgenda: boolean): AgendaAlertsView {
  if (value === "alertas") return "alertas";
  if (value === "agenda") return canViewAgenda ? "agenda" : "alertas";
  return "resumo";
}

export function agendaAlertBadgeLabel(value: unknown): string | null {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return null;
  return total > 99 ? "99+" : String(Math.floor(total));
}

export function invalidateAgendaAlertQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0] || "").startsWith("/api/agenda-alertas"),
  });
}
