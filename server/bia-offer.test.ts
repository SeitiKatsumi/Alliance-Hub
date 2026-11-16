import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { transformSync } from "esbuild";
import { applyPaymentPlan,biaBudgetSchema,emptyBiaBudget } from "../shared/bia-budget";
import { makePaymentSchedule,quotePaymentShare,toPaymentCents,newPaymentPlan } from "../shared/bia-payment-plan";
import { OBA_OFFER_SQL } from "./bia-offer";
import { openMapVacancies } from "./bia-vacancies";

test("Prévia e publicação usam o CAPEX salvo e a oferta vigente não expõe nomes nem muda com o rascunho",async()=>{
  const pg=new PGlite();
  const db=drizzle(pg);
  let generatedOpa:any;
  const generatedRegistryId="4eb54691-f4b2-4bb3-a5f6-0ae4b2f00614";
  const registry={id:"3eb54691-f4b2-4bb3-a5f6-0ae4b2f00614",source_id:"oba",source_type:"oba",bia_id:"bia",status:"aberta",visibilidade:"restrita"};
  await pg.exec("CREATE TABLE opportunity_registry (id uuid PRIMARY KEY,bia_id text,status text)");
  await pg.query("INSERT INTO opportunity_registry VALUES ($1,$2,$3)",[registry.id,registry.bia_id,registry.status]);
  const plan={...newPaymentPlan("2026-12"),entrada:80000,intermediarias:[{nome:"Intermediárias",quantidade:5,valor:80000,intervalo:1}],saldoQuantidade:80};
  let usingDraft=false;
  let budget=applyPaymentPlan(emptyBiaBudget("BRL"),plan,1170000);
  const base={estrutura_economica:{totalCotas:8},valor_origem:1170000,moeda:"BRL",participantes:[
    {memberId:"director",nome:"Pessoa privada",cotasInvestimento:1},
    {memberId:"author",nome:"Outra pessoa privada",cotasInvestimento:0},
    ...Array.from({length:7},(_,i)=>({titular:"vaga",participantId:"draft:"+i,tipo:"guardiao",cotasInvestimento:1})),
  ]};
  const token="oferta_"+"a".repeat(43);
  const invite={source_type:"oba",source_id:"oba",status:"ativo",expires_at:new Date(Date.now()+3600000)};
  await pg.exec("CREATE TABLE bia_estruturacao_rascunhos (bia_id text PRIMARY KEY, dados jsonb, concluido boolean, conclusao_iniciada boolean DEFAULT false)");
  await pg.query("INSERT INTO bia_estruturacao_rascunhos (bia_id,dados,concluido) VALUES ($1,$2,false)",[registry.bia_id,{moeda:"BRL",map_inicial:{modeloCalculo:5,estrutura:base.estrutura_economica,participantes:base.participantes,valorOrigem:base.valor_origem},estrutura_bia:{orcamento:budget}}]);
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={directusUserId:req.headers["x-user"] || "director"};next();});
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const start=source.indexOf("  let obaOfferReady:");
  assert.ok(start>=0);
  const code=source.slice(start,source.indexOf('  app.get("/api/oportunidades/:id/interesse",',start));
  const scope={app,db,sql,createHash,biaBudgetSchema,makePaymentSchedule,quotePaymentShare,toPaymentCents,openMapVacancies,OBA_OFFER_SQL,
    obaInterestAudience:async()=>({registry}),getOpportunityRegistry:async(id:string)=>id==="oba"?registry:generatedOpa?.id===id?{...registry,id:generatedRegistryId,source_id:id}:null,
    isOpportunityPublic:()=>false,isOpportunityEditable:()=>true,
    storage:{getConviteLinkByToken:async(value:string)=>value===token?invite:null},
    canManageOpa:async(req:any)=>req.session.directusUserId==="director",
    obaAudience:async(req:any)=>({invited:new Set(req.session.directusUserId==="invited"?["oba"]:[]),delivered:new Set(req.session.directusUserId==="pulso"?["oba"]:[])}),
    readBiaSetup:async()=>({dados:{orcamento:budget}}),loadInitialMapSnapshot:async()=>usingDraft?null:base,
    resolveBiaByIdOrPublicCode:async()=>({id:"bia",nome_bia:"Veneto",situacao:usingDraft?"em_estruturacao":"em_captacao"}),
    ensureCanLinkOpaToBia:async(req:any)=>{if(req.session.directusUserId!=="director")throw Object.assign(new Error("Sem acesso"),{statusCode:403});},
    ensureOpaMediaFields:async()=>{},directusRelationId:(id:string)=>id,
    directusCreate:async(_collection:string,item:any)=>{assert.equal(generatedOpa,undefined);generatedOpa=item;return item;},
    directusFetchOne:async(_collection:string,id:string)=>id==="oba"?{}:generatedOpa || null,
    resolveAnexosOpa:([opa]:any[])=>[{nome_oportunidade:opa.nome_oportunidade || "Veneto",descricao:opa.descricao || "Oferta",Anexos:[]}],
    withMapLock:(_id:string,callback:any)=>db.transaction(tx=>callback(tx,usingDraft?null:base)),
  };
  new Function(...Object.keys(scope),transformSync(code,{loader:"ts"}).code)(...Object.values(scope));
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const url="http://127.0.0.1:"+(server.address() as any).port+"/api/oportunidades/oba/oferta";
  const call=(query="",actor="director",data?:unknown)=>fetch(url+query,{method:data?"POST":"GET",headers:{"x-user":actor,"content-type":"application/json"},body:data?JSON.stringify(data):undefined});
  try {
    assert.equal((await call("?previa=1","outsider")).status,403);
    usingDraft=true;
    const preview=await (await call("?previa=1")).json();
    assert.equal(preview.oferta.quotas.length,7);
    assert.equal(preview.oferta.quotas[0].pagamentos.length,86);
    assert.doesNotMatch(JSON.stringify(preview),/Pessoa privada|Outra pessoa privada|memberId/);
    const published=await call("","director",preview);
    assert.equal(published.status,200,await published.text());
    assert.equal((await call("","outsider")).status,404);
    const guest=()=>fetch(url,{headers:{"x-user":"outsider","X-Oba-Invite":token}});
    const guestView=await guest();
    assert.equal(guestView.status,200);
    assert.match(guestView.headers.get("cache-control") || "",/no-store/);
    assert.doesNotMatch(JSON.stringify(await guestView.json()),/Pessoa privada|Outra pessoa privada|memberId/);
    invite.source_id="outra-oba";
    assert.equal((await guest()).status,404);
    invite.source_id="oba";
    invite.status="usado";
    assert.equal((await guest()).status,404);
    invite.status="ativo";
    invite.expires_at=new Date(0);
    assert.equal((await guest()).status,404);
    assert.equal((await call("","pulso")).status,200);
    const invited=await call("","invited");
    assert.equal(invited.status,200,await invited.text());
    usingDraft=false;
    budget=applyPaymentPlan(budget,{...plan,saldoQuantidade:60},1170000);
    assert.equal((await call("","director",preview)).status,409);
    assert.equal((await (await call("","invited")).json()).oferta.quotas[0].pagamentos.length,86);
    const next=await (await call("?previa=1")).json();
    assert.equal(next.oferta.quotas[0].pagamentos.length,66);
    assert.equal((await call("","director",next)).status,200);
    base.participantes[2].titular=undefined;
    const live=await (await call("","invited")).json();
    assert.equal(live.revisao,2);
    assert.equal(live.aquisicaoCotas,false);
    assert.equal(live.oferta.quotas.length,6);
    usingDraft=true;
    await pg.query("INSERT INTO opportunity_registry VALUES ($1,$2,$3)",[generatedRegistryId,registry.bia_id,registry.status]);
    await pg.query("UPDATE bia_estruturacao_rascunhos SET dados = dados - 'estrutura_bia'");
    const generate=(actor:string)=>fetch(url.replace("/api/oportunidades/oba/oferta","/api/bias/bia/oba-aquisicao"),{method:"POST",headers:{"x-user":actor}});
    assert.equal((await generate("outsider")).status,403);
    const generation=await generate("director");
    assert.equal(generation.status,200,await generation.clone().text());
    const first=await generation.json();
    assert.equal(first.cotasDisponiveis,7);
    assert.equal(generatedOpa.nome_oportunidade,"Oportunidade de aquisição de cotas");
    assert.deepEqual(await (await generate("director")).json(),first);
    const generated=await (await fetch(url.replace("/oba/oferta","/"+first.id+"/oferta"))).json();
    assert.equal(generated.revisao,1);
    assert.equal(generated.aquisicaoCotas,true);
    assert.equal(generated.oferta.totalQuotas,8);
    assert.equal(generated.oferta.quotas.length,7);
    assert.deepEqual(generated.oferta.quotas[0].pagamentos,[]);
    invite.source_id=first.id;
    invite.expires_at=new Date(Date.now()+3600000);
    const guestGenerated=await fetch(url.replace("/oba/oferta","/"+first.id+"/oferta"),{headers:{"x-user":"outsider","X-Oba-Invite":token}});
    assert.equal(guestGenerated.status,200);
    assert.equal((await guestGenerated.json()).oferta.quotas.reduce((total:number,row:any)=>total+row.quantidade,0),7);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await pg.close();
  }
});
