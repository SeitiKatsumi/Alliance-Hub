import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIA_DESTINACOES, BIA_OBJETIVOS, CURRENCIES } from "./bia-form-options";
import { validateBiaDraft } from "../server/bia-workflow";

test("criação e edição preservam opções anteriores de destinação, objetivo e moeda",()=>{
  assert.deepEqual(BIA_DESTINACOES,["Residencial","Comercial","Industrial","Misto","Hospedagem","Rural"]);
  assert.deepEqual(BIA_OBJETIVOS,["Renda","Venda","Operação"]);
  for(const currency of CURRENCIES) {
    assert.equal(validateBiaDraft({nome_bia:"Teste",moeda:currency.code,destinacao:"Rural",objetivo_alianca:"Renda"}).moeda,currency.code);
  }
  assert.throws(()=>validateBiaDraft({nome_bia:"Teste",moeda:"BRL",destinacao:"Outra"}),/destinação/);
  assert.throws(()=>validateBiaDraft({nome_bia:"Teste",moeda:"BRL",latitude:91}),/Localização/);
  assert.equal(validateBiaDraft({nome_bia:"Teste",moeda:"BRL",latitude:0,longitude:0}).latitude,0);
  for(const file of ["bias","bia-nova"]) {
    const source=readFileSync(new URL("../client/src/pages/"+file+".tsx",import.meta.url),"utf8");
    assert.match(source,/BIA_DESTINACOES\.map/);
    assert.match(source,/BIA_OBJETIVOS\.map/);
    assert.match(source,/<CurrencyCombobox/);
    assert.match(source,/<LocationPickerModal/);
  }
});
