import test from "node:test";
import assert from "node:assert/strict";
import { biaHasSalesThesis } from "./bia-sales-analysis";
import { STRATEGIC_CELL_BUSINESS_TYPES } from "./strategic-cells";

test("Análises só se aplica às teses com venda, incluindo venda ou locação", () => {
  const excluded = new Set(["BUY_AND_HOLD", "SHORT_STAY", "BUILD_TO_RENT", "HOSPITALITY_OPERATION", "OPERATION_RESTRUCTURING"]);
  for (const [, code] of STRATEGIC_CELL_BUSINESS_TYPES) {
    assert.equal(biaHasSalesThesis({business_type_code: code}), !excluded.has(code), code);
    assert.equal(biaHasSalesThesis({objetivo_alianca: code}), !excluded.has(code), code);
  }
});
test("tese atual prevalece sobre objetivo legado; ausência e legado ambíguo não habilitam Análises", () => {
  assert.equal(biaHasSalesThesis({business_type_code:"SHORT_STAY", objetivo_alianca:"Venda"}), false);
  for (const value of ["Venda", "venda", "BUILD_TO_SELL", "OFF_PLAN_RESALE"]) assert.equal(biaHasSalesThesis({objetivo_alianca:value}), true);
  for (const value of ["Renda", "Operação", "REAL_ESTATE_AUCTIONS", "HORIZONTAL_DEVELOPMENT", "", null]) assert.equal(biaHasSalesThesis({objetivo_alianca:value}), false);
  assert.equal(biaHasSalesThesis(), false);
});
