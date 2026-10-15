import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { randomUUID } from "node:crypto";
import { asaasConfig, publicAsaasStatus } from "./config";
import { AsaasClient, AsaasTransport, AsaasError } from "./client";
import { AsaasStore } from "./store";
import { registerAsaasFoundation } from "./routes";
import { canReadAsaasAdmin, asaasStatusSchema, asaasBiaStatusSchema } from "../../shared/asaas";

const fixture = () => asaasConfig({ ASAAS_BASE_ENABLED: "true", ASAAS_BASE_ENVIRONMENT: "sandbox", ASAAS_SANDBOX_API_KEY: "sandbox-fixture-key", ASAAS_SANDBOX_WEBHOOK_TOKEN: "sandbox-fixture-webhook", ASAAS_BAAS_ENABLED: "true" });
const migration = readFileSync(new URL("../../migrations/20261014_asaas_foundation.sql", import.meta.url), "utf8");

test("configuração não herda segredos antigos e mantém produção e operações bloqueadas", async () => {
  const inherited = asaasConfig({ ASAAS_API_KEY: "old-secret", ASAAS_WEBHOOK_TOKEN: "old-token" });
  assert.equal(inherited.apiKey, ""); assert.equal(inherited.webhookToken, ""); assert.equal(inherited.enabled, false);
  assert.equal(publicAsaasStatus(inherited, false).state, "disabled");
  const invalid = asaasConfig({ ASAAS_BASE_ENVIRONMENT: "another", ASAAS_BASE_ENABLED: "true", ASAAS_SANDBOX_API_KEY: "secret" });
  assert.equal(invalid.configurationValid, false); assert.equal(invalid.apiKey, ""); assert.equal(invalid.enabled, false);
  const production = asaasConfig({ ASAAS_BASE_ENVIRONMENT: "production", ASAAS_BASE_ENABLED: "true", ASAAS_SANDBOX_API_KEY: "sandbox-key", ASAAS_PRODUCTION_API_KEY: "prod-key" });
  assert.equal(production.apiKey, ""); assert.equal(publicAsaasStatus(production, true).state, "production_blocked");
  await assert.rejects(() => new AsaasClient(production).request("POST", "/payments"), (error: AsaasError) => error.code === "PRODUCTION_BLOCKED");
  const configured = fixture();
  for (const method of ["GET", "POST", "PUT", "DELETE"] as const) await assert.rejects(() => new AsaasClient(configured).request(method, "/payments"), (error: AsaasError) => error.code === "EXTERNAL_REQUESTS_DISABLED");
  const publicStatus = asaasStatusSchema.parse(publicAsaasStatus(configured, true));
  assert.equal(publicStatus.externalRequestsEnabled, false); assert.equal(publicStatus.operationsEnabled, false);
  assert.equal(JSON.stringify(publicStatus).includes(configured.apiKey), false);
  assert.equal(JSON.stringify(publicStatus).includes(configured.webhookToken), false);
  for (const role of ["admin", "superadmin"]) assert.equal(canReadAsaasAdmin({ id: "id", role, employee: false }), true);
  for (const role of ["manager", "master", "employee", "user"]) assert.equal(canReadAsaasAdmin({ id: "id", role }), false);
  assert.equal(canReadAsaasAdmin({ id: "id", role: "admin", employee: true }), false);
  assert.equal(canReadAsaasAdmin({ role: "admin" }), false);
});

