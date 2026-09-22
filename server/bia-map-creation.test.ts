import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { BIA_MAP_ECONOMIC_FIELDS, calculateInitialMap } from "../shared/member-portfolio";
import { normalizeBiaOriginPatch } from "./bia-origin-value";
import { biaAllowsFinance } from "../shared/bia-phase";
import { validateInitialClassifications } from "../shared/initial-contributions";
import { collectBiaParticipantRoles, BIA_PARTICIPANT_ROLE_LABELS, BIA_PARTICIPANT_ROLE_FIELDS, biaTeamFromMapParticipants } from "../shared/bia-access";

test("Nova BIA: valida e grava MAP Zero antes dos convites, com precisão e sem caixa", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const parsed = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
  const functions = new Map<string,string>();
  const visit = (node:ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text,node.getText(parsed));
    ts.forEachChild(node,visit);
  };
  visit(parsed);
  const start = source.indexOf('  app.post("/api/bias",');
  const end = source.indexOf('  app.patch("/api/bias/:id"',start);
  assert.ok(start>0 && end>start);
  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(`CREATE TABLE bia_map_inicial_snapshots (
    id serial PRIMARY KEY, bia_id text UNIQUE, origem_id text, status text,
    valor_origem numeric, moeda text, divisor_multiplicador numeric, base_economica_inicial numeric,
    participantes jsonb, criado_por_user_id text, criado_por_membro_id text, modelo_calculo integer);`);
  const writes:any[] = [], archives:any[] = [];
  const deleted:string[] = [];
  let failArchive = false;
  let handler:any;
  const scope = {
    app:{post:(_path:string,fn:any)=>{if(_path === "/api/bias")handler=fn;},get:()=>{},put:()=>{}},
    db, sql, calculateInitialMap, validateInitialClassifications, collectBiaParticipantRoles, BIA_PARTICIPANT_ROLE_LABELS,
    BIA_PARTICIPANT_ROLE_FIELDS, biaTeamFromMapParticipants, directusRelationId:(value:any)=>value?.id || value || null,
    ensureBiaMapInicialSnapshotsTable:async()=>{},
    directusFetchScoped:async()=>[{id:"capital",Nome:"CPP Capital"},{id:"origem",Nome:"CPP Origem"}],
    directusFetchOne:async(col:string,id:string)=>({id,nome:col==="cadastro_geral"?"Nome oficial":"BIA teste"}),
    getMembroResumo:async(id:string)=>({id,nome:"Nome oficial"}),
    prepareBiaPayload:(body:any)=>({...body}), withUpdatedBiaFinancials:(body:any)=>body,
    createUniqueBiaPublicCode:async()=>"TESTE",
    directusCreate:async(col:string,payload:any)=>{assert.equal(col,"bias_projetos");writes.push(payload);return {id:String(writes.length),...payload};},
    directusDelete:async(_collection:string,id:string)=>{deleted.push(id);},
    biaFinancialNumber:Number,
    loadInitialMapSnapshot:async(id:string,tx:any=db)=>(await tx.execute(sql`SELECT * FROM bia_map_inicial_snapshots WHERE bia_id=${id}`)).rows[0],
    withMapLock:async(_id:string,fn:any)=>db.transaction(tx=>fn(tx,null)),
    archiveMapBase:async(_tx:any,_bia:any,base:any)=>{if(failArchive)throw new Error("Falha simulada no histórico");archives.push(base);},
    processDiretorSolicitacoes:async()=>{assert.equal(archives.length+deleted.length,writes.length);return [];},
    processSocioSolicitacoes:async()=>[],
  };
  const code = ["calculateSubmittedInitialMap","createInitialMapDraft","createBiaHandler"].map(n=>functions.get(n)).join("\n")+source.slice(start,end);
  new Function(...Object.keys(scope),transformSync(code,{loader:"ts",format:"cjs"}).code)(...Object.values(scope));
  const participant = (id:string,capital:number,index=0)=>({memberId:id,nome:"Nome adulterado",tipo:"guardiao",indiceContribuicao:index,
    capitalComprometido:capital,pesoCapital:99,naturezaCapital:"nao_caixa",tipoCppCapital:{id:"capital",nome:"Falso"},tipoCppContribuicao:{id:"origem"}});
  const input = {nome_bia:"Teste",autor_bia:"a",diretor_alianca:"a",aliado_built:"a",valor_origem:99999,perc_built:99,
    map_inicial:{valorOrigem:100,participantes:[participant("a",33.33333,12.5),participant("b",66.66667)]}};
  const request = async(body:any,role="admin")=>{
    let status=200, result:any;
    await handler({body,session:{role}}, {status:(n:number)=>{status=n;return {json:(v:any)=>{result=v;}};},json:(v:any)=>{result=v;}});
    return {status,result};
  };
  try {
    assert.equal((await request(input,"user")).status,403);
    assert.equal((await request({...input,map_inicial:{...input.map_inicial,participantes:[participant("a",99)]}})).status,400);
    assert.equal((await request({...input,map_inicial:{...input.map_inicial,participantes:[participant("b",100)]}})).status,400);
    for (const invalid of [
      {...participant("a",100),tipo:"multiplicador"},
      {...participant("a",100),indiceContribuicao:null},
      {...participant("a",100),capitalComprometido:""},
      {...participant("a",100),tipoCppCapital:{id:"inexistente"}},
    ]) {
      assert.equal((await request({...input,map_inicial:{valorOrigem:100,participantes:[invalid]}})).status,400);
    }
    assert.equal((await request({...input,map_inicial:{valorOrigem:100,participantes:[participant("a",50),participant("a",50)]}})).status,400);
    assert.equal(writes.length,0);
    const teamInput = {...input,map_inicial:{...input.map_inicial,participantes:input.map_inicial.participantes.map((p,i)=>({...p,cargos:i===0?[BIA_PARTICIPANT_ROLE_LABELS.autor,BIA_PARTICIPANT_ROLE_LABELS.aliado,BIA_PARTICIPANT_ROLE_LABELS.diretor_alianca]:[]}))}};
    assert.equal((await request({...teamInput,diretor_alianca:"b"})).status,400);
    assert.equal((await request({...teamInput,map_inicial:{...teamInput.map_inicial,participantes:teamInput.map_inicial.participantes.map(p=>({...p,cargos:[...p.cargos,BIA_PARTICIPANT_ROLE_LABELS.diretor_capital]}))}})).status,400);
    assert.equal(writes.length,0);
    const result=await request(teamInput);
    assert.equal(result.status,200,JSON.stringify(result.result));
    assert.equal(writes[0].valor_origem,100);
    assert.equal(writes[0].divisor_multiplicador,12.5);
    assert.equal(writes[0].custo_origem_bia,112.5);
    assert.equal(writes[0].custo_final_previsto,12.5);
    assert.equal(writes[0].map_inicial,undefined);
    assert.equal(writes[0].perc_built,null);
    assert.equal(writes[0].situacao,"em_formacao");
    const base:any=(await db.execute(sql`SELECT * FROM bia_map_inicial_snapshots`)).rows[0];
    assert.equal(base.participantes[0].cppCapital,33.33333);
    assert.equal(base.participantes[1].cppCapital,66.66667);
    assert.equal(base.participantes[0].nome,"Nome oficial");
    assert.equal(base.participantes[0].tipoCppCapital.nome,"CPP Capital");
    assert.equal(base.participantes[0].naturezaCapital,"nao_caixa");
    assert.ok(base.participantes[0].cargos.length>=3);
    assert.equal(base.participantes.length,2);
    assert.equal(archives.length,1);
    failArchive = true;
    assert.equal((await request(input)).status,500);
    assert.deepEqual(deleted,["2"]);
    assert.equal((await db.execute(sql`SELECT * FROM bia_map_inicial_snapshots`)).rows.length,1);
    failArchive=false;
    const cargos=[BIA_PARTICIPANT_ROLE_LABELS.autor,BIA_PARTICIPANT_ROLE_LABELS.aliado,BIA_PARTICIPANT_ROLE_LABELS.diretor_alianca];
    const model4={...participant("a",100),tipo:"multiplicador",modeloCalculo:4,cargos,contribuicoes:cargos.map((cargo,i)=>({cargo,indice:i===0?0:i===1?1.25:2,tipoCpp:{id:"origem"}}))};
    const newResult=await request({...input,map_inicial:{modeloCalculo:4,valorOrigem:100,participantes:[model4]}});
    assert.equal(newResult.status,200,JSON.stringify(newResult.result));
    const newBase:any=(await db.execute(sql`SELECT * FROM bia_map_inicial_snapshots WHERE modelo_calculo=4`)).rows[0];
    assert.equal(newBase.participantes[0].cppCapital,100);assert.equal(newBase.participantes[0].cppTotal,103.25);
    assert.equal(newBase.participantes[0].contribuicoes.length,3);
    const invalid={...model4,cargos:["Cargo inexistente"],contribuicoes:[{cargo:"Cargo inexistente",indice:1,tipoCpp:{id:"origem"}}]};
    assert.equal((await request({...input,map_inicial:{modeloCalculo:4,valorOrigem:100,participantes:[invalid]}})).status,400);
  } finally {await pg.close();}
});

