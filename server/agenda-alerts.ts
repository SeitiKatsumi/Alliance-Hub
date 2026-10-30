import { sql } from "drizzle-orm";
import { MOU_REVIEW_LABEL, mouRevisionHref } from "../shared/agenda-action";

export type AgendaAlertGroup = "pendencias" | "atualizacoes" | "historico";

/** Project existing revision notices; never create invitations, acceptances or tasks on read. */
export async function listMouRevisionAlerts(db: any, userId: string, memberId: string | null, version: string,
  eligible: (biaId: string) => Promise<boolean>): Promise<AgendaAlertItem[]> {
  if (!memberId) return [];
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (s.bia_id) t.id,t.titulo,t.descricao,t.atualizado_em,s.bia_id,s.revisao
    FROM agenda_tarefas t JOIN bia_map_inicial_snapshots s ON s.bia_id=t.contexto_id
    WHERE t.user_id=${userId} AND t.membro_id=${memberId} AND t.contexto_tipo='bia'
      AND t.status IN ('pendente','em_andamento') AND s.ativado_em IS NULL AND s.revisao>0
      AND t.origem_tarefa_id='map:' || s.bia_id || ':' || s.revisao::text
      AND NOT EXISTS (SELECT 1 FROM bia_mou_aceites a WHERE a.bia_id=s.bia_id AND a.membro_id=${memberId}
        AND a.mou_versao=${version} AND a.map_revisao=s.revisao)
    ORDER BY s.bia_id,t.atualizado_em DESC,t.id
  `)).rows;
  const items: AgendaAlertItem[] = [];
  for (const row of rows) {
    if (!await eligible(String(row.bia_id))) continue;
    const sourceId=`${row.bia_id}:${row.revisao}`;
    items.push({id:`mou:${sourceId}`,source_type:"bia_mou_revisao",source_id:sourceId,
      group:"pendencias",category:"convite_bia",title:`${MOU_REVIEW_LABEL} · revisão ${row.revisao}`,
      description:row.descricao,priority:"alta",status:"pendente",created_at:row.atualizado_em,
      action_required:true,active:true,href:mouRevisionHref(String(row.bia_id),Number(row.revisao)),actions:["consultar"],
      metadata:{bia_id:String(row.bia_id),map_revisao:Number(row.revisao)}});
  }
  return items;
}
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
