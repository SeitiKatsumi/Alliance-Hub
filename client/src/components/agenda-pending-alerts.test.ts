import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AgendaPendingAlerts } from "./agenda-pending-alerts";
import type { AgendaPendingAlert } from "../lib/agenda-alerts";
import { activeAgendaAlertCount, type AgendaAlertItem } from "../../../server/agenda-alerts";

const item = (id: string, source_type = "aporte_reminder", patch: Partial<AgendaPendingAlert> = {}): AgendaPendingAlert => ({
  id, source_type, source_id: id, group: "pendencias", category: "financeiro", title: `Pendência ${id}`,
  description: "BIA de teste", priority: "media", status: "pendente", active: true, action_required: true,
  href: `/agenda-alertas?view=agenda&task=${id}`, ...patch,
});
function render(items: AgendaPendingAlert[], flags = {}) {
  return renderToStaticMarkup(React.createElement(AgendaPendingAlerts, { items, loading: false, error: false, onRetry() {}, onOpen() {}, ...flags }));
}

test("lista exibe todos os tipos contados, inclusive os dois aportes sem aprovações e mais de cinco itens", () => {
  const items = [item("aporte1"), item("aporte2"), item("imovel", "carteira_alerta"), item("bia", "bia_aprovacao"), item("mou", "bia_mou_revisao"), item("convite", "convite_comunidade"),
    item("resolvido", "aporte_reminder", {active:false}), item("historico", "aporte_reminder", {group:"historico"}), item("informativo", "opportunity_delivery", {action_required:false})];
  const html = render(items);
  assert.equal((html.match(/<li>/g) || []).length, activeAgendaAlertCount(items as AgendaAlertItem[]));
  assert.equal((html.match(/<li>/g) || []).length, 6);
  for (const id of ["aporte1", "aporte2", "imovel", "bia", "mou", "convite"]) assert.ok(html.includes(`Pendência ${id}`));
  assert.doesNotMatch(html, /Pendência (resolvido|historico|informativo)/);
  assert.equal((render([item("1"), item("2")]).match(/<li>/g) || []).length, 2);
});

test("erro e carregamento não se passam por ausência de pendências", () => {
  assert.match(render([], {error:true}), /Não foi possível atualizar/);
  assert.doesNotMatch(render([], {error:true}), /Nenhuma pendência/);
  assert.match(render([], {loading:true}), /Carregando alertas/);
  assert.doesNotMatch(render([], {loading:true}), /Nenhuma pendência/);
  assert.match(render([]), /Nenhuma pendência ativa/);
  assert.doesNotMatch(render([item("antigo")], {error:true}), /Pendência antigo/);
});

test("aba consulta a projeção completa dos alertas e mantém ações antigas separadas", () => {
  const page=readFileSync(new URL("../pages/agenda-alertas.tsx",import.meta.url),"utf8");
  assert.match(page,/fetch\("\/api\/agenda-alertas\/alertas\?grupo=pendencias"/);
  assert.match(page,/items=\{pendingAlerts.data \|\| \[\]\}/);
  assert.match(page,/showInvites \? <ConvitesPage embedded \/> : <AgendaPendingAlerts/);
  assert.match(page,/navigate\(agendaAlertDestination\(item.href\)\)/);
});
