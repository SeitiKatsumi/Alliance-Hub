import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverPaymentReminder,
  isPaymentReminderCandidate,
  paymentReminderRecipient,
  paymentReminderTargetDate,
  type PaymentReminderItem,
} from "./payment-reminders";

const scheduledPayment: PaymentReminderItem = {
  id: "flow-1",
  tipo: "saída",
  status: "agendado",
  data_vencimento: "2027-01-01",
  membro_responsavel: { id: "member-1", nome: "Responsável", email: "responsavel@example.com" },
  bia: {
    id: "bia-1",
    diretor_capital: { id: "director-1", nome: "Diretor", email: "diretor@example.com" },
  },
};

test("calcula dois dias corridos no calendario de Sao Paulo", () => {
  assert.equal(paymentReminderTargetDate(new Date("2026-12-30T15:00:00Z")), "2027-01-01");
});

test("seleciona somente saida agendada com vencimento na data alvo", () => {
  assert.equal(isPaymentReminderCandidate(scheduledPayment, "2027-01-01"), true);
  assert.equal(isPaymentReminderCandidate({ ...scheduledPayment, status: "pendente" }, "2027-01-01"), false);
  assert.equal(isPaymentReminderCandidate({ ...scheduledPayment, tipo: "entrada" }, "2027-01-01"), false);
  assert.equal(isPaymentReminderCandidate({ ...scheduledPayment, data_vencimento: "2027-01-02" }, "2027-01-01"), false);
});

test("prioriza o responsavel e usa o Diretor de Capital como fallback", () => {
  assert.equal(paymentReminderRecipient(scheduledPayment)?.source, "responsavel");
  assert.deepEqual(
    paymentReminderRecipient({ ...scheduledPayment, membro_responsavel: null }),
    { id: "director-1", nome: "Diretor", email: "diretor@example.com", source: "diretor_capital" },
  );
});

test("nao reenvia reserva duplicada e libera falha para retentativa", async () => {
  let sends = 0;
  assert.equal(await deliverPaymentReminder({
    reserve: async () => null,
    send: async () => { sends += 1; return { ok: true }; },
    markSent: async () => undefined,
    release: async () => undefined,
  }), "duplicate");
  assert.equal(sends, 0);

  let released = "";
  assert.equal(await deliverPaymentReminder({
    reserve: async () => "reservation-1",
    send: async () => ({ ok: false }),
    markSent: async () => undefined,
    release: async (id) => { released = id; },
  }), "retry");
  assert.equal(released, "reservation-1");

  let marked = "";
  assert.equal(await deliverPaymentReminder({
    reserve: async () => "reservation-2",
    send: async () => ({ ok: true }),
    markSent: async (id) => { marked = id; },
    release: async () => undefined,
  }), "sent");
  assert.equal(marked, "reservation-2");
});
