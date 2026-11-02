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

test("Vitrine preserva selecao explicita junto a Aliado ao salvar e reabrir", () => {
  const page = readFileSync(new URL("./membros.tsx", import.meta.url), "utf8");
  assert.match(page, /value: "user", label: "BUILT Vitrine"/);
  assert.doesNotMatch(page, /vitrine-default-access/);
  const mergeSource = page.slice(page.indexOf("function mergeRolePermissions("), page.indexOf("function applyRoleSelection("));
  const merge = new Function(ts.transpile(mergeSource) + "; return mergeRolePermissions;")();
  const hydrateSource = page.slice(page.indexOf("const initialRoles ="), page.indexOf("setSelectedRole(linkedUser.role)"));
  const hydrate = (user:any,seals:string[]) => new Function("linkedUser", "selos", "form", "accountProfiles", ts.transpile(hydrateSource) + "; return Array.from(initialRoles);")(user,seals,{},accountProfiles);
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

test('perfil de teste substitui privilégios globais sem inventar cargo ou anuidade',()=>{
 const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
 const source=page.slice(page.indexOf('function selectAccountProfile('),page.indexOf('async function handleLogoSelect('));
 const fnSource=source.slice(0,source.indexOf('function handlePhotoSelect('));
 let roles:any;let role:any;let form:any={em_membros_built:true,em_built_capital:true,Outras_redes_as_quais_pertenco:['ADMIN_SEAL','CUSTOM'],account_purposes:[]};
 let professional:any;
 const apply=new Function('setSelectedRoles','setSelectedRole','setForm','ROLE_MANAGED_SELOS','ROLE_AUTO_SELOS','setProfessionalAccess','setAccessProfileTouched','accountAccessPreset',ts.transpile(fnSource)+';return selectAccountProfile;')((v:any)=>roles=v,(v:any)=>role=v,(f:any)=>form=f(form),new Set(['ADMIN_SEAL']),{},(v:any)=>professional=v,()=>{},accountAccessPreset);
 apply('user');assert.deepEqual(roles,['user']);assert.equal(role,'user');assert.equal(form.em_membros_built,false);assert.equal(form.em_built_capital,false);assert.deepEqual(form.Outras_redes_as_quais_pertenco,['CUSTOM']);
 apply('professional');assert.equal(professional,true);assert.equal(form.na_vitrine,undefined);
 for(const value of ['admin','manager','coproprietario']) {apply(value);assert.equal(role,value);assert.deepEqual(roles,[value]);assert.equal(professional,false);}
 assert.doesNotMatch(fnSource,/apiRequest|anuidade|diretor_alianca/);
 assert.match(page,/if \(accessProfileTouched\) \{\s*roleUpdate.role = primaryRole/);
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

test('remover membro preserva administrador e não recria selo automaticamente',()=>{
 const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
 const definitions=page.slice(page.indexOf('const ROLE_AUTO_SELOS'),page.indexOf('const ROLE_PRIORITY'));
 const constants=new Function(ts.transpile(definitions)+';return {ROLE_AUTO_SELOS,ROLE_MANAGED_SELOS};')();
 let roles=['admin','membro']; let primary='admin'; let form:any={em_membros_built:true,Outras_redes_as_quais_pertenco:['BUILT_PROUD_MEMBER','CUSTOM']};
 const source=page.slice(page.indexOf('function applyRoleSelection('),page.indexOf('function selectAccountProfile('));
 const toggle=()=>new Function('setAccessProfileTouched','selectedRoles','setSelectedRoles','setSelectedRole','getPrimaryRole','setForm','ROLE_AUTO_SELOS','ROLE_MANAGED_SELOS',ts.transpile(source)+';return applyRoleSelection;')(()=>{},roles,(v:any)=>roles=v,(v:any)=>primary=v,(v:string[])=>v.includes('admin')?'admin':v[0],(f:any)=>form=f(form),constants.ROLE_AUTO_SELOS,constants.ROLE_MANAGED_SELOS)('membro');
 toggle();assert.equal(primary,'admin');assert.equal(form.em_membros_built,false);assert.deepEqual(accountProfiles(primary,form),[]);assert.deepEqual(form.Outras_redes_as_quais_pertenco,['CUSTOM']);
 toggle();assert.equal(primary,'admin');assert.equal(form.em_membros_built,true);assert.deepEqual(accountProfiles(primary,form),['membro']);
});

test('controles acumuláveis ficam no resumo de acessos',()=>{
 const page=readFileSync(new URL('./membros.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('membros.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let expression:any;function find(node:ts.Node){if(ts.isJsxAttribute(node)&&node.name.getText(ast)==='profileControls') expression=(node.initializer as ts.JsxExpression).expression;ts.forEachChild(node,find);}find(ast);assert.ok(expression);
 const render=new Function('React','selectedRoles','ACCOUNT_ROLE_LABELS','saveMutation','accessProfileTouched','applyRoleSelection','Button',transformSync('return ('+expression.getText(ast)+');',{loader:'tsx'}).code);
 const html=renderToStaticMarkup(render(React,['admin','membro'],{membro:'Membro BUILT',aliado:'Aliado licenciado',investidor:'Investidor'}, {isPending:false},false,()=>{},'button'));
 assert.match(html,/Adicionar ou remover perfis/);assert.match(html,/Membro BUILT/);assert.equal((html.match(/type="checkbox"/g)||[]).length,3);assert.equal((html.match(/checked=""/g)||[]).length,1);
});
