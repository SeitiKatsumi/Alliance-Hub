import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paidBiaReceipts, plannedBiaSales, biaAssetIndicators, currentBiaMonth } from './bia-automatic-indicators';
import { manualTrackingFields, BIA_TRACKING_FIELDS } from './bia-tracking';
import { emptyBiaSetup } from './bia-setup';
import { biaCardIndicators } from './bia-card-indicators';

const entry = (id:string, kind='1.1 Venda do ativo / unidades', extra:any={}) => ({id,bia:'A',tipo:'entrada',status:'pago',valor:44.90,data_pagamento:'2026-11-03',Categoria:[{categorias_id:{Nome_da_categoria:kind,Tipo_de_categoria:'Entrada'}}],...extra});
test('receipts use paid categorized cash, exact BIA scope, cent precision and no duplicated relations',()=>{
 const valid=entry('sale');
 const rows=[valid,valid,entry('rent','1.2 Receita de locação'),entry('op','1.3 Receita de operação'),entry('capital','2.1 Aporte inicial'),entry('loan','3.1 Empréstimos e financiamento bancário'),entry('other','1.1 Venda do ativo / unidades',{bia:'B'}),entry('out','1.1 Venda do ativo / unidades',{tipo:'saida'}),entry('rights','1.1 Venda do ativo / unidades',{natureza:'nao_caixa'}),entry('replaced','1.1 Venda do ativo / unidades',{parcela_vigente:false}),entry('reconcile','1.1 Venda do ativo / unidades',{conciliacao_pendente:true}),...['pendente','agendado','vencido','parcial','cancelado'].map(status=>entry(status,undefined,{status}))];
 assert.deepEqual(paidBiaReceipts('A',rows,'2026-11'),{salesReceived:44.9,rentReceived:44.9,operationReceived:44.9,lodgingReceived:89.8});
 assert.equal(paidBiaReceipts('A',[entry('x',undefined,{valor:0.1}),entry('y',undefined,{valor:0.2})],'2026-11').salesReceived,0.3);
 assert.equal(paidBiaReceipts('A',rows.filter(r=>r.id!=='sale'),'2026-11').salesReceived,0);
 assert.equal(paidBiaReceipts('A',[entry('x',undefined,{status:'pendente'})],'2026-11').salesReceived,0);
 assert.equal(paidBiaReceipts('A',[entry('x',undefined,{status:'pago',valor:500})],'2026-11').salesReceived,500);
});
test('monthly receipts use actual payment date, never due date; unavailable is not zero',()=>{
 assert.equal(paidBiaReceipts('A',[entry('r','1.2 Receita de locação',{data_pagamento:'2026-10-31',data_vencimento:'2026-11-03'})],'2026-11').rentReceived,0);
 assert.equal(paidBiaReceipts('A',[entry('r','1.2 Receita de locação',{data_pagamento:null,data:'2026-11-03'})],'2026-11').rentReceived,null);
 assert.equal(paidBiaReceipts('A',null,'2026-11').salesReceived,null);
 assert.equal(paidBiaReceipts('A',[],'2026-11').salesReceived,0);
 assert.equal(currentBiaMonth(new Date('2026-12-01T01:00:00Z')),'2026-11');
});
test('category codes alone and mixed categories never imply a sale or duplicate amounts',()=>{
 const e=entry('a');
 assert.equal(paidBiaReceipts('A',[{...e,Categoria:[{categorias_id:123}]}],'2026-11').salesReceived,0);
 assert.equal(paidBiaReceipts('A',[{...e,Categoria:[...e.Categoria,...entry('b','1.2 Receita de locação').Categoria]}],'2026-11').salesReceived,0);
 assert.equal(paidBiaReceipts('A',[{...e,Categoria:[...e.Categoria,...e.Categoria]}],'2026-11').salesReceived,44.9);
 assert.equal(paidBiaReceipts('A',[entry('x','1.1 Valor de Origem')],'2026-11').salesReceived,0);
});
test('VGV reuses asset forecasts without summing a historical aggregate twice or inventing a partial total',()=>{
 const setup=emptyBiaSetup();setup.indicadoresLegados.valor_geral_venda_vgv=100;
 assert.equal(plannedBiaSales(setup),100);
 setup.ativos=[{indicadores:{valor_geral_venda_vgv:60}},{indicadores:{valor_geral_venda_vgv:80}}] as any;
 assert.equal(plannedBiaSales(setup),140);
 setup.ativos[1].indicadores.valor_geral_venda_vgv=null;assert.equal(plannedBiaSales(setup),null);
});
test('asset valuation uses the same ownership/currency scope for current and acquisition; no false gain from missing cost',()=>{
 const a={id:'p',value:900,acquisition:1000,currency:'BRL',share:50};
 const result=biaAssetIndicators([a,a],'BRL');assert.equal(result.assetValue,450);assert.equal(Math.round(result.appreciation!),-10);
 assert.equal(biaAssetIndicators([{...a,acquisition:null}],'BRL').appreciation,null);
 assert.equal(biaAssetIndicators([{...a,acquisition:0}],'BRL').appreciation,null);
 assert.equal(biaAssetIndicators([{...a,share:null}],'BRL').assetValue,null);
 assert.equal(biaAssetIndicators([a],'USD').assetValue,null);
});
test('all thirteen editors contain only non-derivable fields, never copied financial inputs',()=>{
 for(const code of Object.keys(BIA_TRACKING_FIELDS))assert(manualTrackingFields(code).every(f=>!['money','date'].includes(f.kind)),code);
 assert.deepEqual(manualTrackingFields('FLIPPING').map(f=>f.key),['stage']);
 assert.deepEqual(manualTrackingFields('APPRECIATION_HOLD'),[]);
 assert.deepEqual(manualTrackingFields('SHORT_TERM_RESALE'),[]);
 assert.deepEqual(manualTrackingFields('OPERATION_RESTRUCTURING').map(f=>f.key),['stage']);
 const ui=readFileSync('client/src/components/bia-tracking-fields.tsx','utf8');assert(!ui.includes('saleValues'));assert(ui.includes('manualTrackingFields'));
 const editor=readFileSync('client/src/pages/bias.tsx','utf8');assert(!editor.includes("identityPayload[key] = payload[key]"));
});
test('saved manual financial history cannot override automatic card values or become a fallback on failure',()=>{
 const bia={business_type_code:'BUY_AND_HOLD',acompanhamento:{revision:2,byThesis:{BUY_AND_HOLD:{rentalStatus:'Alugado',monthlyRent:9999}}}};
 assert.deepEqual(biaCardIndicators(bia).metrics.map(m=>m.value),['Alugado',null]);
 assert.equal(biaCardIndicators({...bia,indicadores_automaticos:{period:'2026-11',salesReceived:0,rentReceived:44.9,operationReceived:0,lodgingReceived:44.9,plannedSales:null,assetValue:null,appreciation:null}}).metrics[1].value,44.9);
});
