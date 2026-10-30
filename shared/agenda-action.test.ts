import assert from "node:assert/strict";
import test from "node:test";
import { agendaSourceAction, agendaTaskHref, agendaTaskTitle, matchesMouRevision } from "./agenda-action";

const task = { id: "task-1", titulo: "Revise o MOU da BIA", contexto_tipo: "bia", contexto_id: "bia-1", origem_tarefa_id: "map:bia-1:3", status: "pendente" };
test("aviso legado abre o documento da BIA e revisão exatas sem depender do título", () => {
  assert.equal(agendaTaskHref(task), "/convites-alianca?mou=bia-1&revisao=3");
  assert.equal(agendaTaskTitle(task), "Ler e aceitar MOU · revisão 3");
  assert.equal(agendaTaskHref({ ...task, titulo: "Título editado" }), agendaTaskHref(task));
});
test("tarefa manual, correção informativa e histórico preservam edição por ID", () => {
  for (const value of [
    { ...task, origem_tarefa_id: null }, { ...task, contexto_id: "outra" },
    { ...task, titulo: "MAP Inicial corrigido" }, { ...task, status: "concluida" },
    { ...task, status: "cancelada" }, { ...task, origem_tarefa_id: "map:bia-1:3abc" },
    { ...task, origem_tarefa_id: "map:bia-1:0" },
  ]) {
    assert.equal(agendaSourceAction(value), null);
    assert.equal(agendaTaskHref(value), "/agenda-alertas?view=agenda&task=task-1");
  }
});
test("aportes abrem pagamento ou lista sem inventar um fluxo ausente", () => {
  assert.equal(agendaTaskHref({ ...task, contexto_tipo: "aporte_reminder", origem_tarefa_id: "flow&1" }), "/bias/bia-1?tab=capital&capital=financeiro&paymentFlow=flow%261");
  assert.equal(agendaTaskHref({ ...task, contexto_tipo: "bia_contribution" }), "/bias/bia-1?tab=capital&capital=financeiro&financeiro=aportes");
  assert.equal(agendaSourceAction({ ...task, contexto_tipo: "aporte_reminder", origem_tarefa_id: null }), null);
});
test("links vencidos e revisões inválidas nunca escolhem outra versão", () => {
  assert.equal(matchesMouRevision(3, 3), true);
  for (const revision of [2, 4, 0, -1, 3.5, NaN, Infinity, "3", undefined]) assert.equal(matchesMouRevision(revision, 3), false);
});
