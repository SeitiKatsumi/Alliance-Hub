/** Navigation only. The destination must still authorize the current member. */
export interface AgendaActionSource {
  id: string;
  titulo?: string | null;
  status?: string | null;
  contexto_tipo?: string | null;
  contexto_id?: string | null;
  origem_tarefa_id?: string | null;
}

export const MOU_REVIEW_LABEL = "Ler e aceitar MOU";
export function mouRevisionHref(biaId: string, revision: number) {
  return `/convites-alianca?mou=${encodeURIComponent(biaId)}&revisao=${revision}`;
}

export function agendaSourceAction(task: AgendaActionSource): { href: string; label: string } | null {
  if (["concluida", "cancelada"].includes(task.status || "")) return null;
  const biaId = task.contexto_id;
  if (!biaId) return null;
  // The same origin was also used for informational corrections after activation.
  if (task.contexto_tipo === "bia" && task.titulo !== "MAP Inicial corrigido") {
    const prefix = `map:${biaId}:`;
    const revision = task.origem_tarefa_id?.startsWith(prefix) ? task.origem_tarefa_id.slice(prefix.length) : "";
    if (/^[1-9]\d*$/.test(revision) && Number.isSafeInteger(Number(revision))) {
      return { href: mouRevisionHref(biaId, Number(revision)), label: `${MOU_REVIEW_LABEL} · revisão ${revision}` };
    }
  }
  const financial = `/bias/${encodeURIComponent(biaId)}?tab=capital&capital=financeiro`;
  if (task.contexto_tipo === "aporte_reminder" && task.origem_tarefa_id) {
    return { href: `${financial}&paymentFlow=${encodeURIComponent(task.origem_tarefa_id)}`, label: "Consultar aporte · Pix e boleto" };
  }
  if (task.contexto_tipo === "bia_contribution") {
    return { href: `${financial}&financeiro=aportes`, label: "Consultar aporte da BIA" };
  }
  return null;
}

export function agendaTaskHref(task: AgendaActionSource) {
  return agendaSourceAction(task)?.href || `/agenda-alertas?view=agenda&task=${encodeURIComponent(task.id)}`;
}

export function agendaTaskTitle(task: AgendaActionSource) {
  const action = agendaSourceAction(task);
  return task.contexto_tipo === "bia" && action ? action.label : task.titulo || "Ação da agenda";
}

/** Reject stale links instead of silently opening a different revision. */
export function matchesMouRevision(expected: unknown, current: number) {
  return typeof expected === "number" && Number.isSafeInteger(expected) && expected > 0 && expected === current;
}
