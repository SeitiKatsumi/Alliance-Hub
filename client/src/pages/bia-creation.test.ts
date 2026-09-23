import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { QueryClient } from "@tanstack/react-query";
import { biaTeamFromMapParticipants } from "../../../shared/bia-access";
import { calculateInitialMap } from "../../../shared/member-portfolio";
import { validateInitialClassifications, withAutomaticEconomicRights } from "../../../shared/initial-contributions";

test("prévia do MAP não exige equipe completa, mas preserva validações econômicas e de duplicidade", () => {
  const source=readFileSync(new URL("./bia-nova.tsx",import.meta.url),"utf8");
  const parsed=ts.createSourceFile("bia-nova.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback="";
  const visit=(node:ts.Node)=>{
    if(ts.isVariableDeclaration(node) && node.name.getText(parsed)==="preview" && node.initializer && ts.isCallExpression(node.initializer)) callback=node.initializer.arguments[0].getText(parsed);
    ts.forEachChild(node,visit);
  };visit(parsed);assert.ok(callback);
  const run=(map_inicial:any)=>new Function("form","biaTeamFromMapParticipants","calculateInitialMap","validateInitialClassifications","withAutomaticEconomicRights","cppTypes",`return (${transformSync(callback,{loader:"ts"}).code.trim().replace(/;$/,"")})();`)({map_inicial},biaTeamFromMapParticipants,calculateInitialMap,validateInitialClassifications,withAutomaticEconomicRights,{data:[{id:"capital",Nome:"CPP Capital"}]});
  const person={modeloCalculo:5,memberId:"socio",nome:"Sócio",tipo:"multiplicador",cargos:[],cotasInvestimento:1,naturezaCapital:"caixa",tipoCppCapital:{id:"capital",nome:"CPP Capital"},contribuicoes:[{cargo:"Contribuição individual",indice:0}]};
  const input={valorOrigem:100,estrutura:{modalidade:"recursos_proprios",totalCotas:1,instrumentos:[],integralizacao:{forma:"a_vista",quantidade:1,meses:0,primeiroVencimento:"2026-10-20",correcao:"Sem correção"}},participantes:[person]};
  const preview=run(input);
  const automatic=run({...input,modeloCalculo:5,participantes:[{...person,contribuicoes:[{cargo:"Contribuição individual",indice:2,tipoCpp:{id:"wrong",nome:"Origem"}}]}]});
  assert.equal(automatic.map.participantes[0].contribuicoes[0].indice,0);
  assert.equal(automatic.map.participantes[0].contribuicoes[0].tipoCpp,undefined);
  assert.equal(preview.error,"");assert.equal(preview.teamPending,true);
  assert.equal(preview.map.participantes[0].mapPercentual,100);
  assert.equal(run({...input,participantes:[{...person,cotasInvestimento:undefined}]}).map,null);
  const missingNature=run({...input,participantes:[{...person,tipoCppCapital:undefined}]});
  assert.equal(missingNature.map,null);
  assert.match(missingNature.error,/Natureza do aporte de Sócio.*bloco 5.*MAP Inicial/);
  assert.doesNotMatch(missingNature.error,/MAP Zero|antes do aceite|salve/);
  assert.match(run({...input,participantes:[person,person]}).error,/uma ficha/);
  assert.match(source,/step===3 && preview.map && preview.teamPending/);
  assert.match(source,/disabled=\{busy \|\| generalPending.length>0 \|\| !preview.map \|\| preview.teamPending/);
  assert.match(source,/void members.refetch\(\);void defaults.refetch\(\)/);
});

test("gerar prévia depende da composição, sem bloquear silenciosamente por nome vazio",()=>{
  const source=readFileSync(new URL("./bia-nova.tsx",import.meta.url),"utf8");
  const condition=source.match(/<Button disabled=\{([^}]+)\} onClick=\{\(\)=>setStep\(s=>s\+1\)\}/)?.[1];
  assert.ok(condition);
  const disabled=(step:number,nome_bia:string,map:object|null,busy=false)=>new Function("step","form","preview","busy",`return ${condition}`)(step,{nome_bia},{map},busy);
  assert.equal(disabled(1,"",{}),false,"composição válida permite gerar sem nome");
  assert.equal(disabled(1,"Nome",null),true,"composição inválida permanece bloqueada");
  assert.equal(disabled(1,"",{},true),true,"não navega durante salvamento");
  assert.equal(disabled(2,"",{}),false,"prévia permite chegar à revisão e suas pendências");
  assert.equal(disabled(0,"  ",{}),true);
  assert.equal(disabled(0,"Nome",null),false);
  assert.match(source,/disabled=\{busy \|\| !form.nome_bia.trim\(\)\} onClick=\{\(\)=>save\(\)\}/);
  assert.match(source,/disabled=\{busy \|\| generalPending.length>0 \|\| !preview.map \|\| preview.teamPending/);
  assert.match(source,/Preencher nome da BIA/);
});

test("Dados da BIA e Equipe e DM ocupam toda a largura na criação", () => {
  const page=readFileSync(new URL("./bia-nova.tsx",import.meta.url),"utf8");
  const component=readFileSync(new URL("../components/bia-role-composition.tsx",import.meta.url),"utf8");
  assert.match(page,/step<=1 \|\| form.map_inicial.modeloCalculo===5 && step>=2\?"":"xl:grid-cols/);
  assert.match(page,/step>1 && !\(form.map_inicial.modeloCalculo===5 && step>=2\) && <aside/);
  assert.match(page,/<BiaRoleComposition compact /);
  assert.match(page,/aria-label="Totais da composição"/);
  assert.match(component,/compact && \(j===0\?/);
  assert.match(component,/\(!compact \|\| j===0\)\?<label/);
  assert.match(component,/role="group" aria-label=\{`Participante/);
  assert.doesNotMatch(component,/Capital na primeira linha/);
  assert.match(component,/\{participantActions\(p,i\)\}\s*<details/);
  assert.doesNotMatch(component,/!compact && participantActions/);
  assert.match(component,/!compact && <label[^]*?Capital comprometido/);
  assert.match(component,/Classificação pendente/);
  assert.match(component,/decimals=\{5\}/);
});

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
