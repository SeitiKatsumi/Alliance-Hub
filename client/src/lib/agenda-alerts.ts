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
  // Both old sections now open the existing unified approvals area.
  if (!href || href === "/agenda-alertas?view=alertas&section=convites") {
    return "/agenda-alertas?view=alertas";
  }
  return href;
}

/** These sources have their own authorized decision controls, never a generic link. */
export function isNativeApprovalAlert(item: Pick<AgendaPendingAlert, "source_type">): boolean {
  return ["convite_comunidade", "bia_diretor_solicitacao", "bia_socio_solicitacao", "bia_mou_revisao"].includes(item.source_type);
}

function unrepresentedApprovalAlerts(
  items: AgendaPendingAlert[],
  represented: Array<Pick<AgendaPendingAlert, "source_type" | "source_id">>,
  search = "",
): AgendaPendingAlert[] {
  const key = (item: Pick<AgendaPendingAlert, "source_type" | "source_id">) => JSON.stringify([item.source_type, String(item.source_id)]);
  const seen = new Set(represented.map(key));
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalize(search);
  return items.filter(item => {
    if (item.group !== "pendencias" || !item.active || !item.action_required || seen.has(key(item))) return false;
    seen.add(key(item));
    return !query || normalize([item.title, item.description, item.status, item.category].filter(Boolean).join(" ")).includes(query);
  });
}

export function additionalApprovalAlerts(items: AgendaPendingAlert[], represented: Array<Pick<AgendaPendingAlert, "source_type" | "source_id">>, search = "") {
  return unrepresentedApprovalAlerts(items, represented, search).filter(item => !isNativeApprovalAlert(item));
}

export function unresolvedNativeApprovalAlerts(items: AgendaPendingAlert[], represented: Array<Pick<AgendaPendingAlert, "source_type" | "source_id">>, search = "") {
  return unrepresentedApprovalAlerts(items, represented, search).filter(isNativeApprovalAlert);
}

export function agendaAlertActionLabel(item: Pick<AgendaPendingAlert, "source_type">): string {
  return item.source_type === "aporte_reminder" ? "Ver lançamento" : "Ver detalhes";
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