test("edição geral preserva MAP Zero; DM legado e acesso continuam protegidos", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const parsed = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
  const functions = new Map<string,string>();
  const visit = (node:ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text,node.getText(parsed));
    ts.forEachChild(node,visit);
  };
  visit(parsed);
  const start = source.indexOf('  app.patch("/api/bias/:id",');
  const end = source.indexOf('  app.post("/api/bias/:id/ativar",', start);
  assert.ok(start > 0 && end > start);
  const writes:any[] = [];
  let base:any = {modelo_calculo:3};
  let allowed = true;
  const current = {id:"bia",situacao:"em_formacao",valor_origem:1500000,divisor_multiplicador:12.5,
    custo_origem_bia:1687500,custo_final_previsto:187500,perc_autor_opa:null,aliado_built:"a"};
  let handler:any;
  const scope = {
    app:{patch:(_path:string,fn:any)=>{handler=fn;}},
    BIA_MAP_ECONOMIC_FIELDS, normalizeBiaOriginPatch, biaAllowsFinance,
    directusRelationId:(v:any)=>v?.id || v || null,
    parseBiaMemberList:(v:any)=>Array.isArray(v)?v:[],
    resolveBiaByIdOrPublicCode:async()=>({...current}),
    loadInitialMapSnapshot:async()=>base,
    resolveBiaAccessForRequest:async()=>({permissions:{}}),hasBiaAccess:()=>allowed,
    pickBiaDiretorDirectFields:()=>({}),isBiaPendingBypassed:()=>false,
    processSocioSolicitacoes:async()=>[],
    syncStructuredMapParticipants:async()=>{},
    directusUpdate:async(_col:string,_id:string,data:any)=>{writes.push(data);return {...current,...data};},
  };
  const constants = source.slice(source.indexOf("  const BIA_DM_FIELD_MAP ="), source.indexOf("  function withUpdatedBiaDm"));
  const helpers = ["prepareBiaPayload","biaFinancialNumber","withUpdatedBiaDm","hasBiaFinancialField","withUpdatedBiaFinancials"].map(n=>functions.get(n)).join("\n");
  new Function(...Object.keys(scope),transformSync(constants+helpers+source.slice(start,end),{loader:"ts",format:"cjs"}).code)(...Object.values(scope));
  const request = async(body:any)=>{
    let status=200,result:any;
    const res:any={status:(n:number)=>{status=n;return res;},json:(v:any)=>{result=v;}};
    await handler({params:{id:"bia"},body,session:{role:"admin"}},res);
    return {status,result};
  };
  const success=await request({nome_bia:"Nome corrigido"});
  assert.equal(success.status,200,JSON.stringify(success.result));
  assert.equal(success.result.divisor_multiplicador,12.5);
  assert.equal(success.result.custo_origem_bia,1687500);
  assert.equal(success.result.custo_final_previsto,187500);
  assert.ok(BIA_MAP_ECONOMIC_FIELDS.every(field=>!(field in writes[0])),"Edição geral não grava valores do MAP");
  for (const field of BIA_MAP_ECONOMIC_FIELDS) {
    assert.equal((await request({[field]:1})).status,409,field);
  }
  assert.equal(writes.length,1,"Recusa antes de qualquer escrita");
  allowed=false;
  assert.equal((await request({nome_bia:"Sem acesso"})).status,403);
  allowed=true;
  base=null;
  const legacy=await request({perc_autor_opa:12.5});
  assert.equal(legacy.status,200,JSON.stringify(legacy.result));
  assert.equal(legacy.result.divisor_multiplicador,12.5);
  assert.equal(legacy.result.cpp_autor_opa,187500);
});
