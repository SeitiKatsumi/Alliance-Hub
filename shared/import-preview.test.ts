import test from "node:test";
import assert from "node:assert/strict";
import { mergeImportPreview, importPreviewError, type ImportPreviewItem } from "./import-preview";
const item = (valor: number, descricao: string): ImportPreviewItem => ({tipo:"saida",valor,descricao,data:"2026-11-02",data_vencimento:"2026-11-02",data_pagamento:"2026-11-02",status:"pago",categoria_id:1,categoria_nome:"Alimentação",tipo_cpp_id:null});
test("junção do comprovante conserva 44,90 em centavos e a origem não é alterada", () => {
  const items=[item(9.68,"Pão"),item(18.45,"Bolo"),item(16.77,"Pão doce")];
  const merged=mergeImportPreview(items,[2,0,1,1]);
  assert.equal(merged.length,1);assert.equal(merged[0].valor,44.9);assert.equal(merged[0].descricao,"Pão; Bolo; Pão doce");
  assert.equal(items.length,3);assert.equal(items[0].valor,9.68);assert.equal(merged[0].data_pagamento,"2026-11-02");
  assert.equal(mergeImportPreview([item(.1,"A"),item(.2,"B")],[0,1])[0].valor,.3);
});
test("seleção parcial mantém demais itens e categorias conflitantes não são presumidas",()=>{
 const items=[item(1,"A"),item(2,"B"),{...item(3,"C"),categoria_id:2,tipo_cpp_id:2}];
 const merged=mergeImportPreview(items,[0,2]);assert.equal(merged.length,2);assert.equal(merged[0].valor,4);assert.equal(merged[0].categoria_id,null);assert.equal(merged[0].tipo_cpp_id,null);assert.equal(merged[1],items[1]);
});
test("bloqueia mistura de entrada/saída, pagamentos e datas; valida edição antes de criar",()=>{
 for(const patch of [{tipo:"entrada"},{status:"pendente"},{data_vencimento:"2026-11-03"},{data_pagamento:null},{data:"2026-11-03"}]) assert.throws(()=>mergeImportPreview([item(1,"A"),{...item(2,"B"),...patch} as ImportPreviewItem],[0,1]));
 for(const patch of [{valor:NaN},{valor:Infinity},{valor:0},{valor:-1},{descricao:" "},{data:""},{data:"2026-02-30"}]) assert.ok(importPreviewError([{...item(1,"A"),...patch}]));
 assert.throws(()=>mergeImportPreview([item(1,"A")],[0,8]));assert.equal(importPreviewError([item(44.9,"Compra na confeitaria")]),null);
});
