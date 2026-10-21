import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { randomUUID } from "node:crypto";
import { asaasConfig, publicAsaasStatus } from "./config";
import { AsaasTransport, AsaasError } from "./client";
import { AsaasStore } from "./store";
import { registerAsaasFoundation } from "./routes";
import { canReadAsaasAdmin, asaasStatusSchema, asaasBiaStatusSchema, asaasSubaccountCreateSchema, isValidCnpj } from "../../shared/asaas";
import { credentialVaultReady, decryptCredential, encryptCredential } from "./credentials";
import { AsaasSandboxAccounts } from "./accounts";
import { AsaasAccountOperations } from "./operations";

const vaultKey = Buffer.alloc(32, 7).toString("base64");
const fixture = () => asaasConfig({ ASAAS_BASE_ENABLED: "true", ASAAS_BASE_ENVIRONMENT: "sandbox", ASAAS_SANDBOX_API_KEY: "sandbox-fixture-key", ASAAS_SANDBOX_WEBHOOK_TOKEN: "sandbox-fixture-webhook", ASAAS_SANDBOX_WEBHOOK_URL: "https://example.test/api/webhooks/asaas/sandbox", ASAAS_SANDBOX_CREDENTIAL_ENCRYPTION_KEY: vaultKey, ASAAS_BAAS_ENABLED: "true", ASAAS_CONTRIBUTIONS_ENABLED: "true", ASAAS_TRANSFERS_ENABLED: "true" });
const migration = ["20261014_asaas_foundation.sql", "20261020_asaas_sandbox_subaccounts.sql"].map(file => readFileSync(new URL(`../../migrations/${file}`, import.meta.url), "utf8")).join("\n");

const accountInput = () => asaasSubaccountCreateSchema.parse({
  name: "SPE Sandbox Teste", email: "sandbox@example.com", cpfCnpj: "66.625.514/0001-40",
  companyType: "LIMITED", mobilePhone: "11999999999", incomeValue: 25000,
  address: "Avenida Rolf Wiest", addressNumber: "277", complement: "Sala 2",
  province: "Bom Retiro", postalCode: "89223005", taxRegime: "UNKNOWN", environmentConfirmation: true,
});

test("configuração não herda segredos antigos e exige autorização própria por ambiente", async () => {
  const inherited = asaasConfig({ ASAAS_API_KEY: "old-secret", ASAAS_WEBHOOK_TOKEN: "old-token" });
  assert.equal(inherited.apiKey, ""); assert.equal(inherited.webhookToken, ""); assert.equal(inherited.enabled, false);
  assert.equal(publicAsaasStatus(inherited, false).state, "disabled");
  const invalid = asaasConfig({ ASAAS_BASE_ENVIRONMENT: "another", ASAAS_BASE_ENABLED: "true", ASAAS_SANDBOX_API_KEY: "secret" });
  assert.equal(invalid.configurationValid, false); assert.equal(invalid.apiKey, ""); assert.equal(invalid.enabled, false);
  const production = asaasConfig({ ASAAS_BASE_ENVIRONMENT: "production", ASAAS_BASE_ENABLED: "true", ASAAS_SANDBOX_API_KEY: "sandbox-key", ASAAS_PRODUCTION_API_KEY: "prod-key" });
  assert.equal(production.apiKey, "prod-key"); assert.equal(publicAsaasStatus(production, true).state, "configuration_pending");
  await assert.rejects(() => new AsaasTransport(production, (async () => { throw Error("must not call"); }) as typeof fetch).request("/payments", { method: "POST", body: {} }), (error: AsaasError) => error.code === "NOT_CONFIGURED");
  const productionReady=asaasConfig({ASAAS_BASE_ENVIRONMENT:"production",ASAAS_BASE_ENABLED:"true",ASAAS_BAAS_ENABLED:"true",ASAAS_PRODUCTION_OPERATIONS_ENABLED:"true",ASAAS_PRODUCTION_API_KEY:"prod-key",ASAAS_PRODUCTION_WEBHOOK_TOKEN:"prod-token",ASAAS_PRODUCTION_WEBHOOK_URL:"https://example.test/api/webhooks/asaas/production",ASAAS_PRODUCTION_CREDENTIAL_ENCRYPTION_KEY:vaultKey,ASAAS_CONTRIBUTIONS_ENABLED:"true",ASAAS_TRANSFERS_ENABLED:"true"});
  const productionResult=await new AsaasTransport(productionReady,(async(url)=>{assert.equal(url,"https://api.asaas.com/v3/finance/balance");return Response.json({balance:0});}) as typeof fetch).request("/finance/balance");
  assert.equal(productionResult.balance,0);
  const configured = fixture();
  const publicStatus = asaasStatusSchema.parse(publicAsaasStatus(configured, true));
  assert.equal(publicStatus.externalRequestsEnabled, true); assert.equal(publicStatus.operationsEnabled, true);
  assert.equal(publicStatus.credentialVaultReady, true); assert.equal(publicStatus.capabilities.find(item => item.id === "accounts")?.available, true);
  assert.equal(JSON.stringify(publicStatus).includes(configured.apiKey), false);
  assert.equal(JSON.stringify(publicStatus).includes(configured.webhookToken), false);
  for (const role of ["admin", "superadmin"]) assert.equal(canReadAsaasAdmin({ id: "id", role, employee: false }), true);
  for (const role of ["manager", "master", "employee", "user"]) assert.equal(canReadAsaasAdmin({ id: "id", role }), false);
  assert.equal(canReadAsaasAdmin({ id: "id", role: "admin", employee: true }), false);
  assert.equal(canReadAsaasAdmin({ role: "admin" }), false);
});

