import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { ExternalBanking, usesAsaasBanking } from "./external-banking";
import { registerExternalBanking } from "./external-banking-routes";
import { BankingError, bankCredential, bankDigest, sealBankData, openBankData, PluggyReceiptProvider, DirectReceiptProvider, validateBankUrl, type VerifiedBankAccount } from "./external-banking-provider";
import type { ReceiptFlow, BankReceipt } from "../shared/external-banking";

test("cofre vincula conteúdo à conexão e URLs/certificados não aceitam destinos arbitrários", () => {
  const previous = process.env.BUILT_BANKING_VAULT_KEY; process.env.BUILT_BANKING_VAULT_KEY = "12".repeat(32);
  try {
    const sealed = sealBankData({ token: "fixture-only" }, "a"); assert.deepEqual(openBankData(sealed, "a"), { token: "fixture-only" });
    assert.throws(() => openBankData(sealed, "b"));
    for (const url of ["http://api.c6bank.com.br", "https://c6bank.com.br.evil.test", "https://user@api.c6bank.com.br", "https://127.0.0.1/"]) assert.throws(() => validateBankUrl(url, "c6"));
    assert.equal(validateBankUrl("https://api.c6bank.com.br/test", "c6").protocol, "https:");
  } finally { if (previous === undefined) delete process.env.BUILT_BANKING_VAULT_KEY; else process.env.BUILT_BANKING_VAULT_KEY = previous; }
});

test("produção lê credencial e certificado cifrados e não usa fallback em claro", () => {
  const names = ["BUILT_BANKING_VAULT_KEY", "BUILT_BANKING_CREDENTIALS", "BUILT_BANKING_ENVIRONMENT", "TEST_BANK_CERT"], prior = { ...process.env };
  try {
    process.env.BUILT_BANKING_VAULT_KEY = "16".repeat(32); process.env.BUILT_BANKING_ENVIRONMENT = "production";
    process.env.TEST_BANK_CERT = "plaintext-fixture"; delete process.env.BUILT_BANKING_CREDENTIALS;
    assert.equal(bankCredential("TEST_BANK_CERT"), undefined);
    process.env.BUILT_BANKING_CREDENTIALS = JSON.stringify(sealBankData({ TEST_BANK_CERT: "encrypted-fixture" }, "banking:credentials:production"));
    assert.equal(bankCredential("TEST_BANK_CERT"), "encrypted-fixture");
    process.env.BUILT_BANKING_ENVIRONMENT = "sandbox"; assert.throws(() => bankCredential("TEST_BANK_CERT"));
  } finally { for (const n of names) if (prior[n] === undefined) delete process.env[n]; else process.env[n] = prior[n]; }
});

test("Pluggy usa autorização vinculada à tentativa, normaliza só créditos e restringe cursor", async () => {
  const calls: string[] = [];
  let mismatch = false, wrongPage = false, partial = false;
  const provider = new PluggyReceiptProvider(async (url, opts) => {
    calls.push(url);
    if (url.endsWith("/auth")) return { apiKey: "fixture-key" };
    assert.equal(opts.headers?.["X-API-KEY"], "fixture-key");
    if (url.includes("/items/")) return { id: "item", clientUserId: mismatch ? "foreign" : "session", status: "UPDATED", executionStatus: partial ? "PARTIAL_SUCCESS" : "SUCCESS", connector: { id: 1, isOpenFinance: true } };
    if (url.includes("/accounts/")) return { id: "account", itemId: "item", type: "BANK", currencyCode: "BRL", number: "0001/12345-0", taxNumber: "11111111111" };
    return { results: [{ id: "tx", providerId: "stable", accountId: "account", type: "CREDIT", status: "POSTED", date: "2026-11-09T13:00:00Z", amount: 10, currencyCode: "BRL" }, { accountId: "account", type: "DEBIT" }], next: wrongPage ? "?accountId=foreign&after=secret" : null };
  });
  const binding = { bank: "nubank" as const, kind: "PF" as const, itemId: "item", accountId: "account", clientUserId: "session", connectorId: 1 };
  const account = await provider.verify(binding); assert.equal(account.ownerDocument, "11111111111");
  assert.equal((await provider.receipts(account, "2026-11-09", "2026-11-10", null)).receipts.length, 1);
  assert.equal(calls.filter(x => x.endsWith("/auth")).length, 1);
  partial = true; await assert.rejects(() => provider.verify(binding), (e: any) => e.code === "CONSENT_PENDING"); partial = false;
  mismatch = true; await assert.rejects(() => provider.verify(binding));
  wrongPage = true; await assert.rejects(() => provider.receipts(account, "2026-11-09", "2026-11-10", null));
});

