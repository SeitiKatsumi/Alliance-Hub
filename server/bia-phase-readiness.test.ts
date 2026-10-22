import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { biaExecutionReadiness, biaPhaseProgress, registerBiaPhaseReadRoutes } from "./bia-phase-readiness";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { transformSync } from "esbuild";
import { BIA_WORKFLOW_SQL } from "./bia-workflow";

const input=()=>({bia:{situacao:"em_captacao",aliado_built:"a",diretor_alianca:{id:"a"}},base:{valor_origem:100,revisao:2,modelo_calculo:1,participantes:[{memberId:"a",nome:"Ana",tipo:"guardiao",indiceContribuicao:1,pesoCapital:100,capitalComprometido:100},{memberId:"b",nome:"Bruno",tipo:"multiplicador",indiceContribuicao:1,pesoCapital:0,capitalComprometido:0}]},draft:{concluido:true},pendingDirectorInvites:0,pendingPartnerInvites:0,acceptedMouMemberIds:["a","b"]});

test("mesma condição de avanço inclui todos os signatários e não exige cargos opcionais",()=>{
  const value=input();
  assert.equal(biaExecutionReadiness(value).ready,true);
  assert.equal(biaExecutionReadiness({...value,draft:undefined}).ready,true);
  const pending=biaExecutionReadiness({...value,acceptedMouMemberIds:["a"]});
  assert.equal(pending.ready,false);assert.deepEqual(pending.missingMou,["b"]);
  assert.match(pending.checks.find(c=>c.id==="mou")!.label,/revisão 2/);
  for(const change of [{draft:{concluido:false}},{pendingDirectorInvites:1},{pendingPartnerInvites:1},{base:null},{acceptedMouMemberIds:[]},{bia:{...value.bia,aliado_built:""}},{bia:{...value.bia,diretor_alianca:{id:""}}},{base:{...value.base,valor_origem:-1}}])assert.equal(biaExecutionReadiness({...value,...change}).ready,false);
});

test("próximas fases correspondem aos eventos existentes, sem converter receita em distribuição",()=>{
  const value=input(),execution=biaExecutionReadiness(value);
  assert.equal(biaPhaseProgress({bia:value.bia,execution}).ready,true);
  assert.equal(biaPhaseProgress({bia:value.bia,execution,pendingTransition:true}).ready,false);
  assert.throws(()=>biaPhaseProgress({bia:value.bia}));
  assert.equal(biaPhaseProgress({bia:{situacao:"em_execucao"},propertyLinked:true}).nextPhase,"em_operacao");
  assert.equal(biaPhaseProgress({bia:{situacao:"em_operacao"}}).ready,false);
  assert.equal(biaPhaseProgress({bia:{situacao:"em_estruturacao"},structureCompleted:false}).ready,false);
  for(const phase of ["ativa","em_formacao","encerrada","em_distribuicao"])assert.equal(biaPhaseProgress({bia:{situacao:phase}}).ready,false);
});

test("leituras autorizam antes de consultar e usam somente ID canônico; falhas não viram sucesso",async()=>{
  const handlers=new Map<string,any>();let allowed=true,reads=0,fail=false;
  registerBiaPhaseReadRoutes({get:(path:string,fn:any)=>handlers.set(path,fn)},{authorize:async()=>allowed?{bia:{id:"canonical",situacao:"encerrada"}}:null,progress:async bia=>{reads++;if(fail)throw new Error("segredo");assert.equal(bia.id,"canonical");return biaPhaseProgress({bia});},history:async id=>{reads++;assert.equal(id,"canonical");if(fail)throw new Error("segredo");return [];}});
  let result:any,code=200;const res:any={json:(v:any)=>result=v,status:(c:number)=>{code=c;return res;}};
  for(const handler of handlers.values()) {
    await handler({params:{id:"PUBLIC"}},res);assert.equal(code,200);
    allowed=false;const before=reads;await handler({params:{id:"foreign"}},res);assert.equal(reads,before);
    allowed=true;fail=true;await handler({params:{id:"PUBLIC"}},res);assert.equal(code,503);assert.doesNotMatch(JSON.stringify(result),/segredo/);fail=false;code=200;
  }
});

