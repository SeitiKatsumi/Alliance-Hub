import assert from "node:assert/strict";
import { test } from "node:test";
import { memberDisplayName } from "./member-display-name";
import { readFileSync } from "node:fs";

test("session display follows the saved profile name even when the login differs", () => {
  const member = { nome: "Luhan", Nome_de_usuario: "luhan123123" };
  assert.equal(memberDisplayName(member, "Old session"), "Luhan");
  assert.equal(memberDisplayName({ ...member, nome: "Novo nome" }, "Luhan"), "Novo nome");
});

test("legacy profiles retain username or session fallback without blank names", () => {
  assert.equal(memberDisplayName({ nome: "  ", Nome_de_usuario: " login " }), "login");
  assert.equal(memberDisplayName(null, "Session"), "Session");
  assert.equal(memberDisplayName({ nome: null, Nome_de_usuario: null }), "");
  assert.equal(memberDisplayName({ nome: "Empresa SPE Ltda" }), "Empresa SPE Ltda");
});

test("login e sessão usam a mesma regra, inclusive Google, sem trocar a identidade do funcionário", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const google = readFileSync("server/auth-google.ts", "utf8");
  assert.match(routes, /nome = memberDisplayName\(m, nome\)/);
  assert.match(routes, /nome = memberDisplayName\(match, nome\)/);
  assert.match(routes, /if \(!companyEmployee\) nomePerfil = memberDisplayName\(membro, nomePerfil\)/);
  assert.match(google, /nomeSessao = memberDisplayName\(m, nomeSessao\)/);
  assert.match(google, /nomeSessao = memberDisplayName\(d\.data, nomeSessao\)/);
  assert.doesNotMatch(google, /getMembroDisplayName/);
});