test("conector direto usa contrato somente leitura, token form, mTLS e identidade retornada pelo banco", async () => {
  const prior = { ...process.env };
  Object.assign(process.env, { TEST_BANK_CERT: "fixture-cert", TEST_BANK_KEY: "fixture-private-key", TEST_BANK_ID: "fixture-client" });
  try {
    const p: any = { id: "c6-test", biaId: "bia", environment: "sandbox", bank: "c6", kind: "PJ", contractApproved: true, homologated: false, costs: "Condições de teste",
      baseUrl: "https://api.c6bank.com.br", tokenUrl: "https://api.c6bank.com.br/oauth/token", clientIdEnv: "TEST_BANK_ID", certEnv: "TEST_BANK_CERT", privateKeyEnv: "TEST_BANK_KEY", scope: "extrato.read",
      identity: { path: "/contract/account", account: "number", document: "owner" }, receipts: { path: "/contract/receipts", rows: "results", id: "id", amount: "amount", date: "date", direction: "direction", creditValue: "C", status: "state", settledValue: "posted", fromParam: "from", toParam: "to" } };
    const http: any = async (url: string, opts: any) => {
      assert.equal(opts.cert, "fixture-cert"); assert.equal(opts.privateKey, "fixture-private-key");
      if (url.includes("/oauth")) { assert.equal(opts.form.grant_type, "client_credentials"); assert.equal(opts.body, undefined); return { access_token: "fixture-token" }; }
      assert.equal(opts.headers.authorization, "Bearer fixture-token");
      if (url.includes("/account")) return { number: "001/1234", owner: "11222333000181" };
      return { results: [{ id: "r", amount: "10.01", date: "2026-11-09T13:00:00Z", direction: "C", state: "posted" }, { direction: "D" }] };
    };
    const provider = new DirectReceiptProvider(p, http), account = await provider.verify();
    assert.equal(account.ownerDocument, "11222333000181"); assert.equal((await provider.receipts(account, "2026-11-09", "2026-11-10", null)).receipts[0].amountCents, 1001);
    assert.throws(() => new DirectReceiptProvider({ ...p, scope: "pix.write" }, http));
    assert.throws(() => new DirectReceiptProvider({ ...p, environment: "production" }, http));
    assert.throws(() => new DirectReceiptProvider({ ...p, identity: { ...p.identity, path: "//evil.test" } }, http));
  } finally { for (const k of ["TEST_BANK_CERT", "TEST_BANK_KEY", "TEST_BANK_ID"]) if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
});

test("conciliação durável: migração idempotente, exclusividade, repetição, resposta perdida, pausa e permissões", async () => {
  const previous = process.env.BUILT_BANKING_VAULT_KEY; process.env.BUILT_BANKING_VAULT_KEY = "14".repeat(32);
  const pg = new PGlite(), db = drizzle(pg);
  try {
    const migration = readFileSync(new URL("../migrations/20261109_external_banking.sql", import.meta.url), "utf8"); await pg.exec(migration); await pg.exec(migration);
    assert.equal(await usesAsaasBanking(db, "bia", "sandbox"), true);
    const id = randomUUID(), account: VerifiedBankAccount = { bank: "inter", kind: "PJ", number: "0001/9876-0", externalId: "account", ownerDocument: "11222333000181" };
    const accountKey = bankDigest("inter:11222333000181:000198760");
    await db.execute(sql`INSERT INTO bia_bank_connections(id,bia_id,environment,bank,account_kind,method,actor_id,state,account_key,secret,activated_at,auto_enabled,auto_actor) VALUES(${id},'bia','sandbox','inter','PJ','direct','actor','connected',${accountKey},${JSON.stringify(sealBankData({ account }, id))}::jsonb,now()-interval '1 hour',true,'actor')`);
    await assert.rejects(() => db.execute(sql`INSERT INTO bia_bank_connections(id,bia_id,environment,bank,account_kind,method,actor_id,state,account_key) VALUES(${randomUUID()},'other','sandbox','inter','PJ','direct','actor','connected',${accountKey})`));
    const flows: ReceiptFlow[] = [{ id: "flow", biaId: "bia", type: "entrada", status: "pendente", amountCents: 1000, currency: "BRL", description: "Aporte", date: new Date().toISOString(), payerDocument: "11111111111", cash: true, protected: false, activeCharge: false }];
    const receipts: BankReceipt[] = [{ id: "bank-tx", bankTransactionId: "bank-tx", amountCents: 1000, currency: "BRL", status: "settled", receivedAt: new Date().toISOString(), description: "Pix", payerDocument: "11111111111" }];
    let can = true, permitted = true, loseResponse = true, writes = 0;
    const service = new ExternalBanking({ db, lock: async (_id, work) => db.transaction(work), environment: "sandbox", enabled: () => true,
      flows: async () => flows, canRead: async () => permitted, canAutomate: async () => can,
      provider: () => ({ verify: async () => account, receipts: async () => ({ receipts, next: null }) }),
      apply: async ({ receiptId, previousStatus }) => {
        assert.equal(previousStatus, "pendente");
        if (flows[0].status !== "pago") { writes++; flows[0].status = "pago"; (flows[0] as any).receiptId = receiptId; }
        if (loseResponse) { loseResponse = false; throw new Error("lost-response-fixture"); }
      } });
    await service.choose("bia", "external", "actor"); assert.equal(await usesAsaasBanking(db, "bia", "sandbox"), false);
    await assert.rejects(() => service.sync("bia", id));
    assert.equal(writes, 1); assert.equal((await db.execute(sql`SELECT state FROM bia_bank_receipts`)).rows[0].state, "applying");
    await service.sync("bia", id); await service.sync("bia", id);
    assert.equal(writes, 1); assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM bia_bank_receipts WHERE state='reconciled'`)).rows[0].n, 1);
    assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM bia_bank_events WHERE action='automatic_receipt'`)).rows[0].n, 1);
    const listed = await service.listReceipts("bia"); assert.equal(listed[0].automatic, true); assert.equal(JSON.stringify(listed).includes("11111111111"), false);
    await service.choose("bia", "asaas", "actor"); assert.equal((await service.connection("bia", id)).auto_enabled, false);
    await service.choose("bia", "external", "actor"); can = false; await assert.rejects(() => service.setAutomation("bia", id, true, "actor"));
    permitted = false; await assert.rejects(() => service.sync("bia", id), (e: any) => e.code === "BANK_ACCESS_REMOVED");
    await service.disconnect("bia", id); assert.equal((await service.connection("bia", id)).secret, null); await assert.rejects(() => service.sync("bia", id));
  } finally { await pg.close(); if (previous === undefined) delete process.env.BUILT_BANKING_VAULT_KEY; else process.env.BUILT_BANKING_VAULT_KEY = previous; }
});

