import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withAutomaticBiaIndicators, BIA_RECEIPTS_QUERY, loadBiaAssetIndicators } from './bia-automatic-indicators';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { emptyBiaSetup } from '../shared/bia-setup';
test('hydration authorizes each source, scopes the query and exposes only aggregates',async()=>{
 let assetCalls=0;
 const items=[{id:'allowed',business_type_code:'SHORT_STAY',acompanhamento:{byThesis:{SHORT_STAY:{period:'2026-10'}}}},{id:'denied'}];
 const result=await withAutomaticBiaIndicators(items,{
  permissions:async b=>({finance:b.id==='allowed',assets:b.id==='allowed'}),
  entries:async ids=>{assert.deepEqual(ids,['allowed']);return [{id:'1',bia:'allowed',tipo:'entrada',status:'pago',valor:200,data_pagamento:'2026-10-20',private:'SECRET',Categoria:[{categorias_id:{Nome_da_categoria:'1.2 Receita de locação',Tipo_de_categoria:'Entrada'}}]}]},
  assets:async()=>{assetCalls++;return {plannedSales:1000,assetValue:1200,appreciation:20}},
  now:new Date('2026-11-03T12:00:00Z')
 });
 assert.equal(assetCalls,1);assert.equal(result[0].indicadores_automaticos.rentReceived,200);assert.equal(result[0].indicadores_automaticos.period,'2026-10');
 assert.equal(result[1].indicadores_automaticos.salesReceived,null);assert.equal(result[1].indicadores_automaticos.assetValue,null);assert(!JSON.stringify(result).includes('SECRET'));
});
test('upstream failures do not crash cards or manufacture zero; paid fields are physically queryable',async()=>{
 const [bia]=await withAutomaticBiaIndicators([{id:'A'}],{permissions:async()=>({finance:true,assets:true}),entries:async()=>{throw Error('offline')},assets:async()=>{throw Error('offline')}});
 assert.equal(bia.indicadores_automaticos.salesReceived,null);assert.equal(bia.indicadores_automaticos.plannedSales,null);
 assert(BIA_RECEIPTS_QUERY.includes('data_pagamento'));assert(!BIA_RECEIPTS_QUERY.includes('natureza'));assert(BIA_RECEIPTS_QUERY.includes('Categoria.categorias_id.*'));
 const routes=readFileSync('server/routes.ts','utf8');assert(routes.includes("hasBiaAccess(access.permissions,'capital_financeiro','view')"));assert(routes.includes("hasCompanyAccess(req.session.companyEmployeePermissions, 'capital', 'view')"));
 assert(routes.includes('hydrateBiaIndicators(req, await withBiaTracking(db, userBias)'));assert(routes.includes('hydrateBiaIndicators(req, await withBiaTracking(db, withCodes)'));assert(routes.includes('hydrateBiaIndicators(req, await withBiaTracking(db, [item]'));
});

test('real SQL asset adapter reuses current structure and formal ownership without leaking or double counting properties',async()=>{
 const pg=new PGlite(),db=drizzle(pg);
 try {
  await pg.exec('CREATE TABLE bia_estrutura_versoes(bia_id text,revisao int,evento text,dados jsonb,contexto jsonb); CREATE TABLE inventario_imoveis(id text,data jsonb); CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);');
  const setup=emptyBiaSetup();setup.ativosIndefinidos=false;
  setup.ativos=[{id:'a',carteiraImovelId:'p',valorReferencia:9999,situacao:'Adquirido',indicadores:{valor_geral_venda_vgv:1800}}] as any;
  await pg.query('INSERT INTO bia_estrutura_versoes VALUES ($1,1,$2,$3,$4)',['A','edit',JSON.stringify(setup),'{}']);
  await pg.query('INSERT INTO inventario_imoveis VALUES ($1,$2)',['p',JSON.stringify({valor_atual:1500,valor_pago:1000,moeda:'BRL',private:'SECRET'})]);
  await pg.exec("INSERT INTO bia_imovel_origens VALUES ('A','p','ativa')");
  assert.deepEqual(await loadBiaAssetIndicators(db,{id:'A',moeda:'BRL'},async()=>{throw Error('Should use saved version')}),{plannedSales:1800,assetValue:1500,appreciation:50});
  await pg.exec("UPDATE bia_imovel_origens SET status='cancelada'");
  assert.deepEqual(await loadBiaAssetIndicators(db,{id:'A',moeda:'BRL'},async()=>({})),{plannedSales:1800,assetValue:null,appreciation:null});
 } finally {await pg.close()}
});

test('legacy fallback releases pool queries before reserving a transaction',async()=>{
 const pg=new PGlite(),base=drizzle(pg);let transactionOpen=false,called=false;
 try {
  await pg.exec('CREATE TABLE inventario_imoveis(id text,data jsonb); CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);');
  const db={execute:base.execute.bind(base),transaction:async(fn:any)=>base.transaction(async tx=>{transactionOpen=true;try{return await fn(tx)}finally{transactionOpen=false}})};
  await loadBiaAssetIndicators(db,{id:'legacy'},async()=>{called=true;assert.equal(transactionOpen,false,'Legacy queries must not wait for another pool connection inside a transaction');return {}});
  assert(called);
 }finally{await pg.close()}
});
