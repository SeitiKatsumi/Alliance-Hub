import assert from "node:assert/strict";
import test from "node:test";
import {
  isProtectedValorOrigemEntry,
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
    status: "agendado",
  };
  const desired = [
    { descricao: "Valor de Origem da BIA - Parcela 1/3", tipo: "saida" },
    { descricao: "Valor de Origem da BIA - Parcela 2/3", tipo: "saida" },
    { descricao: "Valor de Origem da BIA - Parcela 3/3", tipo: "saida" },
  ];

  const result = reconcileValorOrigemEntries([paid, pending], desired);

  assert.deepEqual(result.preserved.map((entry) => entry.id), ["paid-1"]);
  assert.deepEqual(result.replaceable.map((entry) => entry.id), ["pending-2"]);
  assert.deepEqual(result.toCreate.map((entry) => entry.descricao), [
    "Valor de Origem da BIA - Parcela 2/3",
    "Valor de Origem da BIA - Parcela 3/3",
  ]);
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