test("API canônica exige Banco/Financeiro, origem válida e não entrega segredo em erro", async () => {
  const app = express(); app.use(express.json()); const calls: any[] = [];
  const service: any = { status: async (id: string) => ({ id }), choose: async (id: string, value: string) => ({ id, value }), listReceipts: async (id: string) => ({ id }),
    setAutomation: async () => { throw new Error("private-key-fixture"); }, webhook: async () => { throw new BankingError("WEBHOOK_UNAUTHORIZED", "Não autorizado", 401); } };
  registerExternalBanking(app, service, async (req, res, id, bank, finance) => {
    calls.push({ id, bank, finance }); if (req.get("x-fixture-auth") !== "allowed") { res.status(403).json({ error: "Sem acesso" }); return null; }
    return { id: "canonical", actor: "actor", canEdit: true, canFinance: true };
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal((await fetch(base + "/api/bias/code/banco/externo/status")).status, 403);
    const headers = { "x-fixture-auth": "allowed", "content-type": "application/json" };
    assert.equal((await (await fetch(base + "/api/bias/code/banco/externo/status", { headers })).json()).id, "canonical");
    await fetch(base + "/api/bias/code/banco/externo/recebimentos", { headers }); assert.equal(calls.at(-1).finance, "view");
    const response = await fetch(base + `/api/bias/code/banco/externo/conexoes/${randomUUID()}/automacao`, { method: "PUT", headers, body: JSON.stringify({ enabled: true, confirm: true }) });
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-key/); assert.equal(calls.at(-1).bank, "edit"); assert.equal(calls.at(-1).finance, "edit");
    assert.equal((await fetch(base + "/api/bias/code/banco/externo/escolha", { method: "PUT", headers: { ...headers, origin: "https://foreign.invalid" }, body: JSON.stringify({ choice: "external" }) })).status, 403);
    assert.equal((await fetch(base + "/api/webhooks/banking/pluggy", { method: "POST", headers, body: "{}" })).status, 401);
  } finally { await new Promise<void>((r, j) => server.close(e => e ? j(e) : r())); }
});