test("adaptador é somente leitura, restringe aceite à versão/revisão e não expõe captura privada",()=>{
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const adapter=source.slice(source.indexOf("  registerBiaPhaseReadRoutes(app"),source.indexOf("  async function reconcileBiaPhases"));
  assert.match(adapter,/REPEATABLE READ, READ ONLY/);assert.match(adapter,/mou_versao=\$\{BIA_MOU_VERSAO\}/);assert.match(adapter,/map_revisao=\$\{Number\(base\?\.revisao/);
  assert.match(adapter,/requireBiaModuleAccess\(req,res,ref,"configuracao_bia","view"\)/);
  assert.doesNotMatch(adapter,/INSERT|UPDATE|DELETE|ensureBia|transitionBiaPhase|SELECT \*|fields=\*|email|cpf/);
});

test("consulta SQL real considera revisão vigente, nomes, convites e falha de origem sem gravar",async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(BIA_WORKFLOW_SQL+`
      CREATE TABLE bia_map_inicial_snapshots(bia_id text,valor_origem numeric,participantes jsonb,estrutura_economica jsonb,modelo_calculo int,revisao int,ativado_em timestamp);
      CREATE TABLE bia_diretor_solicitacoes(bia_id text,diretor_nome text,status text);
      CREATE TABLE bia_socio_solicitacoes(bia_id text,socio_nome text,status text);
      CREATE TABLE bia_mou_aceites(bia_id text,membro_id text,mou_versao text,map_revisao int);
      CREATE TABLE bia_imovel_origens(id text,bia_id text,status text);
      INSERT INTO bia_estruturacao_rascunhos(bia_id,autor_id,dados,concluido) VALUES ('canonical','a','{}',true);
      INSERT INTO bia_mou_aceites VALUES ('canonical','a','current',2),('canonical','b','current',1),('canonical','b','old',2),('other','b','current',2);
    `);
    const db=drizzle(pg),value=input();
    await db.execute(sql`INSERT INTO bia_map_inicial_snapshots VALUES ('canonical',100,${JSON.stringify(value.base.participantes)}::jsonb,null,1,2,null)`);
    const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
    const adapter=source.slice(source.indexOf("  registerBiaPhaseReadRoutes(app"),source.indexOf("  async function reconcileBiaPhases"));
    const handlers=new Map<string,any>(),scope={app:{},db,sql,BIA_MOU_VERSAO:"current",biaExecutionReadiness,biaPhaseProgress,requireBiaModuleAccess:()=>{},directusFetchOne:async()=>{throw new Error("private");},registerBiaPhaseReadRoutes:(_app:any,deps:any)=>{handlers.set("deps",deps);}};
    new Function(...Object.keys(scope),transformSync(adapter,{loader:"ts"}).code)(...Object.values(scope));
    const deps=handlers.get("deps"),bia={...value.bia,id:"canonical"};
    const first=await deps.progress(bia);
    assert.equal(first.ready,false);assert.equal(first.checks.find((c:any)=>c.id==="mou").detail,"Falta o aceite de: Bruno");
    await pg.exec("INSERT INTO bia_mou_aceites VALUES ('canonical','b','current',2)");
    assert.equal((await deps.progress(bia)).ready,true);
    await pg.exec("INSERT INTO bia_socio_solicitacoes VALUES ('canonical','Carlos','pendente')");
    const invited=await deps.progress(bia);assert.equal(invited.ready,false);assert.match(invited.checks.find((c:any)=>c.id==="partner-invites").detail,/Carlos/);
    await pg.exec("DROP TABLE bia_mou_aceites");await assert.rejects(deps.progress(bia));
  }finally{await pg.close();}
});