test("cadastro e cofre Sandbox validam CNPJ e cifram a credencial sem expor o segredo", () => {
  assert.equal(isValidCnpj("66.625.514/0001-40"), true);
  for (const invalid of ["00.000.000/0000-00", "123", "66.625.514/0001-41"]) assert.equal(isValidCnpj(invalid), false);
  assert.equal(accountInput().cpfCnpj, "66625514000140");
  assert.equal(credentialVaultReady(vaultKey), true); assert.equal(credentialVaultReady("short"), false);
  const encrypted = encryptCredential("child-api-key-private", vaultKey);
  assert.equal(JSON.stringify(encrypted).includes("child-api-key-private"), false);
  assert.equal(decryptCredential(encrypted, vaultKey), "child-api-key-private");
  assert.throws(() => decryptCredential(encrypted, Buffer.alloc(32, 8).toString("base64")), (error: AsaasError) => error.code === "CREDENTIAL_KEY_MISMATCH");
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

test("subconta Sandbox é criada uma vez, chave fica cifrada e outra BIA reutiliza a conta da empresa", async t => {
  const pg = new PGlite(); const db = drizzle(pg); t.after(() => pg.close()); await pg.exec(migration);
  let creations = 0;
  const transport = (config: ReturnType<typeof fixture>) => ({ request: async (path: string, options: any = {}) => {
    if (path.startsWith("/accounts?")) return { data: [], hasMore: false };
    if (path === "/accounts" && options.method === "POST") {
      creations++;
      assert.equal(options.body.cpfCnpj, "66625514000140");
      assert.equal(options.body.webhooks[0].authToken, "sandbox-fixture-webhook");
      return { id: "external-account", walletId: "wallet-account", apiKey: "child-api-key-private" };
    }
    if (path === "/myAccount/status") {
      assert.equal(config.apiKey, "child-api-key-private");
      return { general: "APPROVED" };
    }
    throw Error(`Unexpected ${path}`);
  } });
  const store = new AsaasStore(db, "sandbox");
  const service = new AsaasSandboxAccounts(store, fixture(), transport);
  const created = await service.create("bia-one", "actor-one", accountInput());
  assert.equal(created.created, true); assert.equal(created.account?.state, "approved"); assert.equal(creations, 1);
  const reused = await service.create("bia-two", "actor-two", accountInput());
  assert.equal(reused.reused, true); assert.equal(creations, 1);
  assert.equal((await store.accountForBia("bia-one"))?.id, (await store.accountForBia("bia-two"))?.id);
  const credential = (await db.execute(sql`SELECT * FROM asaas_sandbox.account_credentials`)).rows[0];
  assert.equal(JSON.stringify(credential).includes("child-api-key-private"), false);
  assert.equal(decryptCredential({ ciphertext: credential.ciphertext, initializationVector: credential.initialization_vector, authenticationTag: credential.authentication_tag, keyFingerprint: credential.key_fingerprint }, vaultKey), "child-api-key-private");
});

test("timeout de criação fica inconclusivo e não repete POST", async t => {
  const pg = new PGlite(); const db = drizzle(pg); t.after(() => pg.close()); await pg.exec(migration);
  let creations = 0;
  const service = new AsaasSandboxAccounts(new AsaasStore(db, "sandbox"), fixture(), () => ({ request: async (path: string) => {
    if (path.startsWith("/accounts?")) return { data: [], hasMore: false };
    creations++; throw new AsaasError("TIMEOUT", "timeout", 502);
  } }));
  await assert.rejects(() => service.create("bia-timeout", "actor", accountInput()), (error: AsaasError) => error.code === "ACCOUNT_CREATION_UNCONFIRMED");
  await assert.rejects(() => service.create("bia-timeout", "actor", accountInput()), (error: AsaasError) => error.code === "ACCOUNT_CREATION_UNCONFIRMED");
  assert.equal(creations, 1);
});

test("conta aprovada consulta saldo e transfere uma única vez com a credencial cifrada", async t => {
  const pg = new PGlite(); t.after(() => pg.close()); const db = drizzle(pg);
  await pg.exec(migration); const store = new AsaasStore(db, "sandbox"), accountId = randomUUID();
  const encrypted = encryptCredential("child-transfer-key", vaultKey);
  await db.execute(sql`INSERT INTO asaas_sandbox.accounts(id,label,ownership,owner_id,external_account_id,wallet_id,credential_reference,state)
    VALUES(${accountId},'SPE operacional','company','company-hash','account-child','wallet-child','database:aes-256-gcm:v1','approved')`);
  await db.execute(sql`INSERT INTO asaas_sandbox.account_credentials(account_id,ciphertext,initialization_vector,authentication_tag,key_fingerprint)
    VALUES(${accountId},${encrypted.ciphertext},${encrypted.initializationVector},${encrypted.authenticationTag},${encrypted.keyFingerprint})`);
  await db.execute(sql`INSERT INTO asaas_sandbox.bia_accounts(bia_id,account_id) VALUES('bia-transfer',${accountId})`);
  const transfers:any[]=[]; let posts=0;
  const service = new AsaasAccountOperations(store, fixture(), config => ({ request: async (path:string, options:any={}) => {
    assert.equal(config.apiKey, "child-transfer-key");
    if(path==="/finance/balance")return {balance:500};
    if(path==="/transfers?limit=20")return {data:transfers};
    if(path==="/transfers"&&options.method==="POST"){posts++;const item={id:"transfer-fixture",status:"DONE",value:options.body.value,operationType:"PIX",externalReference:options.body.externalReference};transfers.push(item);return item;}
    throw new Error("unexpected path");
  }}));
  assert.equal((await service.overview("bia-transfer")).balance,500);
  const input={destinationType:"PIX" as const,value:25,pixAddressKey:"finance@example.test",pixAddressKeyType:"EMAIL" as const,description:"Teste",idempotencyKey:randomUUID(),confirmation:true};
  const first=await service.transfer("bia-transfer","actor",input);assert.equal(first.operation.state,"completed");
  const repeated=await service.transfer("bia-transfer","actor",input);assert.equal(repeated.operation.state,"completed");assert.equal(posts,1);
  await assert.rejects(()=>service.transfer("bia-transfer","actor",{...input,value:501,idempotencyKey:randomUUID()}),(error:AsaasError)=>error.code==="INSUFFICIENT_BALANCE");
  assert.deepEqual((await db.execute(sql`SELECT kind,state,external_id FROM asaas_sandbox.operations`)).rows,[{kind:"transfer_pix",state:"completed",external_id:"transfer-fixture"}]);
});

test("rotas: admin restrito, escopo da BIA, consulta sem escrita e webhook Sandbox sem efeitos financeiros", async t => {
  const pg = new PGlite(); const db = drizzle(pg); t.after(() => pg.close()); await pg.exec(migration);
  const accountId = randomUUID();
  await db.execute(sql`INSERT INTO asaas_sandbox.accounts (id,label,ownership,external_account_id,credential_reference) VALUES (${accountId},'SPE teste','company','external-private','vault-private')`);
  await db.execute(sql`INSERT INTO asaas_sandbox.bia_accounts (bia_id,account_id) VALUES ('canonical-bia',${accountId})`);
  let config = fixture(); let broken = false;
  let routeCreations = 0, statusQueries = 0;
  const app = express(); app.use(express.json({ limit: "100kb" }));
  const database = { execute: (query: any) => { if (broken) throw Error("database-password-private"); return db.execute(query); } };
  registerAsaasFoundation(app, {
    db: database, config: () => config,
    resolvePrincipal: async req => req.get("x-role") ? { id: "session-user", role: req.get("x-role")!, employee: req.get("x-employee") === "true" } : null,
    authorizeBia: async (req, res, biaId, required = "view") => {
      if (!req.get("x-role")) { res.status(401).json({ error: "auth" }); return null; }
      if (required === "edit" && req.get("x-edit") !== "true") { res.status(403).json({ error: "edit" }); return null; }
      if (biaId === "own") return { id: "canonical-bia", actorId: "session-user" };
      if (biaId === "own-create") return { id: "canonical-create", actorId: "session-user" };
      res.status(403).json({ error: "scope" }); return null;
    },
    accountTransport: childConfig => ({ request: async (path: string, options: any = {}) => {
      if (path.startsWith("/accounts?")) return { data: [], hasMore: false };
      if (path === "/accounts" && options.method === "POST") { routeCreations++; return { id: "route-external", walletId: "route-wallet", apiKey: "route-child-key" }; }
      if (path === "/myAccount/status") { statusQueries++; assert.equal(childConfig.apiKey, "route-child-key"); return { general: "APPROVED" }; }
      throw Error(`Unexpected ${path}`);
    } }),
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
  assert.equal(bia.account?.label, "SPE teste"); assert.equal(bia.operationsEnabled, true);
  assert.equal(bia.accountCreationAvailable, true);
  assert.deepEqual(bia.integrationPending, []);
  assert.equal(JSON.stringify(bia).includes("private"), false);
  const createUrl = `http://127.0.0.1:${port}/api/bias/own-create/banco/asaas/accounts`;
  assert.equal((await fetch(createUrl, { method: "POST", headers: { "content-type": "application/json", "x-role": "user" }, body: JSON.stringify(accountInput()) })).status, 403);
  const createdResponse = await fetch(createUrl, { method: "POST", headers: { "content-type": "application/json", "x-role": "user", "x-edit": "true" }, body: JSON.stringify(accountInput()) });
  assert.equal(createdResponse.status, 201); assert.equal(routeCreations, 1);
  const createdBody = await createdResponse.json(); assert.equal(JSON.stringify(createdBody).includes("route-child-key"), false); assert.equal(createdBody.account.state, "approved");
  const refreshUrl = `http://127.0.0.1:${port}/api/bias/own-create/banco/asaas/account/refresh`;
  const previousQueries = statusQueries;
  assert.equal((await fetch(refreshUrl, { method: "POST", headers: { "x-role": "user" } })).status, 403);
  assert.equal(statusQueries, previousQueries);
  for (let repetition = 0; repetition < 2; repetition++) {
    const refreshed = await fetch(refreshUrl, { method: "POST", headers: { "x-role": "user", "x-edit": "true" } });
    assert.equal(refreshed.status, 200);
    const refreshedBody = await refreshed.json();
    assert.equal(refreshedBody.account.state, "approved");
    assert.equal(JSON.stringify(refreshedBody).includes("route-child-key"), false);
  }
  assert.equal(statusQueries, previousQueries + 2);
  assert.equal(routeCreations, 1, "consultar novamente não cria subconta ou cobrança");
  config = { ...config, chargesEnabled: false, transfersEnabled: false };
  const pending = asaasBiaStatusSchema.parse(await (await get("/api/bias/own-create/banco/asaas/status", "user")).json());
  assert.equal(pending.account?.state, "approved");
  assert.equal(pending.chargesEnabled, false);
  assert.deepEqual(pending.integrationPending, ["Habilitar cobranças de aportes neste ambiente.", "Habilitar transferências neste ambiente."]);
  assert.equal(statusQueries, previousQueries + 2, "consultar configuração não chama o provedor");
  assert.equal(JSON.stringify(pending).includes("route-child-key"), false);
  config = fixture();
  assert.deepEqual((await db.execute(sql`SELECT kind,state FROM asaas_sandbox.operations`)).rows, [{ kind: "create_subaccount", state: "completed" }]);
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
  assert.deepEqual((await db.execute(sql`SELECT kind,state FROM asaas_sandbox.operations`)).rows, [{ kind: "create_subaccount", state: "completed" }]);
});
