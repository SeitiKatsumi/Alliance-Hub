import assert from "node:assert/strict";
import test from "node:test";
import {
  BIA_GOVERNANCE_MONTHLY_CENTS,
  COMPANY_ANNUAL_PRICE_CENTS,
  COMPANY_UPGRADE_PRICE_CENTS,
  calculateRigCents,
  companyCheckoutAmount,
  governanceCompetences,
  governanceStartsAt,
  renewalAfterFreeze,
} from "./monetization";

test("cobra somente vinte por cento no upgrade e o valor integral na nova adesao", () => {
  assert.equal(COMPANY_ANNUAL_PRICE_CENTS, 383_640);
  assert.equal(COMPANY_UPGRADE_PRICE_CENTS, 63_940);
  assert.equal(companyCheckoutAmount(true), 63_940);
  assert.equal(companyCheckoutAmount(false), 383_640);
});

test("RIG usa valor numerico e rejeita percentual abaixo de um por cento", () => {
  assert.equal(calculateRigCents(1_000_000, 0.01), 1_000_000);
  assert.equal(calculateRigCents(1_000_000, 0.0099), null);
  assert.equal(calculateRigCents("invalido", 0.01), null);
});

test("governanca comeca no mes 25 sem rateio diario", () => {
  const start = new Date("2026-08-27T18:30:00.000Z");
  assert.equal(governanceStartsAt(start).toISOString(), "2028-08-27T18:30:00.000Z");
  assert.deepEqual(governanceCompetences(start, new Date("2028-10-02T00:00:00.000Z")), ["2028-08", "2028-09", "2028-10"]);
  assert.equal(BIA_GOVERNANCE_MONTHLY_CENTS, 60_000);
});

test("retomar prazo desloca a renovacao pelo tempo congelado", () => {
  const renewal = new Date("2027-08-01T00:00:00.000Z");
  const frozen = new Date("2026-08-01T00:00:00.000Z");
  const resumed = new Date("2026-08-11T00:00:00.000Z");
  assert.equal(renewalAfterFreeze(renewal, frozen, resumed).toISOString(), "2027-08-11T00:00:00.000Z");
  assert.throws(() => renewalAfterFreeze(renewal, resumed, frozen), /inválido/);
});
