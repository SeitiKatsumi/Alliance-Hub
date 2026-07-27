import assert from "node:assert/strict";
import test from "node:test";
import {
  companyAccessToLegacyPermissions,
  hasCompanyAccess,
  normalizeCompanyAccess,
} from "./company-access";

test("normaliza a matriz e aplica o acesso inicial mínimo", () => {
  const permissions = normalizeCompanyAccess({});
  assert.equal(permissions.inicio, "view");
  assert.equal(permissions.agenda, "none");
  assert.equal(permissions.alliances, "none");
});

test("editar também permite visualizar, mas visualizar não permite editar", () => {
  const permissions = normalizeCompanyAccess({
    carteira: "edit",
    capital: "view",
  });
  assert.equal(hasCompanyAccess(permissions, "carteira", "view"), true);
  assert.equal(hasCompanyAccess(permissions, "carteira", "edit"), true);
  assert.equal(hasCompanyAccess(permissions, "capital", "view"), true);
  assert.equal(hasCompanyAccess(permissions, "capital", "edit"), false);
});

test("níveis inválidos não ampliam permissões", () => {
  const permissions = normalizeCompanyAccess({
    aura: "admin",
    agenda: "edit",
  });
  assert.equal(permissions.aura, "none");
  assert.equal(permissions.agenda, "edit");
});

test("converte acessos empresariais para os módulos legados da sessão", () => {
  const legacy = companyAccessToLegacyPermissions({
    inicio: "view",
    agenda: "none",
    carteira: "none",
    vitrine: "none",
    alliances: "edit",
    capital: "view",
    aura: "edit",
  });
  assert.equal(legacy.bias, "edit");
  assert.equal(legacy.oportunidades, "edit");
  assert.equal(legacy.fluxo_caixa, "view");
  assert.equal(legacy.calculadora, "view");
  assert.equal(legacy.aura, "edit");
  assert.equal(legacy.admin, "none");
});
