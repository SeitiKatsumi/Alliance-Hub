import test from "node:test";
import {accountProfiles} from "../../../shared/member-access-summary";
import {accountAccessPreset} from "../../../shared/account-access-profiles";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { updateUserSchema } from "../../../shared/schema";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

test('atalho de correção abre somente membro autorizado e foca campo permitido',()=>{
  const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
  assert.match(page,/user\?\.role !== 'admin' \|\| isLoading/);
  assert.match(page,/membros.find\(m => String\(m.id\) === requestedMember\)/);
  assert.match(page,/targets\[requestedCorrectionField \|\| ''\]/);
  assert.match(page,/field\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(page,/correctionOpened.current = true/);
});

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

test('trocar o nível registra somente o novo perfil e preserva as exceções individuais',()=>{
  const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
  const source=page.slice(page.indexOf('function selectAccountProfile('),page.indexOf('function handlePhotoSelect('));
  let preset:unknown;
  let form:any={Outras_redes_as_quais_pertenco:['CUSTOM','BUILT_PROUD_MEMBER']};
  const select=new Function('setSelectedPreset','setForm','ROLE_MANAGED_SELOS','ROLE_AUTO_SELOS','setAccessProfileTouched','accountAccessPreset',ts.transpile(source)+';return selectAccountProfile;')(
    (v:any)=>preset=v,(fn:any)=>form=fn(form),new Set(['BUILT_PROUD_MEMBER']),{membro:['BUILT_PROUD_MEMBER']},()=>{},accountAccessPreset);
  select('admin'); assert.equal(preset,'admin'); assert.deepEqual(form.Outras_redes_as_quais_pertenco,['CUSTOM']);
  select('membro'); assert.equal(form.em_membros_built,true); assert.deepEqual(form.Outras_redes_as_quais_pertenco,['CUSTOM','BUILT_PROUD_MEMBER']);
  assert.match(page,/choiceDraft \?\? areaChoices\(linkedUser.permissions\)/);
  assert.doesNotMatch(source,/setChoiceDraft/);
});

test("Proud Member sem vínculo confirma a comunidade mãe antes de salvar", () => {
  const page = readFileSync(new URL("./membros.tsx", import.meta.url), "utf8");
  const start = page.indexOf('if (selosForm.includes("BUILT_PROUD_MEMBER") && !hasAnyComunidade)');
  const block = page.slice(start, page.indexOf('let fotoId', start));
  assert.match(block, /if \(!comunidadeMaeAtual\?\.id\)/);
  assert.match(block, /await apiRequest\("PATCH", `\/api\/membros\/\$\{membro.id\}\/comunidade-mae`/);
});

test("edicao administrativa de membro usa pagina completa organizada por abas", () => {
  const page = readFileSync(new URL("./membros.tsx", import.meta.url), "utf8");
  assert.match(page, /data-testid="membro-editor-page"/);
  assert.match(page, /"Dados gerais"/);
  assert.match(page, /"Comunidades"/);
  assert.match(page, /"Perfil e presença"/);
  assert.match(page, /"Acessos"/);
  assert.match(page, /"Termos"/);
  assert.match(page, /"Histórico"/);
  assert.match(page, /return <MembroEditPage membro=\{editingMembro\}/);
  assert.doesNotMatch(page, /<Sheet(?:Content)?\b/);
});

test('há um único controle de perfil por conta existente, e o mesmo editor cria contas novas',()=>{
  const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
  assert.equal((page.match(/<AccountProfilePicker\b/g)||[]).length,2);
  assert.match(page,/linkedUser && <div[^\n]+profileControls=/);
  assert.doesNotMatch(page,/btn-role-|setSelectedRoles|applyRoleSelection/);
});

test('a seleção de acessos da conta nova aparece antes de informar a senha',()=>{
 const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
 const start=page.lastIndexOf('<AccountProfilePicker');
 const control=page.slice(start,page.indexOf('/>',start));
 assert.match(control,/dirty=\{!!newAccEmail && newAccPassword.length >= 4/);
 assert.doesNotMatch(page,/newAccPassword.length >= 4 && <AccountProfilePicker/);
});
