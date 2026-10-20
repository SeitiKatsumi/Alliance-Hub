import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { ContributionBilling } from "./contribution-billing";
import { registerContributionBilling } from "./contribution-billing-routes";
import { ContributionProvider, accountTransport, contributionBillingEnabled } from "./contribution-billing-provider";
import { AsaasTransport } from "./asaas/client";
import { asaasConfig } from "./asaas/config";
import { INITIAL_CONTRIBUTIONS_SQL } from "./initial-contributions";
import { billingTotals, revisedCents, revisionInputSchema, defaultBillingSettings, saoPauloClock, canManageContributionBilling, providerPaymentState } from "../shared/contribution-billing";

test("domínio: centavos, pagamentos confirmados, relógio Brasil e três gestores",async()=>{
  assert.equal(saoPauloClock(new Date("2031-06-10T12:00:00Z")).hour,9);
  const input=revisionInputSchema.parse({parcelIds:[randomUUID()],fromDate:"2031-06-10",mode:"percent",value:12.5,reason:"Atualização"});
  assert.equal(revisedCents(10001,input),11251);assert.throws(()=>revisedCents(100,{...input,value:-100}));
  for(const role of ["diretor_capital","diretor_alianca","aliado"])assert.ok(canManageContributionBilling([role]));
  assert.equal(canManageContributionBilling(["socio_guardiao"]),false);
  assert.equal(providerPaymentState("AWAITING_RISK_ANALYSIS"),"processing");
  assert.equal(revisionInputSchema.safeParse({...input,fromDate:"2031-02-31"}).success,false);
  assert.deepEqual(billingTotals([{vigente:true,amount_cents:100,payment_state:"confirmed"},{vigente:true,amount_cents:300,payment_state:"received"}],"2031-01-01"),{expected:400,received:300,confirmed:100,upcoming:0,overdue:0,processing:0,percentage:75});
  assert.equal(contributionBillingEnabled({ASAAS_BASE_ENABLED:"true",ASAAS_BASE_ENVIRONMENT:"production",ASAAS_BAAS_ENABLED:"true",ASAAS_CONTRIBUTIONS_ENABLED:"true"}),false);
  await assert.rejects(()=>accountTransport({state:"approved",ownership:"platform"}));
});

