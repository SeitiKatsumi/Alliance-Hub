import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { registerPinbankRoutes } from "./routes";
import { assertLedgerBinding } from "./production";
import { validateBankDocument } from "./onboarding";
import { BankStore } from "./store";

test("HTTP authorization, immutable confirmation, durable duplicate prevention and database failure", async () => {
  const fixtureEnv = { PINBANK_DEV_ENABLED: "true", PINBANK_DEV_USERNAME: "fixture-only", PINBANK_DEV_KEY_VALUE: "0123456789abcdef", PINBANK_DEV_ENABLED_METHODS: "balance" };
  const saved = Object.fromEntries(Object.keys(fixtureEnv).map(k => [k, process.env[k]]));
  Object.assign(process.env, fixtureEnv);
  const database = new PGlite();
  await database.exec(await readFile(new URL("../../migrations/20260909_pinbank_isolation.sql", import.meta.url), "utf8"));
  const app = express();
  app.use(express.json({ verify(req, _res, raw) { (req as any).rawBody = raw; } }));
  app.use((req, _res, next) => { (req as any).session = { directusUserId: req.get("x-fixture-user"), role: req.get("x-fixture-role") }; next(); });
  let providerCalls = 0;
  registerPinbankRoutes(app, async req => req.get("x-fixture-role") || "user", { pool: database as unknown as Pool, fetcher: (async url => {
    if (String(url).endsWith("/token")) return new Response(JSON.stringify({ access_token: "fixture", expires_in: 3600 }));
    providerCalls++;
    return new Response(JSON.stringify({ ResultCode: 0, Data: { Saldo: 125, KeyValue: "must-not-expose" } }));
  }) as typeof fetch });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/pinbank/dev`;
  const headers = { "Content-Type": "application/json", "x-fixture-user": "admin-id", "x-fixture-role": "admin" };
  try {
    assert.equal((await fetch(base + "/status")).status, 401);
    assert.equal((await fetch(base + "/status", { headers: { ...headers, "x-fixture-role": "manager" } })).status, 403);
    const status = await (await fetch(base + "/status", { headers })).json();
    assert.equal(status.storageReady, true); assert.equal(JSON.stringify(status).includes(fixtureEnv.PINBANK_DEV_KEY_VALUE), false);
    const invalid = await fetch(base + "/prepare", { method: "POST", headers, body: JSON.stringify({ method: "balance", input: { CodigoCliente: 777 }, idempotencyKey: randomUUID(), fictitiousData: true }) });
    assert.equal(invalid.status, 400); assert.equal(providerCalls, 0);
    const response = await fetch(base + "/prepare", { method: "POST", headers, body: JSON.stringify({ method: "balance", input: {}, idempotencyKey: randomUUID(), fictitiousData: true }) });
    assert.equal(response.status, 201);
    const prepared = await response.json();
    assert.equal(providerCalls, 0);
    const wrong = await fetch(`${base}/operations/${prepared.id}/confirm`, { method: "POST", headers, body: JSON.stringify({ confirmation: "0".repeat(64) }) });
    assert.equal(wrong.status, 409);
    const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(`${base}/operations/${prepared.id}/confirm`, { method: "POST", headers, body: JSON.stringify({ confirmation: prepared.confirmation }) })));
    assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(providerCalls, 1);
    const history = await (await fetch(base + "/operations", { headers })).json();
    assert.equal(history[0].state, "completed"); assert.equal(JSON.stringify(history).includes("must-not-expose"), false);
    const store = new BankStore(database as unknown as Pool, "dev");
    const receipt = await store.prepare("admin-id", "homologation", "receipt", randomUUID(), { receiptId: 42 }, { client: 3510, channel: 47 });
    await store.claim(receipt.id, "admin-id", "homologation", receipt.confirmation_hash);
    const pdf = Buffer.from("%PDF-1.4\nfixture-only\n%%EOF");
    await store.finish(receipt.id, "completed", { receipts: [{ id: 42, downloadable: true, pdfBase64: pdf.toString("base64") }] });
    const download = `${base}/operations/${receipt.id}/receipts/42/pdf`;
    assert.equal((await fetch(download)).status, 401);
    assert.equal((await fetch(download, { headers: { ...headers, "x-fixture-role": "manager" } })).status, 403);
    const file = await fetch(download, { headers });
    assert.equal(file.status, 200); assert.equal(file.headers.get("Content-Type"), "application/pdf");
    assert.match(file.headers.get("Content-Disposition") || "", /^attachment;/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
    assert.equal((await fetch(`${base}/operations/${receipt.id}/receipts/43/pdf`, { headers })).status, 404);
    assert.equal(JSON.stringify(await (await fetch(base + "/operations", { headers })).json()).includes("pdfBase64"), false);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM pinbank_production.operations")).rows[0].count, 0);
    await database.close();
    const unavailable = await fetch(base + "/prepare", { method: "POST", headers, body: JSON.stringify({ method: "balance", input: {}, idempotencyKey: randomUUID(), fictitiousData: true }) });
    assert.equal(unavailable.status, 503); assert.equal(providerCalls, 1);
  } finally {
    server.closeAllConnections(); server.close();
    if (!database.closed) await database.close();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("ledger binding and document magic reject incompatible or protected resources", () => {
  const ledger = { id: "ledger", bia: { id: "bia-a" }, tipo: "saida", valor: "12.50", status: "pendente" };
  assert.doesNotThrow(() => assertLedgerBinding(ledger, "bia-a", 1250, "saida"));
  assert.throws(() => assertLedgerBinding(ledger, "bia-b", 1250, "saida"));
  assert.throws(() => assertLedgerBinding(ledger, "bia-a", 1251, "saida"));
  assert.throws(() => assertLedgerBinding({ ...ledger, status: "pago" }, "bia-a", 1250, "saida"));
  assert.throws(() => assertLedgerBinding({ ...ledger, pagamento_id: "another-operation" }, "bia-a", 1250, "saida", "this-operation"));
  assert.throws(() => validateBankDocument(Buffer.from("<script>bad</script>"), "document.pdf"));
  assert.throws(() => validateBankDocument(Buffer.from("%PDF-fixture"), "document.html"));
  assert.equal(validateBankDocument(Buffer.from("%PDF-fixture"), "document.pdf").mime, "application/pdf");
});
