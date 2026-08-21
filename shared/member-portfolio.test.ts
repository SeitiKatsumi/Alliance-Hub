import test from "node:test";
import assert from "node:assert/strict";
import { calculateMap, calculatePortfolioTotals, isMembershipActive, membershipEndsAt, normalizeFinancingInstallments } from "./member-portfolio";

test("cancelamento preserva acesso ate o fim da vigencia", () => {
  const startsAt = new Date("2026-08-21T00:00:00Z");
  const endsAt = membershipEndsAt(startsAt);
  assert.equal(endsAt.toISOString(), "2027-08-21T00:00:00.000Z");
  assert.equal(isMembershipActive({ status: "canceled", starts_at: startsAt, ends_at: endsAt }, new Date("2027-01-01T00:00:00Z")), true);
  assert.equal(isMembershipActive({ status: "refunded", starts_at: startsAt, ends_at: endsAt }, new Date("2027-01-01T00:00:00Z")), false);
});

test("MAP considera aportes e transferencias aceitas sem criar valor", () => {
  const rows = calculateMap(
    [{ memberId: "a", value: 800 }, { memberId: "b", value: 200 }],
    [{ status: "aceita", fromMemberId: "a", toMemberId: "b", value: 300 }],
  );
  assert.equal(rows.find((row) => row.memberId === "a")?.percent, 50);
  assert.equal(rows.find((row) => row.memberId === "b")?.percent, 50);
});

test("patrimonio soma imoveis liquidos e apenas participacoes confirmadas", () => {
  const result = calculatePortfolioTotals(
    [{ acquisitionValue: 100, currentValue: 140, debt: 20, liquidity: "baixa" }],
    [{ invested: 30, participationValue: 50 }, { invested: 10, participationValue: null }],
  );
  assert.equal(result.netWorth, 170);
  assert.equal(result.allianceInvested, 40);
  assert.equal(result.lowLiquidityPercent, (140 / 170) * 100);
});

test("patrimonio considera somente a fracao do imovel pertencente ao usuario", () => {
  const result = calculatePortfolioTotals(
    [{ acquisitionValue: 200, currentValue: 300, debt: 40, ownershipPercent: 30 }],
    [],
  );
  assert.equal(result.acquisitionValue, 60);
  assert.equal(result.propertyCurrentValue, 90);
  assert.equal(result.debt, 12);
  assert.equal(result.netWorth, 78);
});

test("importacao de financiamento descarta parcelas invalidas e normaliza o status", () => {
  assert.deepEqual(normalizeFinancingInstallments([
    { parcela: 2, valor: 1500, data_vencimento: "2026-09-10", status: "agendado" },
    { parcela: 3, valor: 0, data_vencimento: "2026-10-10" },
  ]), [{ parcela: 2, valor: 1500, data: "2026-09-10", status: "agendado" }]);
});