test("cobranças: migração isolada, fila, conta própria, revisão, webhook, pagamento e avisos sem duplicação",async()=>{
  const pg=new PGlite(),db=drizzle(pg),accountId=randomUUID();
  await pg.exec("CREATE TABLE bia_map_inicial_snapshots(bia_id text PRIMARY KEY);"+INITIAL_CONTRIBUTIONS_SQL);
  await pg.exec(readFileSync(new URL("../migrations/20261014_asaas_foundation.sql",import.meta.url),"utf8"));
  const migration=readFileSync(new URL("../migrations/20261019_contribution_billing.sql",import.meta.url),"utf8");
  await pg.exec(migration);await pg.exec(migration);
  await pg.exec("CREATE TABLE agenda_tarefas(id text PRIMARY KEY,user_id text,membro_id text,titulo text,descricao text,data date,status text,prioridade text,contexto_tipo text,contexto_id text,origem_tarefa_id text,atualizado_em timestamp DEFAULT now());");
  await db.execute(sql`INSERT INTO asaas_sandbox.accounts(id,label,ownership,owner_id,external_account_id,wallet_id,state,credential_reference) VALUES(${accountId},'SPE teste','company','spe','account-fixture','wallet-fixture','approved','ASAAS_SANDBOX_ACCOUNT_FIXTURE')`);
  await db.execute(sql`INSERT INTO asaas_sandbox.bia_accounts(bia_id,account_id) VALUES('bia-test',${accountId})`);
  await db.execute(sql`INSERT INTO bia_aportes_iniciais(bia_id,revisao,revisao_map,modalidade,compromissos,autor,estado) VALUES('bia-test',1,1,'capital_proprio','[]','{}','confirmado')`);
  const entries=new Map<string,any>(),parcels:string[]=[];
  for(const [natureza,componente,status] of [["caixa","capital","agendado"],["nao_caixa","capital","agendado"],["caixa","ativo","agendado"],["caixa","capital","pago"]]) {
    const id=randomUUID(),flow=randomUUID();parcels.push(id);entries.set(flow,{id:flow,status,valor:100,tipo:"entrada"});
    await db.execute(sql`INSERT INTO bia_aportes_parcelas(id,bia_id,revisao,chave,numero,natureza,componente,valor,vencimento,movimentos,pendente) VALUES(${id},'bia-test',1,${id},1,${natureza},${componente},100,'2031-06-10',${JSON.stringify([{id:flow,favorecido_id:"payer",status,valor:100}])}::jsonb,false)`);
  }
  const payments=new Map<string,any>(),customers=new Map<string,any>();
  let created=0,updated=0,email=0,timeoutAfterCreate=false,timeoutAfterUpdate=false,wrongWallet=false,enabled=true,emailFailure=false;
  const transport=new AsaasTransport(asaasConfig({ASAAS_BASE_ENVIRONMENT:"sandbox",ASAAS_BASE_ENABLED:"true",ASAAS_SANDBOX_API_KEY:"own-account-fixture-key"}),async(url:any,opts:any)=>{
    assert.equal(new Headers(opts.headers).get("access_token"),"own-account-fixture-key");
    const u=new URL(String(url)),path=u.pathname.replace("/v3","");const body=opts.body?JSON.parse(opts.body):null;
    if(path==="/wallets")return Response.json({data:[{id:wrongWallet?"wrong":"wallet-fixture"}]});
    if(path==="/myAccount/status")return Response.json({general:"APPROVED"});
    if(path==="/customers"&&opts.method==="POST"){assert.equal(body.notificationDisabled,true);const c={...body,id:"cus-fixture"};customers.set(body.externalReference,c);return Response.json(c);}
    if(path==="/customers")return Response.json({data:customers.has(u.searchParams.get("externalReference"))?[customers.get(u.searchParams.get("externalReference"))]:[]});
    if(path.startsWith("/customers/"))return Response.json({id:"cus-fixture"});
    if(path==="/payments"&&opts.method==="POST"){
      created++;const p={...body,id:"pay-fixture",status:"PENDING",invoiceUrl:"https://sandbox.asaas.com/i/test",bankSlipUrl:"https://sandbox.asaas.com/b/test"};payments.set(p.id,p);
      if(timeoutAfterCreate){timeoutAfterCreate=false;throw new Error("lost response");}return Response.json(p);
    }
    if(path==="/payments")return Response.json({data:Array.from(payments.values()).filter(p=>p.externalReference===u.searchParams.get("externalReference"))});
    if(path.endsWith("/identificationField"))return Response.json({identificationField:"12345"});
    const payment=payments.get(path.split("/")[2]);
    if(opts.method==="PUT"){updated++;payment.value=body.value;if(timeoutAfterUpdate){timeoutAfterUpdate=false;throw new Error("lost update");}}
    return Response.json(payment);
  });
  const service=new ContributionBilling({db,lock:async(_id,fn)=>db.transaction(tx=>fn(tx,{})),enabled:()=>enabled,
    entries:async()=>Array.from(entries.values()),bia:async()=>({situacao:"em_execucao",moeda:"BRL"}),
    member:async(id)=>({id,nome:"Pagador teste",email:"payer@example.test",cpf:"12345678901"}),
    updateFlow:async(id,patch)=>{Object.assign(entries.get(id),patch);},userForMember:async()=>"user-fixture",
    provider:()=>new ContributionProvider(transport),sendNotice:async()=>{email++;return {ok:!emailFailure};},
  });
  try {
    assert.equal(await service.ready(),true);
    await service.enqueue("bia-test");await service.enqueue("bia-test");
    let dashboard=await service.dashboard("bia-test",true,"payer");assert.equal(dashboard.rows.length,2);
    const chargeId=dashboard.rows.find(r=>r.parcelId===parcels[0]).id;
    wrongWallet=true;await service.processCharge(chargeId);assert.equal(created,0);wrongWallet=false;
    timeoutAfterCreate=true;await service.processCharge(chargeId);assert.equal(created,1);
    assert.equal((await service.dashboard("bia-test",true,"payer")).rows.find(r=>r.id===chargeId).jobState,"unknown");
    await service.processCharge(chargeId);assert.equal(created,1);
    const details=await service.details("bia-test",chargeId,false,"payer");assert.equal(details.barcode,"12345");
    await assert.rejects(()=>service.details("bia-test",chargeId,false,"other"),/restrito/);
    assert.equal(JSON.stringify(await service.dashboard("bia-test",false,"other")).includes("sandbox.asaas.com"),false);
    await service.notices(new Date("2031-06-05T11:59:00Z"));assert.equal(email,0);
    await service.notices(new Date("2031-06-05T12:00:00Z"));await service.notices(new Date("2031-06-05T12:05:00Z"));assert.equal(email,1);
    assert.equal((await db.execute(sql`SELECT count(*)::int n FROM agenda_tarefas`)).rows[0].n,1);
    const body={parcelIds:[parcels[0]],fromDate:"2030-01-01",mode:"percent",value:10,reason:"Reajuste autorizado"};
    const preview=await service.preview("bia-test",body);assert.equal(preview.after,11000);
    const request={...body,batchId:randomUUID(),previewHash:preview.hash,confirm:true};
    await service.revise("bia-test",request,"manager");await service.revise("bia-test",request,"manager");
    await assert.rejects(()=>service.revise("bia-test",{...request,value:20},"manager"),/Chave/);
    timeoutAfterUpdate=true;await service.processCharge(chargeId);assert.equal(updated,1);
    await service.processCharge(chargeId);assert.equal(updated,1);
    dashboard=await service.dashboard("bia-test",true,"payer");assert.equal(dashboard.rows.find(r=>r.id===chargeId).amountCents,11000);assert.equal(dashboard.history[0].state,"applied");
    assert.equal(Number((await db.execute(sql`SELECT valor FROM bia_aportes_parcelas WHERE id=${parcels[0]}`)).rows[0].valor),100);
    const deliveryRow=(await service.rows("bia-test")).find(r=>r.id===chargeId),beforeEmail=email;
    emailFailure=true;
    await (service as any).deliver(deliveryRow,"smtp-failure-fixture","email",new Date("2031-06-05T12:00:00Z"));
    await (service as any).deliver(deliveryRow,"smtp-failure-fixture","email",new Date("2031-06-05T12:00:00Z"));
    assert.equal(email,beforeEmail+1);emailFailure=false;
    assert.equal((await db.execute(sql`SELECT state FROM bia_contribution_notices WHERE kind='smtp-failure-fixture'`)).rows[0].state,"unknown");
    await assert.rejects(()=>service.webhook({payment:{id:"pay-fixture"},account:{id:"other-account"}}),/Origem/);
    payments.get("pay-fixture").status="CONFIRMED";
    await service.webhook({payment:{id:"pay-fixture"},account:{id:"account-fixture"}});await service.processCharge(chargeId);
    dashboard=await service.dashboard("bia-test",true,"payer");assert.equal(dashboard.totals.confirmed,11000);assert.equal(dashboard.totals.received,10000);
    payments.get("pay-fixture").status="RECEIVED";payments.get("pay-fixture").paymentDate="2031-06-10";
    await service.processCharge(chargeId);await service.processCharge(chargeId);
    dashboard=await service.dashboard("bia-test",true,"payer");assert.equal(dashboard.totals.received,21000);assert.equal(dashboard.rows.find(r=>r.id===chargeId).canRevise,false);
    assert.ok(Array.from(entries.values()).some(e=>e.pagamento_id==="pay-fixture"&&e.status==="pago"));
    payments.get("pay-fixture").status="PENDING"; // Even an eventually-stale provider read cannot undo a received state.
    await service.webhook({payment:{id:"pay-fixture",status:"PENDING"},account:{id:"account-fixture"}});await service.processCharge(chargeId);
    assert.equal((await service.dashboard("bia-test",true,"payer")).rows.find(r=>r.id===chargeId).paymentState,"received");
    payments.get("pay-fixture").status="RECEIVED";await service.processCharge(chargeId);
    const sentBefore=email;await service.notices(new Date("2031-06-10T12:00:00Z"));assert.equal(email,sentBefore);
    await assert.rejects(()=>service.preview("bia-test",body),/protegida/);
    enabled=false;await service.processCharge(chargeId);assert.equal(created,1);
    assert.equal((await service.dashboard("other-bia",false,"other")).rows.length,0);
    assert.deepEqual((await service.settings("bia-test")).offsets,defaultBillingSettings.offsets);
    await service.saveSettings("bia-test",{...defaultBillingSettings,revision:0,offsets:[-2,0,4]},"manager");
    await assert.rejects(()=>service.saveSettings("bia-test",{...defaultBillingSettings,revision:0},"manager"),/alterada/);
    // A batch remains per-item: one local revision succeeds, a concurrent partial payment protects the other.
    const batchParcels:string[]=[],batchFlows:string[]=[];
    for(let index=0;index<2;index++){
      const parcel=randomUUID(),flow=randomUUID();batchParcels.push(parcel);batchFlows.push(flow);
      entries.set(flow,{id:flow,status:"agendado",valor:100});
      await db.execute(sql`INSERT INTO bia_aportes_parcelas(id,bia_id,revisao,chave,numero,natureza,componente,valor,vencimento,movimentos,pendente) VALUES(${parcel},'bia-test',1,${parcel},2,'caixa','capital',100,'2031-07-10',${JSON.stringify([{id:flow,favorecido_id:"payer",status:"agendado",valor:100}])}::jsonb,false)`);
    }
    await service.enqueue("bia-test");
    const batchInput={parcelIds:batchParcels,fromDate:"2030-01-01",mode:"value",value:80,reason:"Revisão em lote de teste"};
    const batchPreview=await service.preview("bia-test",batchInput),batchId=randomUUID();
    await service.revise("bia-test",{...batchInput,batchId,previewHash:batchPreview.hash,confirm:true},"manager");
    await assert.rejects(()=>service.preview("bia-test",batchInput),/protegida/);
    entries.get(batchFlows[1]).status="parcial";
    for(const item of batchPreview.rows)await service.processCharge(item.id);
    const result=(await db.execute(sql`SELECT state FROM bia_contribution_revisions WHERE batch_id=${batchId} ORDER BY state`)).rows;
    assert.deepEqual(result.map(r=>r.state),["applied","failed"]);
    assert.equal(entries.get(batchFlows[0]).valor,80);assert.equal(entries.get(batchFlows[1]).valor,100);
    assert.equal(created,1); // Disabled integration never emits even while local financial planning is revised.
    const paidTasks=(await db.execute(sql`SELECT status,contexto_id FROM agenda_tarefas`)).rows;
    assert.ok(paidTasks.every(r=>r.status==="concluida"&&r.contexto_id==="bia-test"));
  } finally {await pg.close();}
});

