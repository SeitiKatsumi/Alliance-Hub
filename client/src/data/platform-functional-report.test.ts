import test from "node:test";
import assert from "node:assert/strict";
import {
  BIA_FUNCTIONAL_PHASES,
  BIA_ROLE_ACCESS_PROFILES,
  PLATFORM_ACCESS_CONTEXTS,
  PLATFORM_ACCESS_PROFILES,
  PLATFORM_FUNCTIONAL_MODULES,
  PLATFORM_RELEASE_CONTROLS,
  PLATFORM_FUNCTIONAL_REPORT_SUMMARY,
} from "./platform-functional-report";

test("relatório possui módulos e funcionalidades identificáveis", () => {
  assert.ok(PLATFORM_FUNCTIONAL_MODULES.length >= 10);
  assert.ok(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.features >= 80);

  const moduleIds = PLATFORM_FUNCTIONAL_MODULES.map((module) => module.id);
  const featureIds = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features.map((feature) => feature.id));

  assert.equal(new Set(moduleIds).size, moduleIds.length);
  assert.equal(new Set(featureIds).size, featureIds.length);
  assert.ok(PLATFORM_FUNCTIONAL_MODULES.every((module) => module.title && module.summary && module.features.length > 0));
});

test("relatório usa tese de interesse na BIA e nas preferências, sem renomear objetivo patrimonial", () => {
  const features = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features);
  const bia = features.find((feature) => feature.id === "bia-visao-geral")!;
  assert.match(bia.description, /Tese de interesse/);
  assert.doesNotMatch(bia.description, /objetivo|tipo de neg[oó]cio/i);
  const profiles = JSON.stringify(PLATFORM_ACCESS_PROFILES);
  assert.match(profiles, /teses de interesse/);
  assert.doesNotMatch(profiles, /tipos? de neg[oó]cios?/i);
  assert.match(features.find((feature) => feature.id === "carteira-imoveis")!.description, /objetivo/);
});

test("resumo do relatório corresponde aos itens documentados", () => {
  const features = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features);
  assert.equal(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.modules, PLATFORM_FUNCTIONAL_MODULES.length);
  assert.equal(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.features, features.length);
  assert.equal(
    PLATFORM_FUNCTIONAL_REPORT_SUMMARY.disponivel
      + PLATFORM_FUNCTIONAL_REPORT_SUMMARY.evolucao
      + PLATFORM_FUNCTIONAL_REPORT_SUMMARY.homologacao,
    features.length,
  );
});

test("relatório documenta o ciclo completo da BIA e os requisitos de cada fase", () => {
  const phaseIds = BIA_FUNCTIONAL_PHASES.map((phase) => phase.id);
  for (const phaseId of ["em_estruturacao", "em_captacao", "em_execucao", "em_operacao", "em_distribuicao", "encerrada", "ativa-legada"]) {
    assert.ok(phaseIds.includes(phaseId), `fase ausente: ${phaseId}`);
  }
  assert.equal(new Set(phaseIds).size, phaseIds.length);
  assert.ok(BIA_FUNCTIONAL_PHASES.every((phase) => phase.available.length > 0 && phase.requirements.length > 0 && phase.restrictions.length > 0));
  assert.match(BIA_FUNCTIONAL_PHASES.find((phase) => phase.id === "em_captacao")!.requirements.join(" "), /MOU\/MAP/);
  assert.match(BIA_FUNCTIONAL_PHASES.find((phase) => phase.id === "em_execucao")!.restrictions.join(" "), /dados internos desta BIA/);
});

test("relatório diferencia perfis globais, papéis da BIA e efeitos de contexto", () => {
  const profileIds = new Set(PLATFORM_ACCESS_PROFILES.map((profile) => profile.id));
  for (const profileId of ["visitante", "usuario-cadastrado", "membro-ativo", "funcionario", "aliado-built", "administracao"]) {
    assert.ok(profileIds.has(profileId), `perfil ausente: ${profileId}`);
  }
  assert.ok(PLATFORM_ACCESS_PROFILES.every((profile) => profile.available.length > 0 && profile.conditional.length > 0 && profile.unavailable.length > 0));

  const roleIds = new Set(BIA_ROLE_ACCESS_PROFILES.map((role) => role.id));
  for (const roleId of ["autor", "aliado", "diretor-alianca", "diretor-tecnico", "diretor-obra", "diretor-comercial", "diretor-capital", "socio", "terceiro", "convite-pendente", "admin-bia"]) {
    assert.ok(roleIds.has(roleId), `papel da BIA ausente: ${roleId}`);
  }
  assert.ok(BIA_ROLE_ACCESS_PROFILES.every((role) => role.defaultAccess.length > 0 && role.actions.length > 0 && role.limits.length > 0));

  const thesis = PLATFORM_ACCESS_CONTEXTS.find((context) => context.id === "tese-negocio");
  assert.ok(thesis);
  assert.match(thesis.effect.join(" "), /Célula/);
  assert.match(thesis.doesNotGrant.join(" "), /finanças|MAP/);
});

test("relatório torna bloqueadores de isolamento explícitos", () => {
  assert.ok(PLATFORM_RELEASE_CONTROLS.some((control) => control.status === "protegido"));
  assert.ok(PLATFORM_RELEASE_CONTROLS.some((control) => control.status === "validar"));
  const blockers = PLATFORM_RELEASE_CONTROLS.filter((control) => control.status === "bloqueador");
  assert.ok(blockers.some((control) => control.id === "public-bia-projection"));
  assert.ok(blockers.some((control) => control.id === "phase-write-route"));
  assert.ok(PLATFORM_RELEASE_CONTROLS.every((control) => control.rule && control.evidence && control.action));
});
