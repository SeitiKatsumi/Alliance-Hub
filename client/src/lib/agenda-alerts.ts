import type { QueryClient } from "@tanstack/react-query";

export type AgendaAlertsView = "resumo" | "agenda" | "alertas";

export const AGENDA_ALERTS_REFRESH_MS = 2000;

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
