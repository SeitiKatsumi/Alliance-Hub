export type AgendaAlertGroup = "pendencias" | "atualizacoes" | "historico";
export type AgendaAlertPriority = "critica" | "alta" | "media" | "baixa";

export interface AgendaAlertItem {
  id: string;
  source_type: string;
  source_id: string;
  group: AgendaAlertGroup;
  category: string;
  title: string;
  description?: string | null;
  priority: AgendaAlertPriority;
  status: string;
  created_at?: string | Date | null;
  due_at?: string | Date | null;
  action_required: boolean;
  active: boolean;
  href: string;
  actions: string[];
  metadata?: Record<string, unknown>;
}

const PRIORITY_ORDER: Record<AgendaAlertPriority, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

function itemTime(item: AgendaAlertItem): number {
  const value = item.due_at || item.created_at;
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function dedupeAgendaAlertItems(items: AgendaAlertItem[]): AgendaAlertItem[] {
  const deduped = new Map<string, AgendaAlertItem>();
  for (const item of items) {
    const key = `${item.source_type}:${item.source_id}`;
    const current = deduped.get(key);
    if (!current || PRIORITY_ORDER[item.priority] < PRIORITY_ORDER[current.priority]) {
      deduped.set(key, item);
    }
  }
  return Array.from(deduped.values());
}

export function sortAgendaAlertItems(items: AgendaAlertItem[]): AgendaAlertItem[] {
  return [...items].sort((a, b) => {
    const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priority !== 0) return priority;
    return itemTime(a) - itemTime(b);
  });
}

export function activeAgendaAlertCount(items: AgendaAlertItem[]): number {
  return dedupeAgendaAlertItems(items).filter((item) =>
    item.group === "pendencias" && item.action_required && item.active,
  ).length;
}

export function agendaAlertBadge(total: number): number | "99+" | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  if (total > 99) return "99+";
  return Math.floor(total);
}
