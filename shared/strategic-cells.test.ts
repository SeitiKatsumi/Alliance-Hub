import assert from "node:assert/strict";
import test from "node:test";
import {
  STRATEGIC_CELL_BUSINESS_TYPES,
  STRATEGIC_CELL_TYPES,
  getBusinessTypesForStrategicCell,
  normalizeStrategicCellPreferences,
} from "./strategic-cells";

test("mantém as seis Células e os 22 Tipos de Negócio canônicos", () => {
  assert.equal(STRATEGIC_CELL_TYPES.length, 6);
  assert.equal(STRATEGIC_CELL_BUSINESS_TYPES.length, 22);
  assert.deepEqual(getBusinessTypesForStrategicCell("INVESTMENT_CAPITAL").map((item) => item.code), ["CO_INVESTMENT", "REAL_ESTATE_DEBT"]);
  const normalized = normalizeStrategicCellPreferences(
    ["VALUE_RESALE", "INVALID"],
    ["FLIPPING", "REAL_ESTATE_DEBT", "BUY_AND_HOLD", "CLUB_DEAL"],
  );
  assert.deepEqual(normalized.cellTypeCodes, ["VALUE_RESALE", "INVESTMENT_CAPITAL", "REAL_ESTATE_INCOME"]);
  assert.deepEqual(normalized.businessTypeCodes, ["FLIPPING", "REAL_ESTATE_DEBT", "BUY_AND_HOLD"]);
  assert.deepEqual(normalizeStrategicCellPreferences(["VALUE_RESALE"], []).cellTypeCodes, []);
});
