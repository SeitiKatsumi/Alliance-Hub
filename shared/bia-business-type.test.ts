import test from "node:test";
import assert from "node:assert/strict";
import { STRATEGIC_CELL_BUSINESS_TYPES, formatBusinessThesisLabel } from "./strategic-cells";
import { biaBusinessTypeCode, biaBusinessTypeLabel, biaBusinessTypeStoragePayload, buildBiaThesisAllocation, opportunityScopeLabel } from "./bia-business-type";
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

test("alocação agrupa pela tese canônica e conserva o investimento sem classificar objetivos legados", () => {
  const rows = buildBiaThesisAllocation([
    { business_type_code: "SHORT_STAY", objetivo_alianca: "Venda", invested: 300 },
    { objetivo_alianca: "SHORT_STAY", invested: 100 },
    { business_type_code: "FLIPPING", objetivo_alianca: "Renda", invested: 200 },
    { objetivo_alianca: "Renda", invested: 150 },
    { objetivo_alianca: "Venda", invested: 100 },
    { objetivo_alianca: "Operação", invested: 50 },
    { invested: 100 },
    { business_type_code: "SHORT_STAY", invested: NaN },
    { business_type_code: "FLIPPING", invested: 0 },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows.find(row => row.name === "Explorar locação por temporada")?.value, 400);
  assert.equal(rows.find(row => row.name === "Tese não definida")?.value, 400);
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), 1000);
  assert.equal(rows.reduce((sum, row) => sum + row.percent, 0), 100);
  assert.ok(rows.every(row => !["Renda", "Venda", "Operação"].includes(row.name)));
  assert.deepEqual(buildBiaThesisAllocation([]), []);
  assert.equal(buildBiaThesisAllocation(STRATEGIC_CELL_BUSINESS_TYPES.map(([, code]) => ({business_type_code: code, invested: 1}))).length, 13);
});

test("tese explícita prevalece; ausência não transforma texto livre de OBA em tese de BIA", () => {
  assert.equal(biaBusinessTypeCode({business_type_code: "invalid", objetivo_alianca: "SHORT_STAY"}), "SHORT_STAY");
  assert.equal(biaBusinessTypeLabel({objetivo_alianca: "Selecionar parceiro de capital"}), "");
  assert.equal(opportunityScopeLabel({objetivo_alianca: "Selecionar parceiro de capital"}), "Selecionar parceiro de capital");
  assert.equal(opportunityScopeLabel({objetivo_alianca: "SHORT_STAY"}), "Explorar locação por temporada");
});

test("BIA: dados legados e alterações parciais são preservados sem inventar equivalência",()=>{
  for(const value of ["Renda","Venda","Operação","renda","venda","operacao"]) {
    assert.equal(biaBusinessTypeCode({objetivo_alianca:value}),"");
    assert.equal(biaBusinessTypeLabel({objetivo_alianca:value}),"");
    assert.deepEqual(biaBusinessTypeStoragePayload({objetivo_alianca:value}),{objetivo_alianca:value});
  }
  assert.deepEqual(biaBusinessTypeStoragePayload({nome_bia:"Novo nome"}),{nome_bia:"Novo nome"});
  assert.equal(biaBusinessTypeStoragePayload({business_type_code:"",objetivo_alianca:"Renda"}).objetivo_alianca,null);
  assert.equal(biaBusinessTypeLabel({}),"");
  for(const value of ["INVALID","REAL_ESTATE_AUCTIONS",{},false,12,null]) {
    assert.throws(()=>biaBusinessTypeStoragePayload({business_type_code:value}),/tese de interesse/);
  }
});
