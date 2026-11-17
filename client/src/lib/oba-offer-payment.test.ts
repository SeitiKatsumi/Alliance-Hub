import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quotePaymentShare, type PlannedPayment } from "../../../shared/bia-payment-plan";
import { paymentsPerQuota } from "./oba-offer-payment";

const schedule: PlannedPayment[] = [
  { mes: "2026-12", bloco: "Entrada", centavos: 80_000_00 },
  { mes: "2027-01", bloco: "Saldo", centavos: 8_625_00 },
  { mes: "2027-02", bloco: "Saldo", centavos: 8_821_23 },
];
const group = { id: "group", numero: 4, quantidade: 2, tipo: "guardiao" as const, pagamentos: quotePaymentShare(schedule, 8, 3, 2) };
const single = { ...group, id: "single", numero: 6, quantidade: 1, pagamentos: quotePaymentShare(schedule, 8, 5, 1) };

test("offer shows per-unit cents without treating a multi-quota position as a single quota", () => {
  assert.deepEqual(paymentsPerQuota([group, single]), [
    { mes: "2026-12", bloco: "Entrada", min: 1_000_000, max: 1_000_000 },
    { mes: "2027-01", bloco: "Saldo", min: 107_812, max: 107_813 },
    { mes: "2027-02", bloco: "Saldo", min: 110_265, max: 110_266 },
  ]);
  assert.deepEqual(paymentsPerQuota([{ ...group, pagamentos: [] }]), []);
  assert.deepEqual(paymentsPerQuota([]), []);
});

test("offer keeps selection in the interest dialog without the old position dropdown", () => {
  const source = readFileSync(new URL("../components/oba-offer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Cota disponível<select|<select\b/);
  const dialog = source.slice(source.indexOf("<DialogContent"));
  assert.match(dialog, /<ObaQuotaAvailability[\s\S]*onToggle=/);
  assert.match(source, /onToggle=\{canApply && acquisition \? openInterest : undefined\}/);
});