test("transporte Sandbox: host fixo, autenticação, JSON, falhas sanitizadas e timeout sem repetição", async () => {
  let calls = 0;
  const transport = new AsaasTransport(fixture(), (async (url, options) => {
    calls++;
    assert.equal(url, "https://api-sandbox.asaas.com/v3/customers?limit=1");
    assert.equal(options?.method, "GET"); assert.equal(options?.redirect, "error");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("access_token"), "sandbox-fixture-key"); assert.equal(headers.get("user-agent"), "BUILT/1.0");
    return Response.json({ data: [] });
  }) as typeof fetch);
  assert.deepEqual(await transport.request("/customers?limit=1"), { data: [] }); assert.equal(calls, 1);
  for (const endpoint of ["https://evil.invalid", "//evil.invalid", "/../payments", "/customers#fragment", "/%2e%2e/payments"]) await assert.rejects(() => transport.request(endpoint), (error: AsaasError) => error.code === "INVALID_ENDPOINT");
  assert.equal(calls, 1);
  for (const response of [new Response("secret", { status: 401 }), new Response("<html>secret</html>", { headers: { "content-type": "text/html" } }), new Response("bad", { headers: { "content-type": "application/json" } }), Response.json([])]) {
    await assert.rejects(() => new AsaasTransport(fixture(), (async () => response) as typeof fetch).request("/customers"), (error: AsaasError) => !error.message.includes("secret") && error.status === 502);
  }
  let attempts = 0;
  await assert.rejects(() => new AsaasTransport(fixture(), (async (_url, options) => {
    attempts++; return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(Error("private error")), { once: true }));
  }) as typeof fetch, 10).request("/customers"), (error: AsaasError) => error.code === "TIMEOUT");
  assert.equal(attempts, 1);
  let creations = 0;
  const failingCreation = new AsaasTransport(fixture(), (async (_url, options) => {
    creations++; assert.equal(options?.method, "POST"); assert.equal(new Headers(options?.headers).get("content-type"), "application/json");
    assert.equal(options?.body, JSON.stringify({ value: 123.45 })); throw Error("provider secret details");
  }) as typeof fetch);
  await assert.rejects(() => failingCreation.request("/payments", { method: "POST", body: { value: 123.45 } }), (error: AsaasError) => error.code === "TRANSPORT_ERROR" && !error.message.includes("secret"));
  assert.equal(creations, 1, "Uma criação não pode ser repetida automaticamente");
  await assert.rejects(() => new AsaasTransport(asaasConfig({ ASAAS_BASE_ENVIRONMENT: "production" }), (async () => { throw Error("must not call"); }) as typeof fetch).request("/customers"), (error: AsaasError) => error.code === "NOT_CONFIGURED");
});

