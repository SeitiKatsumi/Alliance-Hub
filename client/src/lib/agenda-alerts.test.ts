import assert from "node:assert/strict";
import test from "node:test";
import { AGENDA_ALERTS_REFRESH_MS, agendaAlertBadgeLabel, normalizeAgendaAlertsView, agendaAlertDestination } from "./agenda-alerts";

test("aprovacoes ativas atualizam sem espera perceptivel", () => {
  assert.ok(AGENDA_ALERTS_REFRESH_MS <= 2000);
});

test("mantem as visualizacoes persistentes validas", () => {
  assert.equal(normalizeAgendaAlertsView("resumo", true), "resumo");
  assert.equal(normalizeAgendaAlertsView("agenda", true), "agenda");
  assert.equal(normalizeAgendaAlertsView("alertas", true), "alertas");
});

test("funcionario sem Agenda e direcionado aos Alertas", () => {
  assert.equal(normalizeAgendaAlertsView("agenda", false), "alertas");
});

test("badge fica oculto em zero e limitado a 99+", () => {
  assert.equal(agendaAlertBadgeLabel(0), null);
  assert.equal(agendaAlertBadgeLabel(18), "18");
  assert.equal(agendaAlertBadgeLabel(140), "99+");
});

test("alertas abrem sua origem e convites não entram em loop na lista de pendências", () => {
  assert.equal(agendaAlertDestination("/agenda-alertas?view=alertas"), "/agenda-alertas?view=alertas&section=convites");
  for (const href of ["/agenda-alertas?view=agenda&task=aporte1", "/carteira/imovel?tab=pulso", "/bias/bia1", "/convites-alianca?mou=bia&revisao=2"]) assert.equal(agendaAlertDestination(href), href);
});