test("paginação retoma sem anunciar sucesso parcial; estorno e remoção não repetem pagamento", async () => {
  const priorKey = process.env.BUILT_BANKING_VAULT_KEY, priorSecret = process.env.BUILT_BANKING_WEBHOOK_SECRET;
  process.env.BUILT_BANKING_VAULT_KEY = "15".repeat(32); process.env.BUILT_BANKING_WEBHOOK_SECRET = "fixture-secret-".repeat(4);
  const pg = new PGlite(), db = drizzle(pg);
  try {
    await pg.exec(readFileSync(new URL("../migrations/20261109_external_banking.sql", import.meta.url), "utf8"));
    const id = randomUUID(), account: VerifiedBankAccount = { bank: "inter", kind: "PJ", number: "0001/4567", externalId: "a", ownerDocument: "11222333000181" };
    await db.execute(sql`INSERT INTO bia_bank_connections(id,bia_id,environment,bank,account_kind,method,actor_id,state,account_key,secret,activated_at,auto_enabled,auto_actor) VALUES(${id},'bia','sandbox','inter','PJ','pluggy','actor','connected',${bankDigest("inter:11222333000181:00014567")},${JSON.stringify(sealBankData({ itemId: "item", account }, id))}::jsonb,now()-interval '1 hour',true,'actor')`);
    const flows: ReceiptFlow[] = [{ id: "flow", biaId: "bia", type: "entrada", status: "agendado", amountCents: 1000, currency: "BRL", description: "Aporte", payerDocument: "11111111111", cash: true, protected: false, activeCharge: false }];
    const receipt: BankReceipt = { id: "tx", bankTransactionId: "stable", amountCents: 1000, currency: "BRL", receivedAt: new Date().toISOString(), status: "settled", payerDocument: "11111111111", description: "Pix" };
    let writes = 0, calls = 0, paginate = true;
    const service = new ExternalBanking({ db, lock: async (_id, work) => db.transaction(work), enabled: () => true, environment: "sandbox", canRead: async () => true, canAutomate: async () => true, flows: async () => flows,
      apply: async ({ previousStatus }) => { assert.equal(previousStatus, "agendado"); writes++; flows[0].status = "pago"; },
      provider: () => ({ verify: async () => account, receipts: async (_account, _from, _to, cursor) => {
        calls++; const page = Number(cursor || "0"); return paginate && page < 20 ? { receipts: [], next: String(page + 1) } : { receipts: [receipt], next: null };
      } }) });
    await service.choose("bia", "external", "actor");
    await assert.rejects(() => service.sync("bia", id), (e: any) => e.code === "SYNC_PARTIAL");
    const partial = await service.connection("bia", id); assert.equal(partial.last_success_at, null); assert.equal(partial.sync_cursor, "20"); assert.equal(writes, 0);
    await service.sync("bia", id); assert.equal(calls, 21); assert.equal(writes, 1); assert.equal((await service.connection("bia", id)).sync_cursor, null);
    paginate = false; receipt.status = "reversed";
    await service.sync("bia", id); assert.equal(writes, 1); assert.equal((await service.listReceipts("bia"))[0].state, "review");
    await service.webhook(process.env.BUILT_BANKING_WEBHOOK_SECRET!, { eventId: "deleted", itemId: "item", event: "transactions/deleted", url: "https://foreign.invalid" });
    await service.webhook(process.env.BUILT_BANKING_WEBHOOK_SECRET!, { eventId: "deleted", itemId: "item", event: "transactions/deleted" });
    assert.equal((await service.connection("bia", id)).auto_enabled, false);
    assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM bia_bank_events WHERE provider='pluggy'`)).rows[0].n, 1);
    assert.equal(flows[0].status, "pago");
    // Simula uma confirmação concorrente enquanto a lista de candidatos é preparada.
    const concurrent = randomUUID();
    await db.execute(sql`INSERT INTO bia_bank_receipts(id,connection_id,bia_id,environment,transaction_key,receipt,state) VALUES(${concurrent},${id},'bia','sandbox','other',${JSON.stringify(sealBankData({ ...receipt, status: "settled" }, concurrent))}::jsonb,'suggested')`);
    service.deps.flows = async () => {
      await db.execute(sql`UPDATE bia_bank_receipts SET state='reconciled',flow_id='other-flow' WHERE id=${concurrent}`);
      return [];
    };
    await service.reconcile("bia", await service.connection("bia", id));
    assert.equal((await db.execute(sql`SELECT state FROM bia_bank_receipts WHERE id=${concurrent}`)).rows[0].state, "reconciled");
  } finally {
    await pg.close();
    if (priorKey === undefined) delete process.env.BUILT_BANKING_VAULT_KEY; else process.env.BUILT_BANKING_VAULT_KEY = priorKey;
    if (priorSecret === undefined) delete process.env.BUILT_BANKING_WEBHOOK_SECRET; else process.env.BUILT_BANKING_WEBHOOK_SECRET = priorSecret;
  }
});
