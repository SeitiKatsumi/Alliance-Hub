import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_BIA_ACCESS,
  canConfigureBiaParticipantAccess,
  canManageBiaAccess,
  collectBiaParticipantRoles,
  defaultBiaAccessForRoles,
  hasBiaAccess,
  isBiaPlatformAdminRole,
  mergeBiaAccess,
  normalizeBiaAccessMatrix,
  resolveBiaParticipantPermissions,
} from "./bia-access";

test("aplica os padrões de acesso de cada papel", () => {
  assert.equal(defaultBiaAccessForRoles(["autor"]).diretoria, "view");
  assert.equal(defaultBiaAccessForRoles(["aliado"]).diretoria, "edit");
  assert.equal(defaultBiaAccessForRoles(["diretor_alianca"]).configuracao_bia, "edit");
  assert.equal(defaultBiaAccessForRoles(["diretor_tecnico"]).documentos_tecnico, "edit");
  assert.equal(defaultBiaAccessForRoles(["diretor_obra"]).documentos_obra, "edit");
  assert.equal(defaultBiaAccessForRoles(["diretor_comercial"]).documentos_comercial, "edit");

  const capital = defaultBiaAccessForRoles(["diretor_capital"]);
  assert.equal(capital.documentos_capital, "edit");
  assert.equal(capital.capital_banco, "edit");
  assert.equal(capital.capital_financeiro, "edit");
  assert.equal(capital.capital_analises, "edit");
  assert.equal(capital.capital_calculadora, "edit");

  assert.deepEqual(defaultBiaAccessForRoles(["socio_guardiao", "socio_multiplicador", "terceiro"]), EMPTY_BIA_ACCESS);
});

test("combina múltiplos papéis sempre pelo maior acesso", () => {
  const combined = defaultBiaAccessForRoles(["autor", "diretor_tecnico", "diretor_capital"]);
  assert.equal(combined.diretoria, "view");
  assert.equal(combined.documentos_tecnico, "edit");
  assert.equal(combined.capital_calculadora, "edit");
  assert.equal(combined.documentos_obra, "none");

  const merged = mergeBiaAccess(
    { diretoria: "view" },
    { diretoria: "edit", capital_banco: "view" },
  );
  assert.equal(merged.diretoria, "edit");
  assert.equal(merged.capital_banco, "view");
});

test("edit inclui view e a normalização rejeita níveis desconhecidos", () => {
  const matrix = normalizeBiaAccessMatrix({ diretoria: "edit", capital_banco: "qualquer" });
  assert.equal(hasBiaAccess(matrix, "diretoria", "view"), true);
  assert.equal(hasBiaAccess(matrix, "diretoria", "edit"), true);
  assert.equal(matrix.capital_banco, "none");
});

test("coleta participantes sem duplicar quem ocupa vários papéis", () => {
  const participants = collectBiaParticipantRoles({
    autor_bia: "m1",
    aliado_built: { id: "m1" },
    diretor_capital: "m2",
    socios_guardioes: JSON.stringify(["m2", "m3"]),
    socios_multiplicadores: [{ cadastro_geral_id: { id: "m4" } }],
    terceiros: ["m5"],
  });

  assert.deepEqual(participants.get("m1"), ["autor", "aliado"]);
  assert.deepEqual(participants.get("m2"), ["diretor_capital", "socio_guardiao"]);
  assert.deepEqual(participants.get("m4"), ["socio_multiplicador"]);
  assert.equal(participants.size, 5);
  assert.equal(canManageBiaAccess(participants.get("m1") || []), true);
  assert.equal(canManageBiaAccess(participants.get("m3") || []), false);
});

test("a personalização explícita prevalece sobre o padrão do papel", () => {
  const customized = resolveBiaParticipantPermissions(["diretor_tecnico"], {
    diretoria: "view",
    configuracao_bia: "none",
    documentos_tecnico: "view",
    documentos_obra: "none",
    documentos_comercial: "none",
    documentos_capital: "none",
    capital_banco: "none",
    capital_financeiro: "none",
    capital_analises: "none",
    capital_calculadora: "none",
  });

  assert.equal(customized.documentos_tecnico, "view");
  assert.equal(customized.diretoria, "view");
});

test("restaurar remove a personalização e recupera o padrão", () => {
  const restored = resolveBiaParticipantPermissions(["diretor_capital"], null);
  assert.equal(restored.documentos_capital, "edit");
  assert.equal(restored.capital_banco, "edit");
  assert.equal(restored.capital_financeiro, "edit");
  assert.equal(restored.capital_analises, "edit");
  assert.equal(restored.capital_calculadora, "edit");
});

test("falha de armazenamento nega módulos internos e preserva a gestão fixa", () => {
  const participant = resolveBiaParticipantPermissions(["diretor_capital"], null, false);
  assert.deepEqual(participant, normalizeBiaAccessMatrix({}));

  const manager = resolveBiaParticipantPermissions(["aliado"], null, false);
  assert.equal(manager.diretoria, "edit");
  assert.equal(manager.configuracao_bia, "none");
  assert.equal(manager.capital_financeiro, "none");
});

test("nao oferece configuracao de permissoes para terceiros puros", () => {
  assert.equal(canConfigureBiaParticipantAccess(["terceiro"]), false);
  assert.equal(canConfigureBiaParticipantAccess(["terceiro", "socio_guardiao"]), true);
  assert.equal(canConfigureBiaParticipantAccess(["diretor_tecnico"]), true);
});

test("admin e superadmin podem administrar qualquer BIA", () => {
  assert.equal(isBiaPlatformAdminRole("admin"), true);
  assert.equal(isBiaPlatformAdminRole("superadmin"), true);
  assert.equal(isBiaPlatformAdminRole("user"), false);
});
