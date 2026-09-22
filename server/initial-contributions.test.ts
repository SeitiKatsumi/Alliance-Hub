import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { INITIAL_CONTRIBUTIONS_SQL, registerInitialContributions, decorateInitialEntries, assertInitialCommitmentsCompatible } from "./initial-contributions";
import { calculateInitialMap, calculateMap } from "../shared/member-portfolio";
import { commitmentsFromMap, isCashEntry } from "../shared/initial-contributions";

test("API de aportes: autorização, falha parcial, repetição, pares, revisão e proteção",async(t)=>{
 const pg=new PGlite();const db=drizzle(pg);
 await pg.exec("CREATE TABLE bia_map_inicial_snapshots (bia_id text PRIMARY KEY);");
 await pg.exec(INITIAL_CONTRIBUTIONS_SQL);await pg.exec(INITIAL_CONTRIBUTIONS_SQL);
 const calculation=calculateInitialMap(1000,[{participantId:"member:d",memberId:"d",nome:"Diretor",tipo:"guardiao",cargos:["Diretor","Guardião"],indiceContribuicao:10,pesoCapital:0,capitalComprometido:1000,naturezaCapital:"caixa",tipoCppCapital:{id:"capital",nome:"CPP Capital"},tipoCppContribuicao:{id:"lead",nome:"CPP Liderança"}}]);
 const base={...calculation,valor_origem:1000,base_economica_inicial:1100,revisao:1,modelo_calculo:3,participantes:calculation.participantes};
 const entries=new Map<string,any>();let calls=0;let lostResponse=true;let readFails=false;
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.session={directusUserId:"u",membroId:req.headers["x-member"]};next();});
 let tail=Promise.resolve();
 const lock=async(_id:string,fn:any)=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>release=r);await previous;try{return await db.transaction(tx=>fn(tx,base));}finally{release();}};
 const source=async()=>{if(readFails)throw new Error("Directus indisponível");return Array.from(entries.values());};
 const service=registerInitialContributions(app,{
   db,lock,access:async(req:any,res:any,id:string,level:string)=>{if(!["d","v"].includes(req.session.membroId) || (level==="edit" && req.session.membroId!=="d")){res.status(403).json({error:"Negado"});return null;}return{bia:{id},access:{permissions:{capital_financeiro:req.session.membroId==="d"?"edit":"view"}}};},
   fetchEntries:source,
   fetchOne:async(col,id)=>{if(readFails)throw new Error("Directus indisponível");return col==="cadastro_geral"?{id}:entries.get(id)||null;},
   category:async name=>name,
   create:async(_col,data)=>{
     assert.ok(data.Categoria.every((v:any)=>typeof v.categorias_id==="string"),"Directus exige objetos da junção de categorias");
     assert.ok(data.tipo_de_cpp.every((v:any)=>typeof v.tipos_cpp_id==="string"),"Directus exige objetos da junção de CPP");
     calls++;assert.ok(!entries.has(data.id),"Não duplicar ID");entries.set(data.id,{...data});if(lostResponse&&calls===3){lostResponse=false;throw new Error("Resposta perdida após criação");}return data;
   },
   update:async(_col,id,patch)=>{const next={...entries.get(id),...patch};entries.set(id,next);return next;},
 });
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 t.after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await pg.close();});
 const address=server.address() as any;const url=`http://127.0.0.1:${address.port}/api/bias/bia/aportes-iniciais`;
 const request=async(method:string,path="",body?:any,member="d")=>{const r=await fetch(url+path,{method,headers:{"content-type":"application/json","x-member":member},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,body:await r.json() as any};};
 assert.equal((await request("GET","",undefined,"x")).status,403);
 assert.equal((await request("PUT","",{},"v")).status,403);
 assert.equal((await request("GET","",undefined,"v")).body.canEdit,false);
 const items=commitmentsFromMap(1000,base.participantes).map(c=>({...c,beneficiario:c.beneficiario||"seller",series:[{total:c.valor,quantidade:1,primeiroVencimento:"2026-09-30",meses:0}]}));
 const input={revisaoEsperada:0,revisaoMap:1,modalidade:"capital_proprio",compromissos:items};
 const concurrent=await Promise.all([request("PUT","",input),request("PUT","",input)]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal(entries.size,0);
 assert.equal((await request("POST","/confirmar",{revisaoEsperada:1})).status,503);
 assert.equal(entries.size,3);
 let view=(await request("GET")).body;assert.equal(view.estado,"pendente");
 assert.equal(view.resumo.reduce((s:number,c:any)=>s+c.integralizado,0),0);
 const incoming=Array.from(entries.values()).find(e=>e.tipo==="entrada");
 entries.set(incoming.id,{...incoming,status:"pago",data_pagamento:"2026-09-30"});
 assert.equal((await request("POST","/confirmar",{revisaoEsperada:1})).status,200);assert.equal(entries.size,4);
 assert.equal(entries.get(incoming.id).status,"pago","Retomada não pode desfazer pagamento recebido do provedor");
 assert.equal((await request("POST","/confirmar",{revisaoEsperada:1})).status,200);assert.equal(calls,4);
 view=(await request("GET")).body;
 const rights=view.parcelas.find((p:any)=>p.componente==="contribuicao");
 assert.equal(rights.movimentos.length,2);
 assert.equal((await request("PATCH",`/parcelas/${rights.id}`,{revisaoEsperada:1,status:"pago",dataPagamento:"2026-09-30",motivo:"Direito integralizado"})).status,200);
 assert.ok(rights.movimentos.every((m:any)=>entries.get(m.id)?.status==="pago"));
 const decorated=await decorateInitialEntries(db,Array.from(entries.values()));
 assert.equal(decorated.filter(e=>e.status==="pago" && isCashEntry(e)).length,1,"Apenas o capital em dinheiro, não o par patrimonial");
 assert.equal(calculateMap(decorated.filter(e=>e.tipo==="entrada").map(e=>({...e,memberId:"d",value:e.valor})),[],[{memberId:"d",value:1100}])[0].value,1100);
 // Exercise the real banking route guard before any provider call, not just the UI filter.
 const sourceCode=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
 const start=sourceCode.indexOf('  app.post("/api/bias/:biaId/banco/cobrancas",');
 const bankingRoute=sourceCode.slice(start,sourceCode.indexOf('  app.post("/api/bias/:biaId/banco/cobrancas/:chargeId/cancelar"',start));
 let providerCalls=0;
 const bankScope:any={app,requireBiaBancoAccess:async()=>({id:"bia"}),pinbank:{configured:true,getConfigStatus:()=>({configured:true}),createBoleto:async()=>{providerCalls++;return{};}},ensureBiaBankAccount:async()=>({}),resolvePinbankCodigoCliente:()=>1,buildPinbankChargePayload:()=>({}),directusFetchOne:async(_c:string,id:string)=>decorated.find(e=>e.id===id),directusRelationId:(v:any)=>v?.id||v,isCashEntry,withMapLock:lock,saveBiaBankCharge:async()=>({}),getAuditActor:()=>({})};
 bankScope.assertBiaFinancialPhase=async()=>{}; // This fixture is operational; phase gates have dedicated workflow tests.
 new Function(...Object.keys(bankScope),transformSync(bankingRoute,{loader:"ts",target:"es2020"}).code)(...Object.values(bankScope));
 const charge=async(id:string)=>(await fetch(`http://127.0.0.1:${address.port}/api/bias/bia/banco/cobrancas`,{method:"POST",headers:{"content-type":"application/json","x-member":"d"},body:JSON.stringify({fluxoCaixaId:id})})).status;
 assert.equal(await charge(rights.movimentos[0].id),409);
 assert.equal(await charge("missing"),404);
 decorated.find(e=>e.id===incoming.id)!.conciliacao_pendente=true;
 assert.equal(await charge(incoming.id),409);assert.equal(providerCalls,0);
 view=(await request("GET")).body;assert.equal(view.resumo.find((c:any)=>c.componente==="contribuicao").integralizado,100);
 const altered=items.map(c=>({...c,series:c.series.map(s=>({...s,primeiroVencimento:"2026-10-30"}))}));
 assert.equal((await request("PUT","",{...input,revisaoEsperada:2,compromissos:altered})).status,409);
 await assert.rejects(()=>assertInitialCommitmentsCompatible(db,"bia",{...base,participantes:base.participantes.map(p=>({...p,cppOrigem:50}))},Array.from(entries.values())),/não cobre/);
 assert.equal((await request("PATCH",`/parcelas/${rights.id}`,{revisaoEsperada:2,status:"agendado",motivo:"Reversão autorizada"})).status,200);
 assert.ok(rights.movimentos.every((m:any)=>entries.get(m.id)?.status==="agendado"));
 readFails=true;assert.notEqual((await request("GET")).status,200);readFails=false;
 await service.recover();assert.equal(entries.size,4);
 const capitalParcel=view.parcelas.find((p:any)=>p.componente==="capital");
 await db.execute(sql`UPDATE bia_aportes_parcelas SET vigente=false,pendente=true WHERE id=${capitalParcel.id}`);
 await db.execute(sql`UPDATE bia_aportes_iniciais SET estado='pendente' WHERE bia_id='bia'`);
 await assert.rejects(()=>service.recover(),/recebeu pagamento/);
 assert.equal(entries.get(incoming.id).status,"pago","Conciliação não cancela pagamento recebido entre confirmação e aplicação");
 const snapshot=JSON.stringify(Array.from(entries.values()));
 base.modelo_calculo=1;assert.equal((await request("PUT","",{...input,revisaoEsperada:3})).status,404);
 assert.equal(JSON.stringify(Array.from(entries.values())),snapshot);
});
