import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROPERTY_THESIS_OPTIONS, propertyThesisCode, propertyThesisLabel, propertyThesisOptions, validatePropertyGoal } from "./property-thesis";
import { STRATEGIC_CELL_BUSINESS_TYPES } from "./strategic-cells";
import { normalizeInitialPropertyJourney, normalizePropertyIntent, propertyIntentSpecialties } from "../server/property-journey";
test("every official thesis survives journey normalization and drives professional matching", () => {
  assert.deepEqual(PROPERTY_THESIS_OPTIONS.slice(1).map(x=>x[0]),STRATEGIC_CELL_BUSINESS_TYPES.map(x=>x[1]));
  for(const [,code] of STRATEGIC_CELL_BUSINESS_TYPES) {
    assert.equal(normalizePropertyIntent(code),code);
    assert.equal(validatePropertyGoal(code),code);
    assert.equal(normalizeInitialPropertyJourney({path:"imovel",intencao:code})?.intencao,code);
    assert.ok(propertyIntentSpecialties(code).length);
    assert.notEqual(propertyThesisLabel(code),"Tese não definida");
  }
});
test("management and legacy goals never guess a thesis; invalid goals fail",()=>{
  assert.equal(propertyThesisCode("alugar"),"");
  assert.equal(validatePropertyGoal("alugar"),"alugar");
  assert.equal(validatePropertyGoal("gerir"),"gerir");
  assert.equal(propertyThesisOptions("alugar").at(-1)?.[0],"alugar");
  assert.equal(propertyThesisOptions().some(x=>x[0]==="alugar"),false);
  for(const value of ["bad",null,{},"toString","__proto__"])assert.throws(()=>validatePropertyGoal(value));
});
test("UI, completed property, pulse and BIA origin reuse official thesis",()=>{
  const source=readFileSync("server/routes.ts","utf8");
  assert.match(source,/draft.objetivo = draft.intencao/);
  assert.match(source,/objetivo: validatePropertyGoal\(body.objetivo/);
  assert.match(source,/objetivo_alianca: propertyThesisCode\(access.imovel.objetivo\)/);
  assert.match(source,/Tese: \$\{propertyThesisLabel\(entrada.objetivo\)\}/);
  for(const path of ["client/src/pages/carteira.tsx","client/src/pages/carteira-assistente.tsx","client/src/pages/login.tsx"])assert.match(readFileSync(path,"utf8"),/@shared\/property-thesis/);
});

test("cadastro de imóvel não oferece troca para oportunidade",()=>{
 const source=readFileSync("client/src/pages/carteira-assistente.tsx","utf8");
 assert.doesNotMatch(source,/É meu imóvel|setJourneyUrl\(\{ path: "oportunidade"/);
 assert.match(source,/params.get\("path"\) === "oportunidade" \? "oportunidade" : "imovel"/);
});
