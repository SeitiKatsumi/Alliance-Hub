import test from "node:test";
import assert from "node:assert/strict";
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
  assert.match(html, /Ainda não disponível/);
});

test("conta aprovada não libera operações e armazenamento indisponível não simula vínculo ausente", () => {
  const data = asaasBiaStatusSchema.parse({ environment: "sandbox", integrationState: "foundation_ready", storageReady: true, operationsEnabled: false, account: { id: "account-test", label: "Holding <script>", state: "approved", ownership: "company" } });
  const html = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data }));
  assert.match(html, /Holding &lt;script&gt;/); assert.match(html, /Aprovada/); assert.match(html, /ainda aguardam homologação/);
  assert.doesNotMatch(html, /<input|<button/);
  const unavailable = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: { ...data, account: null, storageReady: false } }));
  assert.doesNotMatch(unavailable, /Nenhuma conta Asaas vinculada/); assert.match(unavailable, /poderá ser consultado/);
  assert.throws(() => asaasBiaStatusSchema.parse({ ...data, operationsEnabled: true }));
});
