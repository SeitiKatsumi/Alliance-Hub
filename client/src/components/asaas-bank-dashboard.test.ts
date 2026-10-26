import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BankDashboardView, BankHistory, readBankDashboardRequest } from "./asaas-bank-dashboard";
import type { BankDashboardData } from "../../../shared/asaas-dashboard";

const fixture = (): BankDashboardData => ({
  environment: "sandbox", scope: "bia_account", checkedAt: "2026-10-26T12:00:00Z", from: "2026-09-27", to: "2026-10-26", balance: 123.45, balanceError: null,
  payments: { available: true, complete: true, totalCount: 0, items: [], error: null },
  transfers: { available: true, complete: true, totalCount: 0, items: [], error: null },
});
test("painel mostra escopo, saldo, grupos, período e estado vazio sem operação automática", () => {
  const html = renderToStaticMarkup(React.createElement(BankDashboardView, { data: fixture() }));
  for (const label of ["Saldo disponível da BIA", "123,45", "Cobranças geradas", "Transferências solicitadas", "Concluídas", "Vencidas", "Subconta exclusiva desta BIA", "Nenhum registro gerado no período", "não substituem o extrato completo"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Confirmar transferência|href=/);
  const capital = readFileSync(new URL("../pages/nucleo-capital.tsx", import.meta.url), "utf8");
  assert.match(capital, /Histórico anterior da BIA/);
  assert.doesNotMatch(capital, /<CardTitle>Histórico de cobranças<\/CardTitle>/);
});
test("indisponibilidade não vira zero e leitura parcial permanece explícita", () => {
  const data = fixture(); data.balance = null; data.balanceError = "Saldo indisponível";
  data.payments.available = false; data.payments.complete = false; data.payments.error = "Falha na consulta";
  const html = renderToStaticMarkup(React.createElement(BankDashboardView, { data }));
  assert.match(html, /Indisponível/); assert.match(html, /Falha na consulta/); assert.match(html, /Histórico indisponível/);
  assert.doesNotMatch(html, /Nenhum registro gerado no período/);
});
test("histórico traduz situação e datas, escapa conteúdo e restringe links", () => {
  const data = fixture().transfers;
  data.items = [{ id: "<script>teste", status: "DONE", value: 12.3, createdAt: "2026-10-01", dueDate: null, paidAt: "2026-10-02", method: "PIX", netValue: null, receiptUrl: "https://www.asaas.com/receipt/test", invoiceUrl: "javascript:alert(1)" }];
  const html = renderToStaticMarkup(React.createElement(BankHistory, { data, kind: "transfers" }));
  assert.match(html, /Concluída/); assert.match(html, /01\/10\/2026/); assert.match(html, /02\/10\/2026/);
  assert.match(html, /Comprovante/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /javascript:|<script>/);
  const source = readFileSync(new URL("./asaas-bank-dashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /sm:grid-cols-2 xl:grid-cols-4/); assert.match(source, /queryKey: \[url, "dashboard", period\]/);
  assert.doesNotMatch(source, /method: "POST"|refetchInterval/);
});

test("consulta funciona sem AbortSignal.any e cancela ao trocar de período", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => { assert.equal(options?.credentials, "include"); assert.equal(options?.cache, "no-store"); assert.ok(options?.signal); return Response.json(fixture()); };
    assert.equal((await readBankDashboardRequest("/fixture", new AbortController().signal)).balance, 123.45);
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    const controller = new AbortController();
    const request = readBankDashboardRequest("/fixture", controller.signal);
    controller.abort();
    await assert.rejects(request, /aborted/);
  } finally { globalThis.fetch = original; }
});
