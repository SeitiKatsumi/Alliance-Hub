import assert from "node:assert/strict";
import test from "node:test";
import { agendaAlertBadgeLabel, normalizeAgendaAlertsView } from "./agenda-alerts";

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
