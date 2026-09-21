import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { QueryClient } from "@tanstack/react-query";

test("Nova BIA e editor MAP Zero mantêm adicionar Pessoa, sem o atalho + BUILT", () => {
  const source = readFileSync(new URL("./bias-calculadora.tsx", import.meta.url), "utf8");
  assert.match(source, /onClick=\{addMember\}[^]*?Pessoa<\/Button>/);
  assert.doesNotMatch(source, /addBuilt|onClick=\{[^}]+\}[^>]*>[^\n]*\/\>BUILT<\/Button>/);
});

test("ações da BIA quebram linha no celular sem esconder Editar ou Ativar", () => {
  const source=readFileSync(new URL("./bia-detalhe.tsx",import.meta.url),"utf8");
  const actions=source.slice(source.indexOf("{/* Back + actions */}"),source.indexOf("<Tabs value={activeDetailTab}"));
  assert.match(actions,/flex flex-wrap items-center justify-between gap-3/);
  assert.match(actions,/flex flex-wrap items-center gap-2/);
  assert.match(actions,/canEditBia && bia.situacao === "em_formacao"/);
  assert.match(actions,/canViewBiaConfiguration/);
});

test("invalidar BIAs também invalida a lista relacionada, sem misturar os dois caches", async () => {
  const source=readFileSync(new URL("./bias.tsx",import.meta.url),"utf8");
  const declaration=source.slice(source.indexOf('  const biasEndpoint = relatedOnly'));
  const expression=declaration.match(/queryKey: (.+),\r?\n/)?.[1];
  assert.ok(expression);
  const key=new Function("relatedOnly",`return ${expression};`);
  const client=new QueryClient();
  client.setQueryData(key(false),["global"]);
  client.setQueryData(key(true),["related"]);
  await client.invalidateQueries({queryKey:["/api/bias"]});
  assert.equal(client.getQueryState(key(true))?.isInvalidated,true);
  assert.deepEqual(client.getQueryData(key(false)),["global"]);
  assert.deepEqual(client.getQueryData(key(true)),["related"]);
  client.clear();
});

test("link profundo aguarda permissões; somente acesso confirmado pode redirecionar", () => {
  const source=readFileSync(new URL("./bia-detalhe.tsx",import.meta.url),"utf8");
  const parsed=ts.createSourceFile("bia-detalhe.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback="";
  const visit=(node:ts.Node)=>{
    if(ts.isCallExpression(node) && node.expression.getText(parsed)==="useEffect" && node.arguments[0]?.getText(parsed).includes('allowedNucleoTabs.some')) callback=node.arguments[0].getText(parsed);
    ts.forEachChild(node,visit);
  };visit(parsed);assert.ok(callback);
  for(const [loadingAccess,accessData,allowed,redirect] of [[true,undefined,false,false],[false,undefined,false,false],[false,{},true,false],[false,{},false,true]] as const){
    const changes:string[]=[];
    const scope={bia:{id:"bia"},loadingAccess,accessData,activeDetailTab:"capital",allowedNucleoTabs:allowed?[{value:"capital"}]:[],toast:()=>{},updateDetailTab:(tab:string)=>changes.push(tab)};
    const run=new Function(...Object.keys(scope),`return (${transformSync(callback,{loader:"ts"}).code.trim().replace(/;$/,"")});`)(...Object.values(scope));
    run();assert.deepEqual(changes,redirect?["visao"]:[]);
  }
});

test("BIA criada não vira sucesso completo quando Informações falham, nem repete a criação", async () => {
  const source = readFileSync(new URL("./bias.tsx", import.meta.url), "utf8");
  const parsed = ts.createSourceFile("bias.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let onSuccess = "";
  const visit = (node:ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "saveMutation" && node.initializer && ts.isCallExpression(node.initializer)) {
      const options = node.initializer.arguments[0];
      if (ts.isObjectLiteralExpression(options)) {
        const property = options.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(parsed) === "onSuccess");
        if (property && ts.isPropertyAssignment(property)) onSuccess = property.initializer.getText(parsed);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(parsed);
  assert.ok(onSuccess);
  for (const result of ["ok", "http-error", "network-error"]) {
    const notifications:any[] = [], requests:any[] = [];
    let closed=0;
    const scope = {
      bia:null,infoForm:{ativo_qualificacao:"Imóvel de teste"},form:{nome_bia:"BIA de teste"},isEdit:false,
      queryClient:{invalidateQueries:()=>{}},toast:(message:any)=>notifications.push(message),onClose:()=>closed++,
      fetch:async(url:string,options:any)=>{
        requests.push({url,...options});
        if(result === "network-error") throw new Error("Offline");
        return {ok:result === "ok"};
      },
    };
    const code=transformSync(`const callback = ${onSuccess};`,{loader:"ts",format:"cjs"}).code;
    const callback=new Function(...Object.keys(scope),code+";return callback;")(...Object.values(scope));
    await callback({json:async()=>({id:"new-bia"})});
    assert.equal(closed,1);
    assert.equal(requests.length,1);
    assert.equal(requests[0].method,"PUT");
    assert.equal(requests[0].url,"/api/bias/new-bia/info-comercial");
    assert.equal(notifications.length,1);
    assert.equal(notifications[0].title,result === "ok" ? "BIA criada!" : "BIA salva; Informações não foram salvas");
    if(result !== "ok") assert.match(notifications[0].description,/Não crie outra BIA/);
  }
});
