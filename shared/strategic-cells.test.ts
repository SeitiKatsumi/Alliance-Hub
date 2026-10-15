import assert from "node:assert/strict";
import test from "node:test";
import {
  STRATEGIC_CELL_BUSINESS_TYPES,
  STRATEGIC_CELL_TYPES,
  getBusinessTypesForStrategicCell,
  normalizeStrategicCellPreferences,
  getRetiredBusinessTypes,
  formatBusinessThesisLabel,
} from "./strategic-cells";

test("oferece cinco Células e 13 teses sem perder preferências legadas", () => {
  assert.equal(STRATEGIC_CELL_TYPES.length, 5);
  assert.equal(STRATEGIC_CELL_BUSINESS_TYPES.length, 13);
  assert.deepEqual(getBusinessTypesForStrategicCell("INVESTMENT_CAPITAL"), []);
  assert.deepEqual(STRATEGIC_CELL_TYPES.map((cell) => getBusinessTypesForStrategicCell(cell.code).length), [3, 2, 3, 3, 2]);
  assert.equal(getBusinessTypesForStrategicCell("REAL_ESTATE_DEVELOPMENT").some((item) => item.code === "BUILD_TO_RENT"), true);
  const normalized = normalizeStrategicCellPreferences(
    ["VALUE_RESALE", "INVALID"],
    ["FLIPPING", "REAL_ESTATE_DEBT", "BUY_AND_HOLD", "CLUB_DEAL"],
  );
  assert.deepEqual(normalized.cellTypeCodes, ["VALUE_RESALE", "INVESTMENT_CAPITAL", "REAL_ESTATE_INCOME"]);
  assert.deepEqual(normalized.businessTypeCodes, ["FLIPPING", "REAL_ESTATE_DEBT", "BUY_AND_HOLD"]);
  assert.deepEqual(normalizeStrategicCellPreferences(["VALUE_RESALE"], []).cellTypeCodes, []);
});

test("rótulos das teses não exibem pontos, inclusive na explicação entre parênteses", () => {
  for (const [, , , label] of STRATEGIC_CELL_BUSINESS_TYPES) assert.ok(!formatBusinessThesisLabel(label).includes("."));
  assert.equal(formatBusinessThesisLabel("Desenvolver imóveis para venda. (Inclui o caso de construir uma casa para vender.)"), "Desenvolver imóveis para venda (Inclui o caso de construir uma casa para vender)");
});

test("preserva escolhas antigas sem inventar equivalências e deriva desenvolvimento para locação", () => {
  assert.deepEqual(normalizeStrategicCellPreferences([], ["REAL_ESTATE_AUCTIONS", "BUILD_TO_RENT"]), {
    cellTypeCodes: ["VALUE_RESALE", "REAL_ESTATE_DEVELOPMENT"],
    businessTypeCodes: ["REAL_ESTATE_AUCTIONS", "BUILD_TO_RENT"],
  });
  assert.deepEqual(getRetiredBusinessTypes(["REAL_ESTATE_AUCTIONS", "FLIPPING"]).map((item) => item.code), ["REAL_ESTATE_AUCTIONS"]);
  assert.equal(new Set(STRATEGIC_CELL_BUSINESS_TYPES.map(([, code]) => code)).size, 13);
});
