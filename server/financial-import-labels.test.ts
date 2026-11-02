import test from 'node:test';
import assert from 'node:assert/strict';
import {financialImportLabels, financialImportRows} from './financial-import-labels';
import {financialImportPrompt} from './financial-import-prompt';

test('import labels use canonical categories and trim descriptions without inventing IDs',()=>{
 const categories=[{id:7,nome:'Alimentação'},{id:8,nome:'Condomínio'}];
 assert.deepEqual(financialImportLabels({descricao:'  Compra de alimentos · Confeitaria  ',categoria_id:'7',categoria_nome:'Errada'},categories),{descricao:'Compra de alimentos · Confeitaria',categoria_id:7,categoria_nome:'Alimentação'});
 assert.equal(financialImportLabels({categoria_nome:' alimentacao '},categories).categoria_id,7);
 assert.equal(financialImportLabels({categoria_id:999,categoria_nome:'Inventada'},categories).categoria_id,null);
 assert.equal(financialImportLabels({categoria_nome:'Alimentação'},[...categories,{id:9,nome:'Alimentação'}]).categoria_id,null);
 assert.equal(financialImportLabels({descricao:'   '},categories).descricao,'Lançamento importado por IA');
});
test('deterministic schedule retains missing installments and only enriches unique matches',()=>{
 const row={tipo:'saida',valor:100,data_vencimento:'2026-12-01',status:'agendado',descricao:'Parcela 1/2'};
 const other={...row,data_vencimento:'2027-01-01',descricao:'Parcela 2/2'};
 const suggestion={...row,status:'pago',descricao:'Aquisição do imóvel',categoria_id:7,categoria_nome:'Valor de Origem'};
 const result=financialImportRows([row,other],[suggestion]);
 assert.equal(result.length,2);assert.equal(result[0].status,'agendado');assert.equal(result[0].valor,100);
 assert.equal(result[0].descricao,'Parcela 1/2 · Aquisição do imóvel');assert.equal(result[0].categoria_id,7);assert.deepEqual(result[1],other);
 assert.deepEqual(financialImportRows([row,row,other],[suggestion]),[row,row,other]);
 assert.deepEqual(financialImportRows([], [suggestion]),[suggestion]);
});
test('financial import prompt requests both fields using catalog meaning for each installment',()=>{
 const prompt=financialImportPrompt({today:'2026-11-02',deterministicLancamentos:[],categoriaOptions:[{id:7,nome:'Alimentação',descricao:'Compra de alimentos'}],tipoCppOptions:[],textContent:'Documento sintético'});
 assert.match(prompt,/Preencha sempre descricao/);assert.match(prompt,/Sugira categoria_id e categoria_nome/);
 assert.match(prompt,/não classifique pela modalidade/);assert.match(prompt,/cada parcela da pré-leitura/);
 assert.match(prompt,/Compra de alimentos/);
});