test("migração aditiva: isolamento, várias BIAs por conta, idempotência, concorrência e estados", async t => {
  const pg = new PGlite(); t.after(() => pg.close());
  const db = drizzle(pg); const sandbox = new AsaasStore(db, "sandbox"); const production = new AsaasStore(db, "production");
  assert.equal(await sandbox.storageReady(), false);
  await pg.exec(migration); await pg.exec(migration);
  assert.equal(await sandbox.storageReady(), true); assert.equal(await production.storageReady(), true);
  const accountId = randomUUID();
  await db.execute(sql`INSERT INTO asaas_sandbox.accounts (id,label,ownership,owner_id) VALUES (${accountId},'SPE teste','company','company-test')`);
  await db.execute(sql`INSERT INTO asaas_sandbox.bia_accounts (bia_id,account_id) VALUES ('bia-a',${accountId}),('bia-b',${accountId})`);
  assert.equal((await sandbox.accountForBia("bia-a"))?.id, accountId); assert.equal((await sandbox.accountForBia("bia-b"))?.id, accountId);
  assert.equal(await production.accountForBia("bia-a"), null);
  const input = { biaId: "bia-a", accountId, actorId: "operator", kind: "charge", amountCents: 12345, externalReference: "charge-test", idempotencyKey: "same-key", request: { description: "Test", customer: "test" } };
  const [first, second] = await Promise.all([sandbox.prepareOperation(input), sandbox.prepareOperation({ ...input, request: { customer: "test", description: "Test" } })]);
  assert.equal(first.id, second.id); assert.equal(first.state, "prepared");
  await assert.rejects(() => sandbox.prepareOperation({ ...input, amountCents: 456 }), (error: AsaasError) => error.code === "IDEMPOTENCY_CONFLICT");
  for (const value of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(() => sandbox.prepareOperation({ ...input, amountCents: value }), (error: AsaasError) => error.code === "INVALID_AMOUNT");
  const separate = await production.prepareOperation({ ...input, accountId: null }); assert.notEqual(separate.id, first.id);
  assert.equal((await sandbox.transition(first.id, "prepared", "sent")).state, "sent");
  assert.equal((await sandbox.transition(first.id, "sent", "unknown")).state, "unknown");
  await assert.rejects(() => sandbox.transition(first.id, "sent", "completed"), (error: AsaasError) => error.code === "OPERATION_CONFLICT");
  assert.equal((await sandbox.transition(first.id, "unknown", "completed")).state, "completed");
  await assert.rejects(() => sandbox.transition(first.id, "completed", "sent"), (error: AsaasError) => error.code === "INVALID_TRANSITION");
  assert.equal((await db.execute(sql`SELECT count(*) AS count FROM asaas_sandbox.operations`)).rows[0].count, 1);
});

test("rotas: admin restrito, escopo da BIA, consulta sem escrita e webhook Sandbox sem efeitos financeiros", async t => {
  const pg = new PGlite(); const db = drizzle(pg); t.after(() => pg.close()); await pg.exec(migration);
  const accountId = randomUUID();
  await db.execute(sql`INSERT INTO asaas_sandbox.accounts (id,label,ownership,external_account_id,credential_reference) VALUES (${accountId},'SPE teste','company','external-private','vault-private')`);
  await db.execute(sql`INSERT INTO asaas_sandbox.bia_accounts (bia_id,account_id) VALUES ('canonical-bia',${accountId})`);
  let config = fixture(); let broken = false;
  const app = express(); app.use(express.json({ limit: "100kb" }));
  const database = { execute: (query: any) => { if (broken) throw Error("database-password-private"); return db.execute(query); } };
  registerAsaasFoundation(app, {
    db: database, config: () => config,
    resolvePrincipal: async req => req.get("x-role") ? { id: "session-user", role: req.get("x-role")!, employee: req.get("x-employee") === "true" } : null,
    authorizeBia: async (req, res, biaId) => {
      if (!req.get("x-role")) { res.status(401).json({ error: "auth" }); return null; }
      if (biaId !== "own") { res.status(403).json({ error: "scope" }); return null; }
      return { id: "canonical-bia" };
    },
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const port = (server.address() as { port: number }).port;
  const get = (path: string, role?: string, employee = false) => fetch(`http://127.0.0.1:${port}${path}`, { headers: { ...(role ? { "x-role": role } : {}), "x-employee": String(employee) } });
  const admin = "/api/admin/asaas/status";
  assert.equal((await get(admin)).status, 401);
  for (const role of ["manager", "master", "user"]) assert.equal((await get(admin, role)).status, 403);
  assert.equal((await get(admin, "admin", true)).status, 403);
  for (const role of ["admin", "superadmin"]) assert.equal((await get(admin, role)).status, 200);
  assert.equal((await get("/api/bias/other/banco/asaas/status", "user")).status, 403);
  const bia = asaasBiaStatusSchema.parse(await (await get("/api/bias/own/banco/asaas/status", "user")).json());
  assert.equal(bia.account?.label, "SPE teste"); assert.equal(bia.operationsEnabled, false);
  assert.equal(JSON.stringify(bia).includes("private"), false);
  assert.equal((await db.execute(sql`SELECT count(*) AS count FROM asaas_sandbox.operations`)).rows[0].count, 0);
  const post = (body: unknown, token = "sandbox-fixture-webhook") => fetch(`http://127.0.0.1:${port}/api/webhooks/asaas/sandbox`, { method: "POST", headers: { "content-type": "application/json", "asaas-access-token": token }, body: JSON.stringify(body) });
  const event = { id: "evt_test&1", event: "PAYMENT_RECEIVED", account: { id: "acc-test" }, payment: { id: "pay-test", customer: { cpfCnpj: "document-private" }, access_token: "key-private" } };
  assert.equal((await post(event, "wrong")).status, 401);
  assert.equal((await post({ event: "PAYMENT_RECEIVED" })).status, 400);
  const malformed = await fetch(`http://127.0.0.1:${port}/api/webhooks/asaas/sandbox`, { method: "POST", headers: { "content-type": "application/json", "asaas-access-token": "sandbox-fixture-webhook" }, body: '{"private":' });
  assert.equal(malformed.status, 400); assert.equal((await malformed.text()).includes("private"), false);
  assert.equal((await post({ ...event, extra: "x".repeat(110 * 1024) })).status, 413);
  const first = await (await post(event)).json(); const duplicate = await (await post(event)).json();
  assert.equal(first.financialEffects, false); assert.equal(first.duplicate, false); assert.equal(duplicate.duplicate, true);
  assert.equal((await post({ ...event, payment: { id: "other-payment" } })).status, 409);
  const stored = (await db.execute(sql`SELECT * FROM asaas_sandbox.events`)).rows;
  assert.equal(stored.length, 1); assert.equal(stored[0].state, "received"); assert.equal(JSON.stringify(stored).includes("private"), false);
  assert.equal((await db.execute(sql`SELECT count(*) AS count FROM asaas_production.events`)).rows[0].count, 0);
  config = asaasConfig({ ASAAS_BASE_ENABLED: "true", ASAAS_BASE_ENVIRONMENT: "production", ASAAS_SANDBOX_WEBHOOK_TOKEN: "sandbox-fixture-webhook" });
  assert.equal((await post(event)).status, 503);
  config = fixture(); broken = true;
  assert.equal((await post(event)).status, 503);
  const unavailable = asaasStatusSchema.parse(await (await get(admin, "admin")).json()); assert.equal(unavailable.storageReady, false);
  const unavailableBia = asaasBiaStatusSchema.parse(await (await get("/api/bias/own/banco/asaas/status", "user")).json()); assert.equal(unavailableBia.storageReady, false);
  assert.equal((await db.execute(sql`SELECT count(*) AS count FROM asaas_sandbox.operations`)).rows[0].count, 0);
});
