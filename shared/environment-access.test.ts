import assert from "node:assert/strict";
import test from "node:test";
import { canAccessBuiltEnvironment, canPublishVitrineProfile, isBuiltAlliancesMember } from "./environment-access";

test("todo usuário cadastrado acessa a Área de Vitrine", () => {
  const user = {
    role: "user",
    account_purposes: ["imoveis"],
    na_vitrine: false,
    em_membros_built: false,
  };

  assert.equal(canAccessBuiltEnvironment(user, "vitrine"), true);
  assert.equal(canAccessBuiltEnvironment(user, "alliances"), false);
});

test("perfil profissional acessa a Área de Vitrine sem publicar o perfil", () => {
  assert.equal(canAccessBuiltEnvironment({
    role: "user",
    account_purposes: ["profissional"],
    na_vitrine: false,
  }, "vitrine"), true);
  assert.equal(canPublishVitrineProfile({ role: "user", account_purposes: ["profissional"] }), true);
  assert.equal(canPublishVitrineProfile({ role: "user", account_purposes: ["imoveis"] }), false);
});

test("finalidade de imóvel também libera Alliances quando a pessoa é membro", () => {
  const user = {
    role: "user",
    account_purposes: ["imoveis"],
    has_alliance_participation: true,
  };

  assert.equal(isBuiltAlliancesMember(user), true);
  assert.equal(canAccessBuiltEnvironment(user, "alliances"), true);
});

test("mantém acessos legados e permissões explícitas de funcionário", () => {
  assert.equal(canAccessBuiltEnvironment({ role: "user", na_vitrine: true }, "vitrine"), true);
  assert.equal(canAccessBuiltEnvironment({ role: "membro", has_alliance_participation: true }, "alliances"), true);
  assert.equal(canAccessBuiltEnvironment({
    role: "user",
    account_purposes: ["imoveis"],
    company_employee: true,
    company_permissions: { vitrine: "none" },
  }, "vitrine"), false);
  assert.equal(canAccessBuiltEnvironment({
    role: "user",
    company_employee: true,
    company_permissions: { vitrine: "view" },
  }, "vitrine"), true);
});