test("integração: painel removido e webhook legado isolado",()=>{
  const routes=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  assert.doesNotMatch(routes,/contributionOverview/);
  assert.match(routes,/companyReference.startsWith\("built:contribution:"\)/);
  const page=readFileSync(new URL("../client/src/pages/nucleo-capital.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(page,/ContributionPayments|acompanhamento dos aportes|value="acompanhamento"/i);
});

test("APIs: autorização antes de leitura/escrita, falha de armazenamento e proteção de meios de pagamento",async()=>{
  const app=express();app.use(express.json());let writes=0;
  const service:any={requireReady:async()=>{},dashboard:async(_id:string,manage:boolean)=>({canManage:manage,rows:[]}),details:async()=>{throw Object.assign(new Error("restrito"),{statusCode:403});},saveSettings:async()=>{writes++;return{};}};
  registerContributionBilling(app,service,async(req,res,write)=>{const role=req.get("x-role");if(role==="other"||role==="employee"||(write&&role==="reader")){res.status(403).json({error:"Negado"});return null;}return {biaId:"authorized",manage:role==="manager",payerId:null,actorId:"actor"};});
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));const base=`http://127.0.0.1:${(server.address() as any).port}/api/bias/bia/aportes-iniciais/cobrancas`;
  try {
    for(const role of ["other","employee"])assert.equal((await fetch(base,{headers:{"x-role":role}})).status,403);
    assert.equal((await fetch(base,{headers:{"x-role":"reader"}})).status,200);
    assert.equal((await fetch(base+"/lembretes",{method:"PUT",headers:{"x-role":"reader"}})).status,403);assert.equal(writes,0);
    assert.equal((await fetch(base+"/id/pagamento",{headers:{"x-role":"reader"}})).status,403);
    service.requireReady=async()=>{throw Object.assign(new Error("Migração pendente"),{statusCode:503});};
    assert.equal((await fetch(base,{headers:{"x-role":"manager"}})).status,503);
  }finally{server.close();}
});
