import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDecipheriv, generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { bankConfig, bankUrl, BankError } from "./config";
import { BankTransport } from "./transport";
import { BankStore, nextBankState, bankDigest } from "./store";
import { BankWebhookVerifier } from "./webhook";
import { bankInputs, executeBankMethod, assertMethod } from "./methods";
import { bankAdminAllowed } from "./routes";
import { bankEventEvidence } from "./events";
import { preparePayout, sendPayout } from "./payouts";
import { publicBankResponse } from "./redact";

const fixtureKey = "0123456789abcdef"; // Deliberately synthetic test fixture.
const config = () => bankConfig("dev", { PINBANK_DEV_ENABLED: "true", PINBANK_DEV_USERNAME: "fixture", PINBANK_DEV_KEY_VALUE: fixtureKey, PINBANK_DEV_ENABLED_METHODS: "balance,boleto,terms" });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("environment configuration never inherits legacy or production credentials", () => {
  const dev = bankConfig("dev", { PINBANK_USERNAME: "legacy", PINBANK_PROD_USERNAME: "production" });
  assert.equal(dev.username, ""); assert.equal(dev.enabled, false); assert.equal(dev.newOperationsEnabled, false);
  assert.deepEqual(dev.clients, { pix: 3505, banking: 3510 });
  assert.deepEqual(bankConfig("production").clients, { pix: 0, banking: 0 });
  assert.equal(bankAdminAllowed("id", "admin", undefined), true);
  for (const role of ["manager", "user", "employee"]) assert.equal(bankAdminAllowed("id", role, undefined), false);
  assert.equal(bankAdminAllowed(undefined, "admin", undefined), false);
  assert.equal(bankAdminAllowed("id", "admin", "employee"), false);
});
test("URL composition normalizes /api and rejects external hosts or paths", () => {
  assert.equal(bankUrl(config().baseUrl, "/api/token"), "https://dev.pinbank.com.br/services/api/token");
  assert.equal(bankUrl("https://dev.pinbank.com.br/services", "/api/ContaDigital/SaldoEncrypted"), "https://dev.pinbank.com.br/services/api/ContaDigital/SaldoEncrypted");
  assert.throws(() => bankUrl("https://evil.example", "/api/token"));
  assert.throws(() => bankUrl(config().baseUrl, "https://evil.example"));
});
test("token single flight, exact encryption envelope, safe balance projection", async () => {
  let tokens = 0; let queries = 0;
  const transport = new BankTransport(config(), (async (url, options) => {
    if (String(url).endsWith("/token")) { tokens++; return json({ access_token: "fixture-token", expires_in: 300 }); }
    queries++;
    assert.equal(String(url).endsWith("/api/ContaDigital/SaldoEncrypted"), true);
    const payload = JSON.parse(String(options?.body));
    const decipher = createDecipheriv("aes-128-cbc", Buffer.from(fixtureKey), Buffer.alloc(16));
    const decrypted = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.Data.Json, "base64")), decipher.final()]).toString());
    assert.deepEqual(decrypted, { Data: { CodigoCanal: 47, CodigoCliente: 3510 } });
    return json({ ResultCode: 0, Data: { Saldo: 12.5, KeyValue: "must-not-leak" } });
  }) as typeof fetch);
  const results = await Promise.all(Array.from({ length: 8 }, () => executeBankMethod(transport, "balance", {}, randomUUID(), 3510)));
  assert.equal(tokens, 1); assert.equal(queries, 8);
  assert.deepEqual(results[0], { balance: 12.5 });
});
test("401 renews once; unknown results and malformed responses are never resent", async () => {
  let tokens = 0; let sends = 0;
  const transport = new BankTransport(config(), (async url => {
    if (String(url).endsWith("/token")) { tokens++; return json({ access_token: "fixture-" + tokens, expires_in: 300 }); }
    sends++; return sends === 1 ? json({}, 401) : json({ ResultCode: 0, Data: { Saldo: 1 } });
  }) as typeof fetch);
  await transport.call("/api/ContaDigital/Saldo", {});
  assert.equal(tokens, 2); assert.equal(sends, 2);
  let attempts = 0;
  const uncertain = new BankTransport(config(), (async url => {
    if (String(url).endsWith("/token")) return json({ access_token: "fixture", expires_in: 300 });
    attempts++; throw new Error("network interrupted");
  }) as typeof fetch);
  await assert.rejects(uncertain.call("/api/CashIn/GerarBoleto", {}), (e: any) => e.code === "RESULT_UNKNOWN");
  assert.equal(attempts, 1);
  const malformed = new BankTransport(config(), (async url => String(url).endsWith("/token") ? json({ access_token: "fixture", expires_in: 300 }) : json({ Data: {} })) as typeof fetch);
  await assert.rejects(malformed.call("/api/ContaDigital/Saldo", {}), (e: any) => e.code === "RESULT_UNKNOWN");
  for (const ResultCode of [null, false, "", " ", [], {}]) {
    const invalid = new BankTransport(config(), (async url => String(url).endsWith("/token") ? json({ access_token: "fixture", expires_in: 300 }) : json({ ResultCode, Data: {} })) as typeof fetch);
    await assert.rejects(invalid.call("/api/ContaDigital/Saldo", {}), (e: any) => e.code === "RESULT_UNKNOWN");
  }
});
test("missing credentials, methods, terms and kill switch block execution", async () => {
  let calls = 0;
  const transport = new BankTransport(bankConfig("dev", {}), (async () => { calls++; return json({}); }) as typeof fetch);
  await assert.rejects(transport.token()); assert.equal(calls, 0);
  assert.throws(() => assertMethod(config(), "boleto"), (e: any) => e.code === "NEW_OPERATIONS_DISABLED");
  assert.throws(() => assertMethod(config(), "terms"), (e: any) => e.code === "TERMS_PENDING");
  assert.throws(() => assertMethod(config(), "receipt"), (e: any) => e.code === "METHOD_PENDING");
  assert.doesNotThrow(() => assertMethod(config(), "balance"));
});
test("input schemas reject account injection, real ledger links and mismatched split", () => {
  assert.throws(() => bankInputs.balance.parse({ CodigoCliente: 999 }));
  assert.throws(() => bankInputs.balance.parse({ fluxoCaixaId: "real" }));
  assert.throws(() => bankInputs.statement.parse({ start: "2026-01-01", end: "2026-09-01" }));
  assert.equal(bankDigest({ b: 1, a: 2 }), bankDigest({ a: 2, b: 1 }));
  assert.equal(nextBankState("settled", "pending"), "settled");
  assert.equal(nextBankState("settled", "refunded"), "refunded");
  assert.equal(nextBankState("refunded", "settled"), "refunded");
});
test("Ed25519 validates original bytes, previous key, freshness and rejects forged messages", async () => {
  const active = generateKeyPairSync("ed25519"); const old = generateKeyPairSync("ed25519");
  const verifier = new BankWebhookVerifier((async () => json({ jwks: { keys: [{ ...active.publicKey.export({ format: "jwk" }), kid: "active" }, { ...old.publicKey.export({ format: "jwk" }), kid: "old" }] } })) as typeof fetch);
  const raw = Buffer.from('{ "EventId": "fixture" }');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = "v1a," + sign(null, Buffer.concat([Buffer.from(timestamp + "."), raw]), old.privateKey).toString("base64");
  await verifier.validate(raw, { timestamp, signature, kid: "old" });
  await assert.rejects(verifier.validate(Buffer.from('{"EventId":"fixture"}'), { timestamp, signature, kid: "old" }));
  await assert.rejects(verifier.validate(raw, { timestamp, signature, kid: "active" }));
  await assert.rejects(verifier.validate(raw, { timestamp, signature, kid: "old" }, Date.now() + 301_000));
  await assert.rejects(verifier.validate(raw, { timestamp, signature: "v1a,invalid", kid: "old" }));
});
test("PostgreSQL migration, concurrent idempotency, scope isolation and restart recovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "built-pinbank-test-"));
  let database = new PGlite(directory);
  try {
    const sql = await readFile(new URL("../../migrations/20260909_pinbank_isolation.sql", import.meta.url), "utf8");
    await database.exec("CREATE TABLE public.bia_bank_accounts (id text)");
    await database.exec(sql); await database.exec(sql);
    const store = new BankStore(database as unknown as Pool, "dev");
    const key = randomUUID();
    const rows = await Promise.all(Array.from({ length: 8 }, () => store.prepare("admin", "homologation", "boleto", key, { amountCents: 100 })));
    assert.equal(new Set(rows.map(r => r.id)).size, 1);
    await assert.rejects(store.prepare("other", "homologation", "boleto", key, { amountCents: 100 }));
    await assert.rejects(store.prepare("admin", "homologation", "boleto", key, { amountCents: 200 }));
    const row = rows[0];
    await assert.rejects(store.claim(row.id, "admin", "other-bia", row.confirmation_hash));
    await assert.rejects(store.claim(row.id, "other", "homologation", row.confirmation_hash));
    const claims = await Promise.allSettled(Array.from({ length: 8 }, () => store.claim(row.id, "admin", "homologation", row.confirmation_hash)));
    assert.equal(claims.filter(r => r.status === "fulfilled").length, 1);
    await database.exec("UPDATE pinbank_dev.operations SET sent_at=now()-interval '3 minutes'");
    await database.close(); database = new PGlite(directory);
    const reopened = new BankStore(database as unknown as Pool, "dev");
    await reopened.recoverInterrupted();
    assert.equal((await reopened.list("homologation"))[0].state, "unknown");
    await assert.rejects(reopened.claim(row.id, "admin", "homologation", row.confirmation_hash));
    const event = { EventId: randomUUID(), EventType: "Boleto.Registro", EntityId: "1", OccurredAt: new Date().toISOString() };
    await reopened.receive(event, Buffer.from(JSON.stringify(event)));
    await reopened.receive(event, Buffer.from(JSON.stringify(event)));
    assert.equal((await database.query("SELECT count(*)::int AS count FROM pinbank_dev.events")).rows[0].count, 1);
    await assert.rejects(reopened.receive(event, Buffer.from("altered")), (e: any) => e instanceof BankError && e.code === "EVENT_CONFLICT");
    assert.equal((await database.query("SELECT count(*)::int AS count FROM pinbank_production.operations")).rows[0].count, 0);
    await database.close();
    await assert.rejects(reopened.prepare("admin", "homologation", "balance", randomUUID(), {}));
  } finally { if (!database.closed) await database.close(); await rm(directory, { recursive: true, force: true }); }
});

