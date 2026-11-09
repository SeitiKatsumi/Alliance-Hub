import test from "node:test";
import assert from "node:assert/strict";
import { EXTERNAL_BANKS, bankMoneyCents, matchBankReceipt, type ReceiptFlow, type BankReceipt } from "./external-banking";
const receipt: BankReceipt = { id: "r", bankTransactionId: "bank-r", amountCents: 10000, currency: "BRL", receivedAt: "2026-11-09T12:00:00Z", status: "settled", description: "Pix", payerDocument: "11111111111" };
const flow: ReceiptFlow = { id: "f", biaId: "bia", type: "entrada", status: "agendado", amountCents: 10000, currency: "BRL", date: "2026-11-09", description: "Aporte", payerDocument: "111.111.111-11", cash: true, protected: false, activeCharge: false };
test("catálogo contém os11bancos e centavos nunca são truncados", () => {
  assert.equal(EXTERNAL_BANKS.length, 11); assert.equal(new Set(EXTERNAL_BANKS.map(b => b.code)).size, 11);
  assert.equal(bankMoneyCents("100.01"), 10001);
  for (const v of ["100,01", "1.001", NaN, Infinity, "", null, true]) assert.throws(() => bankMoneyCents(v));
});
test("baixa automática exige evidência forte e candidato único, não apenas valor/nome", () => {
  assert.equal(matchBankReceipt(receipt, [flow], "bia")[0].automatic, true);
  for (const facts of [{ payerDocument: "", payerName: "Maria" }, { payerDocument: "***111" }, { payerDocument: "22222222222" }]) {
    assert.equal(matchBankReceipt({ ...receipt, ...facts }, [flow], "bia")[0].automatic, false);
  }
  assert.ok(matchBankReceipt(receipt, [flow, { ...flow, id: "f2" }], "bia").every(c => !c.automatic));
  assert.equal(matchBankReceipt({ ...receipt, payerDocument: "", reference: "known" }, [{ ...flow, reference: "known" }], "bia")[0].automatic, true);
});
test("diferenças, terceiro, cobrança ativa e pagamento parcial só sugerem; estados incompatíveis não conciliam", () => {
  for (const amountCents of [9999, 10001, 9900, 5000]) {
    const c = matchBankReceipt({ ...receipt, amountCents }, [flow], "bia")[0]; assert.ok(c); assert.equal(c.automatic, false); assert.notEqual(c.differenceCents, 0);
  }
  assert.equal(matchBankReceipt(receipt, [{ ...flow, activeCharge: true }], "bia")[0].conflict, true);
  for (const patch of [{ cash: false }, { protected: true }, { status: "pago" }, { status: "cancelado" }, { type: "saída" }, { currency: "USD" }, { biaId: "outra" }]) assert.deepEqual(matchBankReceipt(receipt, [{ ...flow, ...patch }], "bia"), []);
  for (const status of ["pending", "reversed"] as const) assert.deepEqual(matchBankReceipt({ ...receipt, status }, [flow], "bia"), []);
});
