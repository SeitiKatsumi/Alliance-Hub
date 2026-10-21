import test from "node:test";
import assert from "node:assert/strict";
import { STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "./strategic-cells";
import { biaBusinessTypeCode, biaBusinessTypeLabel, biaBusinessTypeStoragePayload } from "./bia-business-type";
import { validateBiaDraft } from "../server/bia-workflow";

test("BIA: as treze teses substituem objetivo com ida/volta canônica e rótulos sem pontos",()=>{
  for(const [,code,,label] of STRATEGIC_CELL_BUSINESS_TYPES) {
    const input={nome_bia:"Teste",moeda:"BRL",business_type_code:code,objetivo_alianca:"Renda"};
    const storage=biaBusinessTypeStoragePayload(input);
    assert.equal(storage.objetivo_alianca,code);
    assert.equal(storage.business_type_code,undefined,"não envia coluna inexistente ao Directus");
    assert.equal(biaBusinessTypeCode(storage),code);
    assert.equal(biaBusinessTypeLabel(storage),formatBusinessThesisLabel(label));
    const draft=validateBiaDraft(input);
    assert.equal(draft.business_type_code,code);assert.equal(draft.objetivo_alianca,code);
    assert.equal(biaBusinessTypeLabel(draft),formatBusinessThesisLabel(label));
    assert.equal(input.objetivo_alianca,"Renda","não modifica entrada/histórico");
  }
});

test("BIA: dados legados e alterações parciais são preservados sem inventar equivalência",()=>{
  for(const value of ["Renda","Venda","Operação","renda","venda","operacao"]) {
    assert.equal(biaBusinessTypeCode({objetivo_alianca:value}),"");
    assert.equal(biaBusinessTypeLabel({objetivo_alianca:value}),value);
    assert.deepEqual(biaBusinessTypeStoragePayload({objetivo_alianca:value}),{objetivo_alianca:value});
  }
  assert.deepEqual(biaBusinessTypeStoragePayload({nome_bia:"Novo nome"}),{nome_bia:"Novo nome"});
  assert.equal(biaBusinessTypeStoragePayload({business_type_code:"",objetivo_alianca:"Renda"}).objetivo_alianca,null);
  assert.equal(biaBusinessTypeLabel({}),"");
  for(const value of ["INVALID","REAL_ESTATE_AUCTIONS",{},false,12,null]) {
    assert.throws(()=>biaBusinessTypeStoragePayload({business_type_code:value}),/tipo de negócio/);
  }
});
