import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AsaasAdminSummary, AsaasBiaSummary } from "./asaas-status";
import { asaasBiaStatusSchema } from "../../../shared/asaas";
import { publicAsaasStatus, asaasConfig } from "../../../server/asaas/config";

test("painel Asaas informa preparação sem campos de chave nem ações financeiras", () => {
  const summary = publicAsaasStatus(asaasConfig({}), false);
  const html = renderToStaticMarkup(React.createElement(AsaasAdminSummary, { data: summary }));
  assert.match(html, /Sandbox/); assert.match(html, /Próximos passos/); assert.match(html, /BaaS/);
  assert.doesNotMatch(html, /<input|<button|type="password"/);
  assert.match(html, /Pendente/);
});

test("conta aprovada informa operações habilitadas e armazenamento indisponível não simula vínculo ausente", () => {
  const data = asaasBiaStatusSchema.parse({ environment: "sandbox", integrationState: "operational", storageReady: true, operationsEnabled: true, chargesEnabled: true, transfersEnabled: true, accountCreationAvailable: true, accountCreationBlockers: [], account: { id: "account-test", label: "Holding <script>", state: "approved", ownership: "company" } });
  const html = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data }));
  assert.match(html, /Holding &lt;script&gt;/); assert.match(html, /Aprovada/); assert.match(html, /Cobranças habilitadas/); assert.match(html, /Transferências habilitadas/);
  assert.doesNotMatch(html, /<input|<button/);
  const unavailable = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: { ...data, account: null, storageReady: false } }));
  assert.doesNotMatch(unavailable, /Nenhuma conta Asaas vinculada/); assert.match(unavailable, /poderá ser consultado/);
  assert.equal(asaasBiaStatusSchema.parse({ ...data, operationsEnabled: false }).operationsEnabled, false);
});

test("fluxo de criação Sandbox é responsivo e só aparece para edição do Banco", () => {
  const source = readFileSync(new URL("./asaas-status.tsx", import.meta.url), "utf8");
  const capital = readFileSync(new URL("../pages/nucleo-capital.tsx", import.meta.url), "utf8");
  assert.match(source, /button-create-asaas-subaccount/);
  assert.match(source, /h-\[100dvh\][\s\S]*?overflow-y-auto[\s\S]*?button-confirm-create-asaas-subaccount/);
  assert.match(source, /accountCreationAvailable/);
  assert.match(source, /Serviço bancário fornecido pelo/);
  assert.match(source, /asaas-account-operations/); assert.match(source, /Confirmar transferência/);
  assert.match(capital, /BiaAsaasStatus[^>]+canEdit=\{!readOnly\}/);
});
