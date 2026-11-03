import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePropertyCib} from './property-cib';
import {mergePropertyExtraction,applyConfirmedPropertyMarketEstimate} from '../server/property-journey';
import {biaAssetFromPortfolio} from './bia-setup';
import {propertyMarketFingerprint} from '../server/property-market-evidence';

test('CIB é opcional, preserva zeros/letras e normaliza somente a apresentação',()=>{
 for(const value of [undefined,null,'','   ']) assert.equal(normalizePropertyCib(value),'');
 assert.equal(normalizePropertyCib(' abc12345 '),'ABC1234-5');
 assert.equal(normalizePropertyCib('0.012.345-6'),'0012345-6');
 assert.equal(normalizePropertyCib('Q9BA55VW'),'Q9BA55V-W');
 for(const value of [12345678,{},['ABC12345'],'ABC123','ABC123456','ABC/1234-5']) assert.throws(()=>normalizePropertyCib(value),error=>(error as any).status===400);
});

test('extração mantém CIB declarado e pede conferência de divergência sem inventar por matrícula',()=>{
 assert.deepEqual(mergePropertyExtraction({},{cib:'abc12345'}).draft,{cib:'ABC1234-5'});
 assert.deepEqual(mergePropertyExtraction({cib:'ABC1234-5'},{cib:'abc12345'}).conflicts,{});
 const conflict=mergePropertyExtraction({cib:'ABC1234-5'},{cib:'XYZ98765'},'documento fictício');
 assert.equal(conflict.draft.cib,'ABC1234-5');assert.equal(conflict.conflicts.cib.extraido,'XYZ9876-5');
 assert.deepEqual(mergePropertyExtraction({},{cib:'sem código',matricula:'123'}).draft,{matricula:'123'});
 const completed=applyConfirmedPropertyMarketEstimate({cib:'ABC1234-5',matricula:'123'},{});
 assert.equal(completed.cib,'ABC1234-5');assert.equal(completed.matricula,'123');
});

test('identificador privado não entra no snapshot descritivo da BIA nem altera a avaliação de mercado',()=>{
 const property={id:'one',nome:'Casa',tipo:'Casa',cib:'ABC1234-5'};
 assert.doesNotMatch(JSON.stringify(biaAssetFromPortfolio(property)),/ABC1234|cib/);
 assert.equal(propertyMarketFingerprint(property),propertyMarketFingerprint({...property,cib:'XYZ9876-5'}));
});
