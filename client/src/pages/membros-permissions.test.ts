import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { updateUserSchema } from "../../../shared/schema";

test("Vitrine preserva selecao explicita junto a Aliado ao salvar e reabrir", () => {
  const page = readFileSync(new URL("./membros.tsx", import.meta.url), "utf8");
  assert.match(page, /value: "user", label: "BUILT Vitrine"/);
  assert.doesNotMatch(page, /vitrine-default-access/);
  const mergeSource = page.slice(page.indexOf("function mergeRolePermissions("), page.indexOf("function applyRoleSelection("));
  const merge = new Function(ts.transpile(mergeSource) + "; return mergeRolePermissions;")();
  const hydrateSource = page.slice(page.indexOf("const initialRoles ="), page.indexOf("setSelectedRole(linkedUser.role)"));
  const hydrate = new Function("linkedUser", "selos", ts.transpile(hydrateSource) + "; return Array.from(initialRoles);");
  for (const selected of [true, false]) {
    const permissions = merge(selected ? ["aliado", "user"] : ["aliado"], {user:{aura:"view"},aliado:{bias:"edit"}});
    const saved = updateUserSchema.parse({role:"aliado",permissions});
    const reopened = hydrate(JSON.parse(JSON.stringify(saved)), ["BUILT_ALLIANCE_PARTNER"]);
    assert.equal(reopened.includes("user"), selected);
    assert.ok(reopened.includes("aliado"));
    assert.equal(saved.permissions?.bias, "edit");
  }
  assert.ok(hydrate({role:"user"},[]).includes("user"));
  assert.ok(!hydrate({role:"aliado"},[]).includes("user"));
});