test("payout preparation freezes the validated recipient; submission remains pending", async () => {
  const calls: string[] = [];
  const transport = new BankTransport(config(), (async url => {
    calls.push(String(url));
    if (String(url).endsWith("/token")) return json({ access_token: "fixture", expires_in: 300 });
    if (String(url).includes("DadosPessoais")) return json({ ResultCode: 0, Data: { RazaoSocial: "Empresa de teste", Cnpj: "00000000000000", Senha: "secret" } });
    return json({ ResultCode: 0, Data: { NSUPinbank: "fixture-nsu", KeyValue: "secret" } });
  }) as typeof fetch);
  const quote = await preparePayout(transport, { type: "internal", amountCents: 1250, recipientChannel: 47, recipientClient: 999 }, "fixture-operation", 3510);
  assert.equal(calls.some(url => url.includes("TransferenciaEntreContas")), false);
  assert.equal(quote.preview.recipient, "Empresa de teste");
  assert.equal(quote.data.Valor, 1250);
  const result = await sendPayout(transport, quote);
  assert.deepEqual(result, { reference: "fixture-nsu", receiptId: null, state: "pending" });
  assert.equal(JSON.stringify(quote.preview).includes("secret"), false);
  assert.deepEqual(publicBankResponse({ raw: { secret: "x" }, nested: { keyLoja: "x", amount: 1 }, provider_payload: {} }), { nested: { amount: 1 } });
});

