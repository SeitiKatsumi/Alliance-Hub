import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { BankAccountChoice, BiaBanking } from "./bia-banking";

test("conta Asaas aprovada abre o painel mesmo quando a consulta da escolha falha", () => {
  const cache = new QueryClient(), base = "/api/bias/bia/banco";
  const render = () => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: cache },
    React.createElement(BiaBanking, { biaId: "bia", canEdit: true, children: "Painel da conta" })));
  cache.setQueryData([base + "/asaas/status"], { account: { state: "approved" } });
  cache.getQueryCache().build(cache, { queryKey: [base + "/externo/status"] }).setState({ status: "error", error: new Error("Indisponível") });
  assert.match(render(), /Painel da conta/);
  assert.doesNotMatch(render(), /Escolha como usar|Não foi possível consultar a escolha|Tentar novamente/);
  cache.setQueryData([base + "/asaas/status"], { account: null });
  assert.match(render(), /Escolha como usar/);
  cache.clear();
});
test("escolha unificada diferencia conta BaaS de conexão externa e permite apenas consultar sem edição", () => {
  for (const value of ["asaas", "external"] as const) {
    const html = renderToStaticMarkup(React.createElement(BankAccountChoice, { value, onChange: () => {}, disabled: true }));
    assert.match(html, /Asaas — conta integrada/); assert.match(html, /BaaS/); assert.match(html, /Outra conta bancária/);
    assert.match(html, /dinheiro permanece/); assert.match(html, /<fieldset[^>]*disabled/);
    assert.equal((html.match(/type="radio"/g) || []).length, 2);
    assert.match(html, new RegExp(`<input(?=[^>]*checked="")(?=[^>]*value="${value}")[^>]*>`));
    assert.match(html, /sm:grid-cols-2/);
  }
});
test("telas consomem a mesma conexão e não oferecem emissão nem transferência para banco externo", () => {
  const source = readFileSync(new URL("./bia-banking.tsx", import.meta.url), "utf8");
  const finance = readFileSync(new URL("../pages/fluxo-caixa.tsx", import.meta.url), "utf8");
  const capital = readFileSync(new URL("../pages/nucleo-capital.tsx", import.meta.url), "utf8");
  assert.match(capital, /<BiaBanking[^>]+canEdit=\{!readOnly\}><BiaAsaasStatus/);
  assert.match(finance, /<BankReceipts[^>]+biaId=\{selectedBiaId\} readOnly=\{readOnly\}/);
  assert.match(source, /connectorIds: \[result.connectorId\]/); assert.match(source, /method: option.method/);
  assert.match(source, /selected\?\.available/); assert.match(source, /c\.conflict \|\| c\.differenceCents !== 0/);
  assert.doesNotMatch(source, /\/transfers|\/payments|type="password"|apiKey/);
});
