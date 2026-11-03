import assert from "node:assert/strict";
import test from "node:test";
import { AGENDA_ALERTS_REFRESH_MS, agendaAlertBadgeLabel, normalizeAgendaAlertsView, agendaAlertDestination, additionalApprovalAlerts, unresolvedNativeApprovalAlerts, type AgendaPendingAlert } from "./agenda-alerts";

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
  assert.equal(agendaAlertDestination("/agenda-alertas?view=alertas"), "/agenda-alertas?view=alertas");
  assert.equal(agendaAlertDestination("/agenda-alertas?view=alertas&section=convites"), "/agenda-alertas?view=alertas");
  for (const href of ["/agenda-alertas?view=agenda&task=aporte1", "/carteira/imovel?tab=pulso", "/bias/bia1", "/convites-alianca?mou=bia&revisao=2"]) assert.equal(agendaAlertDestination(href), href);
});

test("aprovações incorporam aportes/imóveis e reservam convites para os controles nativos mesmo antes da resposta", () => {
  const make=(source_type:string,source_id:string,patch:Partial<AgendaPendingAlert>={}):AgendaPendingAlert=>({id:`${source_type}:${source_id}`,source_type,source_id,group:"pendencias",title:"Pagar aporte Vitória",status:"pendente",category:"financeiro",priority:"media",active:true,action_required:true,href:"/agenda-alertas?view=agenda&task=1",...patch});
  const native=[make("convite_comunidade","1"),make("bia_diretor_solicitacao","1"),make("bia_socio_solicitacao","1"),make("bia_mou_revisao","bia:2")];
  const others=[make("aporte_reminder","1"),make("carteira_alerta","1"),make("bia_aprovacao","1")];
  const items=[...native,...others,make("aporte_reminder","1",{id:"duplicate"}),make("carteira_alerta","resolved",{active:false}),make("opportunity_delivery","info",{action_required:false})];
  assert.deepEqual(additionalApprovalAlerts(items,native).map(i=>i.source_type),others.map(i=>i.source_type));
  assert.equal(additionalApprovalAlerts(items,native,"vitoria").length,3);
  assert.equal(additionalApprovalAlerts(items,native,"não encontrado").length,0);
  assert.equal(additionalApprovalAlerts(items,[]).length,3,"convites não piscam como links genéricos durante o carregamento");
  assert.deepEqual(unresolvedNativeApprovalAlerts(items,[]),native,"fontes não carregadas permanecem identificadas para loading/erro e contagem");
  assert.equal(unresolvedNativeApprovalAlerts(items,native).length,0);
  assert.equal(unresolvedNativeApprovalAlerts(items,[],"não encontrado").length,0);
  assert.equal(items.length,10,"não altera os dados das fontes");
});
