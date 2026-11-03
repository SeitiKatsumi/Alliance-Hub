import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {biaCardIndicators} from './bia-card-indicators';
import {STRATEGIC_CELL_BUSINESS_TYPES} from './strategic-cells';
test('all 13 canonical theses have two indicators and never use sale data for rental or ambiguous theses',()=>{
for(const [,code] of STRATEGIC_CELL_BUSINESS_TYPES){
const result=biaCardIndicators({objetivo_alianca:code,valor_realizado_venda:92,valor_geral_venda_vgv:100});
assert.equal(result.metrics.length,2,code);
if(!['FLIPPING','SHORT_TERM_RESALE','REAL_ESTATE_INCORPORATION','LAND_SUBDIVISION'].includes(code)) assert.ok(result.metrics.every(m=>m.value===null),code);
}
});
test('unknown thesis never guesses from legacy objectives; canonical code takes precedence',()=>{
assert.equal(biaCardIndicators({objetivo_alianca:'Venda'}).metrics.length,0);
assert.equal(biaCardIndicators({business_type_code:'SHORT_STAY',objetivo_alianca:'FLIPPING'}).metrics[0].label,'Ocupação no período');
});
test('sale values retain explicit zero and precision; missing/invalid are not zero',()=>{
for(const value of [null,undefined,'', ' ', 'invalid', -1, Infinity]) assert.equal(biaCardIndicators({objetivo_alianca:'FLIPPING',valor_realizado_venda:value}).metrics[1].value,null);
for(const value of [0,44.9,100.75]) assert.equal(biaCardIndicators({objetivo_alianca:'FLIPPING',indicadores_automaticos:{period:'2026-11',salesReceived:value,rentReceived:0,operationReceived:0,lodgingReceived:0,assetValue:null,appreciation:null,plannedSales:null}}).metrics[1].value,value);
});
test('both card consumers use shared indicators and retain phase without generic progress',()=>{
for(const path of ['client/src/pages/bias.tsx','client/src/pages/painel.tsx']){
const text=readFileSync(path,'utf8');assert.ok(text.includes('<BiaCardIndicators bia={bia} />'));assert.ok(text.includes('biaPhaseLabel(bia.situacao)'));assert.ok(!text.includes('Progresso geral'));
}
});
