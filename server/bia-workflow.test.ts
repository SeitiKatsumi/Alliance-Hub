import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { BIA_WORKFLOW_SQL, transitionBiaPhase, validateBiaDraft } from "./bia-workflow";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { sql } from "drizzle-orm";
import { biaAllowsFinance } from "../shared/bia-phase";

test("fase: intenção durável, recuperação, sequência, repetição e encerramento",async()=>{
  const pg=new PGlite();await pg.exec(BIA_WORKFLOW_SQL);
  const db=drizzle(pg);let phase="em_captacao",fail=true,writes=0;
  const deps={db,fetch:async()=>({situacao:phase}),update:async(_id:string,data:any)=>{if(fail)throw new Error("Directus indisponível");writes++;phase=data.situacao;}};
  const input={biaId:"teste",eventId:"aceites:1",event:"aceites_concluidos" as const,ready:true,reason:"Aceites vigentes",actor:{id:"autor"}};
  try {
    await assert.rejects(transitionBiaPhase(deps,input),/indisponível/);
    assert.equal((await pg.query<any>("SELECT * FROM bia_fase_eventos")).rows[0].aplicado,false);
    await assert.rejects(transitionBiaPhase(deps,{...input,eventId:"outro"}),/pendente/);
    fail=false;
    assert.equal(await transitionBiaPhase(deps,input),"em_execucao");
    await transitionBiaPhase(deps,input);assert.equal(writes,1);
    await assert.rejects(transitionBiaPhase(deps,{...input,eventId:"distribuir",event:"resultado_aprovado"}),/fase necessária/);
    await transitionBiaPhase(deps,{...input,eventId:"imovel",event:"imovel_associado"});
    await transitionBiaPhase(deps,{...input,eventId:"resultado",event:"resultado_aprovado"});
    await assert.rejects(transitionBiaPhase(deps,{...input,eventId:"fechar",event:"encerramento",ready:false}),/pendentes/);
    await transitionBiaPhase(deps,{...input,eventId:"fechar",event:"encerramento"});
    assert.equal(phase,"encerrada");
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_fase_eventos")).rows[0].n,4);
  } finally {await pg.close();}
});

test("rascunho preserva ausência e campos antigos, rejeita números formatados e entradas inválidas",()=>{
  const input={nome_bia:"BIA teste",moeda:"BRL",valor_geral_venda_vgv:null,info_comercial:{ativo_numero_matricula:"00123"},map_inicial:{modeloCalculo:4,valorOrigem:null,participantes:[]}};
  const draft=validateBiaDraft(input);
  assert.equal(draft.map_inicial.valorOrigem,null);
  assert.equal(draft.info_comercial.ativo_numero_matricula,"00123");
  assert.throws(()=>validateBiaDraft({...input,valor_geral_venda_vgv:"1.000,00"}),/inválido/);
  assert.throws(()=>validateBiaDraft({...input,moeda:"INVALID"}),/moeda/);
  assert.throws(()=>validateBiaDraft({...input,anexos:["../fora"]}),/Anexos/);
  assert.equal(validateBiaDraft({...input,valor_geral_venda_vgv:0}).valor_geral_venda_vgv,0);
  assert.throws(()=>validateBiaDraft(null),/inválido/);
  for(const contribuicoes of [[null],[{cargo:{},indice:0}],[{cargo:"Diretor",indice:"1,25"}]])assert.throws(()=>validateBiaDraft({...input,map_inicial:{participantes:[{cargos:[],contribuicoes}]}}),/inválida/);
  assert.equal(validateBiaDraft({...input,map_inicial:{participantes:[{cargos:[],contribuicoes:[{cargo:"Contribuição individual",indice:null}]}]}}).map_inicial.participantes[0].contribuicoes[0].indice,null);
});

test("guarda financeira bloqueia estruturação, captação, encerramento e intenção pendente",async()=>{
  const pg=new PGlite();await pg.exec(BIA_WORKFLOW_SQL);const db=drizzle(pg);
  let phase:any="em_estruturacao",missing=false;
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const fn=source.slice(source.indexOf("async function assertBiaFinancialPhase("),source.indexOf("async function directusCreate("));
  const scope={sql,db,biaAllowsFinance,mapOperationContext:{getStore:()=>null},directusFetchOne:async()=>missing?null:{situacao:phase}};
  const guard=new Function(...Object.keys(scope),transformSync(fn,{loader:"ts",target:"es2022"}).code+";return assertBiaFinancialPhase;")(...Object.values(scope));
  try {
    for(phase of ["em_estruturacao","em_captacao","encerrada"])await assert.rejects(guard("teste"),{statusCode:409});
    for(phase of ["ativa","em_execucao","em_operacao","em_distribuicao"])await guard("teste");
    await pg.exec("INSERT INTO bia_fase_eventos (bia_id,evento_id,fase_anterior,fase,motivo,autor) VALUES ('teste','fechar','em_distribuicao','encerrada','Encerramento','{}')");
    await assert.rejects(guard("teste"),{statusCode:409});
    phase="ativa";await assert.rejects(guard("teste"),{statusCode:409});
    missing=true;await assert.rejects(guard("teste"),{statusCode:503});
  } finally {await pg.close();}
});
