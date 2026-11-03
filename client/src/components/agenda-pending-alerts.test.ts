import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AgendaPendingAlerts } from "./agenda-pending-alerts";
import type { AgendaPendingAlert } from "../lib/agenda-alerts";

const item = (id: string, source_type = "aporte_reminder", patch: Partial<AgendaPendingAlert> = {}): AgendaPendingAlert => ({
  id, source_type, source_id: id, group: "pendencias", category: "financeiro", title: `Pendência ${id}`,
  description: "BIA de teste", priority: "media", status: "pendente", active: true, action_required: true,
  href: `/agenda-alertas?view=agenda&task=${id}`, ...patch,
});
function render(items: AgendaPendingAlert[], flags = {}) {
  return renderToStaticMarkup(React.createElement(AgendaPendingAlerts, { items, loading: false, error: false, onRetry() {}, onOpen() {}, ...flags }));
}

test("linhas adicionais exibem aportes/imóveis/BIA e deixam MOU/convites para os controles nativos", () => {
  const items = [item("aporte1"), item("aporte2"), item("imovel", "carteira_alerta"), item("bia", "bia_aprovacao"), item("mou", "bia_mou_revisao"), item("convite", "convite_comunidade"),
    item("resolvido", "aporte_reminder", {active:false}), item("historico", "aporte_reminder", {group:"historico"}), item("informativo", "opportunity_delivery", {action_required:false})];
  const html = render(items);
  assert.equal((html.match(/<li>/g) || []).length, 4);
  for (const id of ["aporte1", "aporte2", "imovel", "bia"]) assert.ok(html.includes(`Pendência ${id}`));
  assert.doesNotMatch(html, /Pendência (mou|convite|resolvido|historico|informativo)/);
  assert.equal((html.match(/Ver lançamento/g)||[]).length,2);
  assert.equal((html.match(/Ver detalhes/g)||[]).length,2);
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
  const approvals=readFileSync(new URL("../pages/comunidade.tsx",import.meta.url),"utf8");
  assert.match(approvals,/fetch\("\/api\/agenda-alertas\/alertas\?grupo=pendencias"/);
  assert.match(approvals,/items=\{additionalApprovals\}/);
  assert.match(page,/view === "alertas" && <ConvitesPage embedded \/>/);
  assert.doesNotMatch(page,/Tipos de alertas|showInvites|<AgendaPendingAlerts/);
  assert.match(page,/navigate\(agendaAlertDestination\(item.href\)\)/);
  assert.doesNotMatch(render([item("1")]), /<section|<h2/,'linhas não criam um segundo painel');
});
