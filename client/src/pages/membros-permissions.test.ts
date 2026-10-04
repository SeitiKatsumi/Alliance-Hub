import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { updateUserSchema } from "../../../shared/schema";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

test("comunidade mãe de origem aparece sem se passar por associação e erro não aparece como ausência", () => {
  const page = readFileSync(new URL("./membros.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("membros.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let block: ts.JsxElement | undefined;
  function find(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.getText(ast).includes('data-testid="lista-comunidades-vinculadas"')) block = node;
    ts.forEachChild(node, find);
  }
  find(ast);
  assert.ok(block);
  const render = new Function("React", "Button", "Lock", "Trash2", "membro", "comunidadesLoading", "comunidadesError", "refetchComunidades", "membroComunidadesList", "removeComunidadeMutation", transformSync(`return (${block.getText(ast)});`, { loader: "tsx" }).code);
  const icon = () => null;
  const list = [{ id: "5", nome: "Comunidade A01", papel: "origem", is_mae: true, locked: true }];
  const html = (loading: boolean, error: boolean, items = list) => renderToStaticMarkup(render(React, "button", icon, icon, { id: "pessoa" }, loading, error, () => {}, items, {}));
  assert.match(html(false, false), /Comunidade A01/);
  assert.match(html(false, false), /Comunidade Mãe/);
  assert.match(html(false, false), /associação não confirmada/);
  assert.doesNotMatch(html(false, false), /Membro associado|btn-remover-comunidade/);
  assert.match(html(false, true, []), /Tentar novamente/);
  assert.doesNotMatch(html(false, true, []), /Nenhuma comunidade vinculada/);
  assert.match(html(true, false, []), /Carregando comunidades/);
  assert.match(html(false, false, []), /Nenhuma comunidade vinculada/);
  assert.match(page, /comunidades\?incluir_origem=1/);
  assert.match(page, /filter\(\(c\) => c.papel !== "origem"\)/);
  assert.match(page, /const hasAnyComunidade = linkedComunidadeIds.size > 0/);
});

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
