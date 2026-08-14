import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProtectedValorOrigemEntriesUnchanged,
  isProtectedValorOrigemEntry,
  protectedValorOrigemSnapshot,
  reconcileValorOrigemEntries,
} from "./valor-origem-sync";

test("preserva lancamentos pagos, parciais, cancelados e com comprovante", () => {
  assert.equal(isProtectedValorOrigemEntry({ status: "pago" }), true);
  assert.equal(isProtectedValorOrigemEntry({ status: "parcial" }), true);
  assert.equal(isProtectedValorOrigemEntry({ status: "cancelado" }), true);
  assert.equal(isProtectedValorOrigemEntry({ status: "agendado", Anexos: [{ id: "file-1" }] }), true);
  assert.equal(isProtectedValorOrigemEntry({ status: "pendente", pagamento_id: "charge-1" }), true);
});

test("permite substituir somente lancamentos pendentes sem evidencia de pagamento", () => {
  assert.equal(isProtectedValorOrigemEntry({ status: "pendente", Anexos: [] }), false);
  assert.equal(isProtectedValorOrigemEntry({ status: "agendado", data_pagamento: null }), false);
  assert.equal(isProtectedValorOrigemEntry({ status: "vencido" }), false);
});

test("nao recria uma parcela validada e remove apenas a versao pendente", () => {
  const paid = {
    id: "paid-1",
    descricao: "Valor de Origem da BIA - Parcela 1/3",
    tipo: "saida",
    status: "pago",
  };
  const pending = {
    id: "pending-2",
    descricao: "Valor de Origem da BIA - Parcela 2/3",
    tipo: "saida",
    valor: "200.00",
    status: "agendado",
  };
  const desired = [
    { descricao: "Valor de Origem da BIA - Parcela 1/3", tipo: "saida", valor: "100.00" },
    { descricao: "Valor de Origem da BIA - Parcela 2/3", tipo: "saida", valor: "250.00" },
    { descricao: "Valor de Origem da BIA - Parcela 3/3", tipo: "saida", valor: "300.00" },
  ];

  const result = reconcileValorOrigemEntries([paid, pending], desired);

  assert.deepEqual(result.preserved.map((entry) => entry.id), ["paid-1"]);
  assert.deepEqual(result.replaceable.map((entry) => entry.id), ["pending-2"]);
  assert.deepEqual(result.toCreate.map((entry) => entry.descricao), [
    "Valor de Origem da BIA - Parcela 2/3",
    "Valor de Origem da BIA - Parcela 3/3",
  ]);
});

test("mantem lancamento pendente quando o cronograma nao mudou", () => {
  const pending = {
    id: "pending-1",
    descricao: "Valor de Origem da BIA - Parcela 1/2",
    tipo: "saida",
    valor: "500.00",
    status: "agendado",
    data_vencimento: "2026-09-10",
  };
  const desired = [{
    descricao: "Valor de Origem da BIA - Parcela 1/2",
    tipo: "saida",
    valor: "500",
    data_vencimento: "2026-09-10",
  }];

  const result = reconcileValorOrigemEntries([pending], desired);
  assert.deepEqual(result.retained.map((entry) => entry.id), ["pending-1"]);
  assert.equal(result.replaceable.length, 0);
  assert.equal(result.toCreate.length, 0);
});

test("lancamento cancelado permanece no historico sem bloquear nova parcela", () => {
  const cancelled = {
    id: "cancelled-1",
    descricao: "Valor de Origem da BIA - Parcela 1/1",
    tipo: "saida",
    valor: "500.00",
    status: "cancelado",
  };
  const desired = [{
    descricao: "Valor de Origem da BIA - Parcela 1/1",
    tipo: "saida",
    valor: "500.00",
  }];

  const result = reconcileValorOrigemEntries([cancelled], desired);
  assert.deepEqual(result.archived.map((entry) => entry.id), ["cancelled-1"]);
  assert.equal(result.toCreate.length, 1);
  assert.equal(result.replaceable.length, 0);
});

test("detecta remocao ou alteracao de lancamento financeiro protegido", () => {
  const paid = {
    id: "paid-1",
    descricao: "Valor de Origem da BIA - Parcela 1/1",
    tipo: "saida",
    valor: "500.00",
    status: "pago",
    data_pagamento: "2026-08-01",
  };
  const snapshot = protectedValorOrigemSnapshot([paid]);

  assert.doesNotThrow(() => assertProtectedValorOrigemEntriesUnchanged(snapshot, [{ ...paid }]));
  assert.throws(
    () => assertProtectedValorOrigemEntriesUnchanged(snapshot, []),
    /protegido removido/,
  );
  assert.throws(
    () => assertProtectedValorOrigemEntriesUnchanged(snapshot, [{ ...paid, valor: "499.00" }]),
    /protegido alterado/,
  );
});

test("distingue contribuidores do DM pelo favorecido", () => {
  const existing = [{
    id: "paid-aliado",
    descricao: "Divisor Multiplicador - Parcela 1/1",
    tipo: "saida",
    status: "pago",
    favorecido_id: { id: "aliado" },
    Categoria: [{ categorias_id: { id: "categoria-aliado" } }],
  }];
  const desired = [
    {
      descricao: "Divisor Multiplicador - Parcela 1/1",
      tipo: "saida",
      favorecido_id: "aliado",
      Categoria: [{ categorias_id: "categoria-aliado" }],
    },
    {
      descricao: "Divisor Multiplicador - Parcela 1/1",
      tipo: "saida",
      favorecido_id: "diretor",
      Categoria: [{ categorias_id: "categoria-diretor" }],
    },
  ];

  const result = reconcileValorOrigemEntries(existing, desired);
  assert.equal(result.toCreate.length, 1);
  assert.equal(result.toCreate[0].favorecido_id, "diretor");
});
