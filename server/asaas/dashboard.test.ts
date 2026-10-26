import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readBankDashboard, bankDateRange } from "./dashboard";
import { bankDashboardSchema, bankEntryGroup, bankTotals, bankStatusLabel } from "../../shared/asaas-dashboard";
import { registerAsaasFoundation } from "./routes";
import { AsaasAccountOperations } from "./operations";
import { asaasConfig } from "./config";
import { encryptCredential } from "./credentials";

const record = (id: string, status = "RECEIVED", value = 10.01) => ({ id, status, value, dateCreated: "2026-10-01", netValue: value - 1, customer: "private", bankAccount: { pixAddressKey: "private" } });
const empty = { data: [], hasMore: false, totalCount: 0 };

test("dashboard pagina até o fim, usa a criação, soma centavos e não expõe dados pessoais", async () => {
  const calls: string[] = [];
  const data = await readBankDashboard({ request: async (path, options) => {
    assert.equal(options, undefined); calls.push(path);
    if (path === "/finance/balance") return { balance: 12.34 };
    const params = new URL(path, "https://example.test").searchParams;
    assert.equal(params.get("dateCreated[ge]"), "2026-09-27");
    assert.equal(params.get("dateCreated[le]"), "2026-10-26");
    if (path.startsWith("/transfers")) return { data: [record("tr1", "DONE", 2), record("tr2", "BANK_PROCESSING", 3)], hasMore: false, totalCount: 2 };
    return params.get("offset") === "0" ? { data: [record("p1"), record("p2", "CONFIRMED")], hasMore: true, totalCount: 3 } : { data: [record("p3", "RECEIVED_IN_CASH", 50)], hasMore: false, totalCount: 3 };
  } }, "sandbox", "30", new Date("2026-10-26T12:00:00Z"));
  bankDashboardSchema.parse(data);
  assert.equal(data.scope, "company_account"); assert.equal(data.payments.complete, true); assert.equal(data.balance, 12.34);
  assert.equal(bankTotals(data.payments.items, "payments").value, 70.02);
  assert.equal(bankTotals(data.payments.items, "payments", "received").value, 10.01);
  assert.equal(bankTotals(data.transfers.items, "transfers", "completed").value, 2);
  assert.equal(bankEntryGroup("payments", "CONFIRMED"), "confirmed");
  assert.equal(bankEntryGroup("payments", "RECEIVED_IN_CASH"), "external");
  assert.equal(bankEntryGroup("transfers", "NEW_STATUS"), "other");
  assert.match(bankStatusLabel("NEW_STATUS"), /Outra situação/);
  assert.doesNotMatch(JSON.stringify(data), /private|pixAddressKey|customer/);
  assert.ok(calls.some(path => path.includes("offset=2")));
});

test("falha parcial não apaga saldo nem finge zero, página repetida não duplica total", async () => {
  let pages = 0;
  const data = await readBankDashboard({ request: async path => {
    if (path === "/finance/balance") throw Error("secret");
    if (path.startsWith("/payments")) { if (++pages > 1) throw Error("private"); return { data: [record("p1")], hasMore: true, totalCount: 2 }; }
    return { data: [record("same", "FAILED")], hasMore: true, totalCount: 8 };
  } }, "sandbox", "all");
  assert.equal(data.balance, null); assert.equal(data.payments.available, true); assert.equal(data.payments.complete, false);
  assert.equal(data.transfers.items.length, 1); assert.equal(data.transfers.complete, false);
  assert.doesNotMatch(JSON.stringify(data), /secret|private/);
  const unavailable = await readBankDashboard({ request: async () => ({}) }, "sandbox", "90");
  assert.equal(unavailable.payments.available, false); assert.equal(unavailable.balance, null);
});

test("limite é parcial, valores ausentes não viram zero e links são restritos", async () => {
  let page = 0;
  const result = await readBankDashboard({ request: async path => {
    if (path === "/finance/balance") return { balance: null };
    if (path.startsWith("/transfers")) return { data: [{ id: "missing", status: "DONE" }], hasMore: false };
    page++;
    return { data: [{ ...record(`p${page}`), invoiceUrl: "javascript:alert(1)", transactionReceiptUrl: "https://evil.example/receipt" }], hasMore: true };
  } }, "sandbox", "all");
  assert.equal(page, 5); assert.equal(result.payments.complete, false); assert.equal(result.payments.items.length, 5);
  assert.equal(result.transfers.available, false); assert.equal(result.balance, null);
  assert.ok(result.payments.items.every(item => item.invoiceUrl === null && item.receiptUrl === null));
  assert.deepEqual(bankDateRange("30", new Date("2026-10-26T01:00:00Z")), { from: "2026-09-26", to: "2026-10-25" });
});

test("dashboard usa somente credencial da conta aprovada e não grava operações", async () => {
  const vault = Buffer.alloc(32, 9).toString("base64");
  const config = asaasConfig({ ASAAS_BASE_ENABLED: "true", ASAAS_BAAS_ENABLED: "true", ASAAS_BASE_ENVIRONMENT: "sandbox", ASAAS_SANDBOX_CREDENTIAL_ENCRYPTION_KEY: vault });
  let state = "approved", bound = "";
  const store = { internalAccountForBia: async (id: string) => { bound = id; return { id: "acc", external_account_id: "external", state }; }, accountCredential: async () => encryptCredential("child-private", vault) };
  const service = new AsaasAccountOperations(store as any, config, c => { assert.equal(c.apiKey, "child-private"); return { request: async path => path === "/finance/balance" ? { balance: 0 } : empty }; });
  assert.equal((await service.dashboard("authorized-bia", "90")).balance, 0); assert.equal(bound, "authorized-bia");
  state = "blocked";
  await assert.rejects(() => service.dashboard("authorized-bia", "90"), /aprovada/);
});

test("endpoint autoriza view antes do banco, rejeita período inválido e usa ID canônico", async t => {
  const app = express(); let allowed = false, required: string | undefined;
  registerAsaasFoundation(app, { db: {} as any, resolvePrincipal: async () => null, authorizeBia: async (_req, res, _bia, permission) => {
    required = permission; if (!allowed) { res.status(403).json({ error: "Forbidden" }); return null; } return { id: "canonical" };
  } });
  const server = app.listen(0); t.after(() => server.close());
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/bias/public-code/banco/asaas/dashboard`;
  assert.equal((await fetch(url)).status, 403); assert.equal(required, "view");
  allowed = true; assert.equal((await fetch(url + "?period=bad")).status, 400);
  const originalDashboard = AsaasAccountOperations.prototype.dashboard;
  try {
    AsaasAccountOperations.prototype.dashboard = async function (biaId, period) {
      assert.equal(biaId, "canonical"); assert.equal(period, "30");
      return readBankDashboard({ request: async path => path === "/finance/balance" ? { balance: 0 } : empty }, "sandbox", period);
    };
    const response = await fetch(url + "?period=30");
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).scope, "company_account");
  } finally { AsaasAccountOperations.prototype.dashboard = originalDashboard; }
});
