import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {splitExpense,inheritedExpenseSplit} from '../../../shared/expense-contributions';
const page=readFileSync(new URL('./fluxo-caixa.tsx',import.meta.url),'utf8');
function fixture(ids:string[],amount:number) {
 let rows:any[]=[{membroId:'anterior',valor:'100,00'}],mode='percentual';
 const source=page.slice(page.indexOf('function applyGuardianRateio('),page.indexOf('function equalizeRateioPercentual('));
 const apply=new Function('guardianMemberIds','formValor','parseBRLToNumber','splitExpense','rateioItems','setRateioModo','setRateioItems',transformSync(source,{loader:'ts'}).code+';return applyGuardianRateio;')(ids,amount,Number,splitExpense,rows,(v:string)=>mode=v,(v:any[])=>rows=v);
 return {apply,rows:()=>rows,mode:()=>mode};
}
test('guardiões dividem em partes iguais e a diferença de centavos é distribuída',()=>{
 const f=fixture(['b','a','c','a'],100);f.apply();
 assert.equal(f.mode(),'valor');
 assert.deepEqual(f.rows().map(r=>r.membroId),['a','b','c']);
 assert.deepEqual(f.rows().map(r=>r.valor),['33,34','33,33','33,33']);
 const shares=inheritedExpenseSplit(100,'valor',f.rows().map(r=>({memberId:r.membroId,value:Number(r.valor.replace(',','.'))})));
 assert.equal(shares.reduce((n,r)=>n+Math.round(r.amount*100),0),10000);
});
test('R$699,99 entre três guardiões resulta em R$233,33 para cada um',()=>{
 const f=fixture(['a','b','c'],699.99);f.apply();assert.deepEqual(f.rows().map(r=>r.valor),['233,33','233,33','233,33']);
});
test('sem guardiões ou valor insuficiente mantém o rascunho',()=>{
 for(const [ids,amount] of [[[],100],[['a','b'],0],[['a','b'],0.01]] as [string[],number][]) {const f=fixture(ids,amount),prior=f.rows();f.apply();assert.equal(f.rows(),prior);}
});
test('criação e edição recebem todos os guardiões, inclusive sem aporte no MAP',()=>{
 assert.equal((page.match(/guardianMemberIds=\{guardianMemberIds\}/g)||[]).length,2);
 assert.match(page,/parseMemberList\(selectedBia\?\.socios_guardioes\)/);
 assert.match(page,/onClick=\{applyGuardianRateio\}/);
});