test("signed event projection is scoped, deduplicated, audited and monotonic", async () => {
  const database = new PGlite();
  try {
    await database.exec(await readFile(new URL("../../migrations/20260909_pinbank_isolation.sql", import.meta.url), "utf8"));
    const store = new BankStore(database as unknown as Pool, "dev");
    const row = await store.prepare("admin", "homologation", "boleto", randomUUID(), { amountCents: 15000 }, { client: 3510, channel: 47 });
    await store.claim(row.id, "admin", "homologation", row.confirmation_hash);
    await store.finish(row.id, "pending", { reference: "fixture-123" }, "fixture-123");
    const event = { EventId: randomUUID(), EventType: "Boleto.Liquidacao", EventVersion: "v1", EntityId: "fixture-123", OccurredAt: new Date().toISOString(), Data: { NossoNumero: "fixture-123", CodigoCliente: 999, CodigoCanal: 47, ValorPago: 150, ModalidadeBoleto: "C", DataPagamento: "2026-09-09" } };
    await store.receive(event, Buffer.from(JSON.stringify(event))); await store.processEvents();
    assert.equal((await store.list("homologation"))[0].state, "pending");
    event.EventId = randomUUID(); event.Data.CodigoCliente = 3510;
    await store.receive(event, Buffer.from(JSON.stringify(event))); await store.processEvents(); await store.processEvents();
    assert.equal((await store.list("homologation"))[0].state, "settled");
    const older = { ...event, EventId: randomUUID(), EventType: "Boleto.Registro", OccurredAt: "2026-09-01T00:00:00Z" };
    await store.receive(older, Buffer.from(JSON.stringify(older))); await store.processEvents();
    const after = (await store.list("homologation"))[0];
    assert.equal(after.state, "settled"); assert.equal(after.result.paymentDate, "2026-09-09");
    const audit = await database.query("SELECT count(*)::int AS count FROM pinbank_dev.operation_history WHERE next_state='settled'");
    assert.equal(audit.rows[0].count, 1);
    assert.equal(bankEventEvidence({ ...event, EventType: "Boleto.Baixa" }), null);
    assert.equal(bankEventEvidence({ ...event, EventVersion: "v2" }), null);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM pinbank_production.operations")).rows[0].count, 0);
  } finally { await database.close(); }
});
