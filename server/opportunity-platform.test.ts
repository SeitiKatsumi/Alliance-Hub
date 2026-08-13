import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDistributionSchedule,
  canReadRestrictedOpportunity,
  createDemandCode,
  createEconomicOpportunityCode,
  createOpaCode,
  isOpportunityEditable,
  isOpportunityPublic,
  normalizeEconomicOpportunityStage,
  normalizeOpportunityStatus,
  normalizeRoDecisionAction,
  opportunityExpiry,
  publicOpportunityRegistryView,
} from "./opportunity-platform";

test("opportunity lifecycle normalizes legacy statuses", () => {
  assert.equal(normalizeOpportunityStatus("ativa"), "aberta");
  assert.equal(normalizeOpportunityStatus("em_andamento"), "em_execucao");
  assert.equal(isOpportunityEditable("convertida"), false);
});

test("stable code formats are recognizable", () => {
  assert.match(createDemandCode(), /^DEM-[A-Z2-9]{10}$/);
  assert.match(createEconomicOpportunityCode(), /^OPP-[A-Z2-9]{10}$/);
  assert.equal(createOpaCode("VRHR6GEEXL", 3), "OBA-VRHR6GEEXL-03");
});

test("economic stages and RO actions reject unknown values", () => {
  assert.equal(normalizeEconomicOpportunityStage("pronta-para-decisao"), "pronta_decisao");
  assert.equal(normalizeEconomicOpportunityStage("qualquer-coisa"), "identificada");
  assert.equal(normalizeRoDecisionAction("gerar-demanda"), "gerar_demanda");
  assert.equal(normalizeRoDecisionAction("criar_bia_diretamente"), null);
});

test("default expiry is sixty days", () => {
  const start = new Date("2026-08-11T00:00:00.000Z");
  assert.equal(opportunityExpiry(start).toISOString(), "2026-10-10T00:00:00.000Z");
});

test("gradual distribution advances every twelve hours", () => {
  const start = new Date("2026-08-11T00:00:00.000Z");
  const waves = buildDistributionSchedule(start);
  assert.equal(waves.length, 6);
  assert.equal(waves[0].audiencia, "comunidade_origem");
  assert.equal(waves[1].agendada_em.toISOString(), "2026-08-11T12:00:00.000Z");
  assert.equal(waves[5].audiencia, "vitrine_geral");
});

test("public opportunities exclude expired and terminal records", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");
  assert.equal(isOpportunityPublic("aberta", "publicada", "2026-08-12T00:00:00.000Z", now), true);
  assert.equal(isOpportunityPublic("concluida", "publicada", null, now), false);
  assert.equal(isOpportunityPublic("aberta", "publicada", "2026-08-10T00:00:00.000Z", now), false);
});

test("restricted opportunities never match an anonymous actor through empty ids", () => {
  assert.equal(canReadRestrictedOpportunity({}), false);
  assert.equal(canReadRestrictedOpportunity({ actorMemberId: "m-1", reviewerMemberId: "m-1" }), true);
  assert.equal(canReadRestrictedOpportunity({ actorUserId: "u-1", creatorUserId: "u-1" }), true);
  assert.equal(canReadRestrictedOpportunity({ isAdmin: true }), true);
});

test("public opportunity view omits internal ownership and metadata", () => {
  const view = publicOpportunityRegistryView({
    id: "registry-1",
    source_id: "demand-1",
    codigo: "DEM-1234567890",
    tipo: "demanda",
    titulo: "Avaliação do imóvel",
    descricao: "Resumo autorizado",
    visibilidade: "publicada",
    especialidades: ["Avaliação"],
    autor_user_id: "private-user",
    responsavel_membro_id: "private-member",
    metadata: { internal: true },
    url: "/vitrine/oportunidades/demandas/demand-1",
  });

  assert.equal(view.titulo, "Avaliação do imóvel");
  assert.equal("autor_user_id" in view, false);
  assert.equal("responsavel_membro_id" in view, false);
  assert.equal("metadata" in view, false);
});
