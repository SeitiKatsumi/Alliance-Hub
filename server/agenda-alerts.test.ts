import assert from "node:assert/strict";
import test from "node:test";
import {
  activeAgendaAlertCount,
  agendaAlertBadge,
  dedupeAgendaAlertItems,
  type AgendaAlertItem,
} from "./agenda-alerts";

function item(overrides: Partial<AgendaAlertItem> = {}): AgendaAlertItem {
  return {
    id: "alert-1",
    source_type: "convite",
    source_id: "source-1",
    group: "pendencias",
    category: "convite",
    title: "Convite pendente",
    priority: "alta",
    status: "pendente",
    action_required: true,
    active: true,
    href: "/agenda-alertas?view=alertas",
    actions: ["aceitar", "recusar"],
    ...overrides,
  };
}

test("deduplica a mesma origem encontrada por relacoes diferentes", () => {
  const alerts = dedupeAgendaAlertItems([
    item(),
    item({ id: "alert-copy", priority: "media" }),
  ]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].priority, "alta");
});

test("contador inclui apenas pendencias ativas e acionaveis", () => {
  const total = activeAgendaAlertCount([
    item(),
    item({ source_id: "update", group: "atualizacoes", action_required: false }),
    item({ source_id: "history", group: "historico", active: false }),
    item({ source_id: "resolved", active: false }),
  ]);
  assert.equal(total, 1);
});

test("badge fica oculto em zero e limitado a 99+", () => {
  assert.equal(agendaAlertBadge(0), null);
  assert.equal(agendaAlertBadge(12), 12);
  assert.equal(agendaAlertBadge(100), "99+");
});
