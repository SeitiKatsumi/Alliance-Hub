import type { Express, Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { BankError, bankConfig, type BankEnvironment } from "./config";
import { BankTransport } from "./transport";
import { BankStore } from "./store";
import { BankWebhookVerifier } from "./webhook";
import { bankInputs, bankMethodLabels, assertMethod, executeBankMethod, isReadMethod, methodProduct, type BankMethod } from "./methods";
import { payoutInput, preparePayout, sendPayout } from "./payouts";
import { reconcileDev } from "./reconcile";
import { companyInput, companyContract, validateBankDocument } from "./onboarding";
import multer from "multer";
import { publicBankResponse } from "./redact";
import { bankReceiptPdf } from "./receipt";
import { registerProductionBankRoutes, type ProductionBankDependencies } from "./production";
import { observeDatabasePoolErrors } from "../database-pool-errors";

const preparation = z.object({ method: z.enum(Object.keys(bankInputs) as [BankMethod, ...BankMethod[]]), input: z.unknown(), idempotencyKey: z.string().uuid(), fictitiousData: z.literal(true) }).strict();
const confirmation = z.object({ confirmation: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const eventEnvelope = z.object({ EventId: z.string().uuid(), EventType: z.string().min(1).max(150), EventVersion: z.literal("v1"), EntityId: z.string().min(1).max(200), OccurredAt: z.string().datetime({ offset: true }), Data: z.record(z.unknown()) });

export function bankFailure(error: unknown, res: Response) {
  if (error instanceof z.ZodError) return res.status(400).json({ code: "INVALID_INPUT", error: "Confira os campos obrigatórios e o formato dos dados." });
  if (error instanceof BankError) return res.status(error.status).json({ code: error.code, error: error.message });
  return res.status(503).json({ code: "SERVICE_UNAVAILABLE", error: "Serviço bancário indisponível. Nenhum sucesso foi confirmado; consulte o histórico antes de tentar novamente." });
}
export function bankAdminAllowed(identity: string | undefined, role: string, employee: unknown) {
  return Boolean(identity) && !employee && ["admin", "superadmin"].includes(role);
}

export function registerPinbankRoutes(app: Express, getRole: (req: Request) => Promise<string>, options: { pool?: Pool; fetcher?: typeof fetch; production?: ProductionBankDependencies } = {}) {
  const pool = options.pool || new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
  if (!options.pool) observeDatabasePoolErrors(pool, "pinbank");
  const config = bankConfig("dev");
  const transport = new BankTransport(config, options.fetcher);
  const store = new BankStore(pool, "dev");
  const verifier = new BankWebhookVerifier(options.fetcher);
  let reconciling = false;
  const timer = setInterval(async () => {
    if (reconciling) return;
    reconciling = true;
    try { await reconcileDev(store, transport); } catch { /* Disabled/unmigrated installs remain fail-closed. */ }
    finally { reconciling = false; }
  }, 60_000);
  timer.unref();
  const base = "/api/admin/pinbank/dev";
  if (options.production) registerProductionBankRoutes(app, pool, options.production);
  function assertPayout(type: string) {
    if (!config.enabled || !config.newOperationsEnabled) throw new BankError("NEW_OPERATIONS_DISABLED", "Novas saídas DEV desabilitadas.", 409);
    if (!config.methods.has("payout_" + type)) throw new BankError("METHOD_PENDING", "Saída pendente de habilitação pela Pinbank.", 409);
  }
  app.use(base, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.session as any;
      if (!session?.directusUserId) return res.status(401).json({ error: "Não autenticado." });
      if (!bankAdminAllowed(session.directusUserId, await getRole(req), session.companyEmployeeId)) return res.status(403).json({ error: "Homologação exclusiva para administradores." });
      res.setHeader("Cache-Control", "no-store");
      const json = res.json.bind(res);
      res.json = body => json(publicBankResponse(body));
      next();
    } catch (error) { bankFailure(error, res); }
  });
  app.get(base + "/status", async (_req, res) => {
    let storageReady = false;
    try { await store.ready(); storageReady = true; } catch { /* No fallback storage. */ }
    res.json({ environment: "dev", enabled: config.enabled, newOperationsEnabled: config.newOperationsEnabled,
      credentialsPresent: Boolean(config.username && config.keyValue), storageReady, termsConfigured: Boolean(config.termCode),
      methods: Object.entries(bankMethodLabels).map(([id, label]) => ({ id, label, enabled: config.methods.has(id) && (id !== "terms" || !!config.termCode) })),
      pending: ["Validar credenciais e métodos habilitados no servidor", "Homologar conta PJ, documentos, recebimentos e saídas com a Pinbank", "Cadastrar e validar webhooks DEV", "Completar conciliação de todas as modalidades e baixa financeira de produção", "Preparar backup e validar restauração antes da publicação"],
    });
  });
  app.get(base + "/operations", async (_req, res) => {
    try { await store.recoverInterrupted(); res.json(await store.list("homologation")); } catch (error) { bankFailure(error, res); }
  });
  app.get(base + "/operations/:id/receipts/:receiptId/pdf", async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const receiptId = z.coerce.number().int().positive().safe().parse(req.params.receiptId);
      const operation = await store.getOperation(id, "homologation");
      const receipt = operation?.method === "receipt" && operation.state === "completed" ? operation.result?.receipts?.find((item: any) => item.id === receiptId) : undefined;
      if (!receipt) throw new BankError("RECEIPT_NOT_FOUND", "Comprovante DEV não encontrado.", 404);
      const pdf = bankReceiptPdf(receipt.pdfBase64);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="comprovante-dev-${receiptId}.pdf"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(pdf);
    } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/prepare", async (req, res) => {
    try {
      const body = preparation.parse(req.body);
      assertMethod(config, body.method);
      const input = bankInputs[body.method].parse(body.input);
      let client = config.clients[methodProduct(body.method)];
      if ("accountOperationId" in input && typeof input.accountOperationId === "string") {
        const account = await store.getOperation(input.accountOperationId, "homologation");
        if (account?.method !== "company" || !account?.result?.client) throw new BankError("ACCOUNT_PENDING", "Cadastro PJ DEV não encontrado.", 409);
        client = Number(account.result.client);
      }
      const row = await store.prepare((req.session as any).directusUserId, "homologation", body.method, body.idempotencyKey, input, { client, channel: config.channel });
      res.status(201).json({ id: row.id, state: row.state, confirmation: row.confirmation_hash, environment: "dev", method: body.method, input, origin: { channel: config.channel, client }, expiresAt: new Date(new Date(row.created_at).getTime() + 600_000).toISOString() });
    } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/payouts/prepare", async (req, res) => {
    let reserved: any;
    try {
      const body = z.object({ input: payoutInput, idempotencyKey: z.string().uuid(), fictitiousData: z.literal(true) }).strict().parse(req.body);
      assertPayout(body.input.type);
      const row = await store.prepare((req.session as any).directusUserId, "homologation", "payout_" + body.input.type, body.idempotencyKey, body.input, { client: ["pix", "refund"].includes(body.input.type) ? config.clients.pix : config.clients.banking, channel: config.channel });
      let prepared = row;
      if (!row.quote) {
        reserved = await store.reserveQuote(row.id, (req.session as any).directusUserId, "homologation");
        const quote = await preparePayout(transport, body.input, row.id, ["pix", "refund"].includes(body.input.type) ? config.clients.pix : config.clients.banking);
        prepared = await store.saveQuote(row.id, quote, quote.preview);
      }
      res.json({ id: prepared.id, state: prepared.state, confirmation: prepared.confirmation_hash, environment: "dev", preview: prepared.preview });
    } catch (error) {
      if (reserved) { try { await store.failQuote(reserved.id); } catch {} }
      bankFailure(error, res);
    }
  });
  app.get(base + "/company/contract", (_req, res) => res.json(companyContract));
  app.post(base + "/terms/accept", async (req, res) => {
    try {
      const body = z.object({ operationId: z.string().uuid(), accepted: z.literal(true) }).strict().parse(req.body);
      await store.acceptTerms(body.operationId, (req.session as any).directusUserId);
      res.json({ accepted: true });
    } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/company/prepare", async (req, res) => {
    try {
      const body = z.object({ input: companyInput, termsOperationId: z.string().uuid(), idempotencyKey: z.string().uuid(), fictitiousData: z.literal(true) }).strict().parse(req.body);
      if (!config.enabled || !config.newOperationsEnabled || !config.methods.has("company")) throw new BankError("METHOD_PENDING", "Cadastro PJ pendente de habilitação.", 409);
      const termVersion = await store.termsForActor(body.termsOperationId, (req.session as any).directusUserId);
      if (!config.termCode) throw new BankError("TERMS_PENDING", "CodigoTermo ainda não configurado.", 409);
      const row = await store.prepare((req.session as any).directusUserId, "homologation", "company", body.idempotencyKey, { ...body.input, IdTermo: Number(termVersion), CodigoCanal: config.channel, EnviarEmailPrimAcesso: false }, { client: config.clients.banking, channel: config.channel });
      res.json({ id: row.id, state: row.state, confirmation: row.confirmation_hash, environment: "dev", preview: { name: body.input.RazaoSocial, document: body.input.CNPJ, termVersion } });
    } catch (error) { bankFailure(error, res); }
  });
  const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 6 } }).single("file");
  app.post(base + "/documents/prepare", (req, res) => {
    documentUpload(req, res, async error => {
      if (error) return bankFailure(new BankError("INVALID_FILE", "Documento inválido ou maior que 8 MB.", 400), res);
      try {
        const body = z.object({ type: z.coerce.number().int().min(4).max(8), oldDocumentId: z.coerce.number().int().positive().optional(), accountOperationId: z.string().uuid(), idempotencyKey: z.string().uuid(), fictitiousData: z.literal("true") }).strict().parse(req.body);
        if (!config.newOperationsEnabled || !config.methods.has("document_upload")) throw new BankError("METHOD_PENDING", "Envio de documentos pendente de habilitação.", 409);
        const account = await store.getOperation(body.accountOperationId, "homologation");
        if (account?.method !== "company" || !account?.result?.client) throw new BankError("ACCOUNT_PENDING", "Conta PJ DEV não confirmada.", 409);
        if (body.oldDocumentId && !(await store.ownsDocument(account.result.client, body.oldDocumentId, body.type))) throw new BankError("DOCUMENT_NOT_OWNED", "Documento anterior não pertence à conta DEV selecionada.", 403);
        if (!req.file) throw new BankError("INVALID_FILE", "Selecione um documento.", 400);
        const file = validateBankDocument(req.file.buffer, req.file.originalname);
        const document = { TipoDocumento: body.type, NomeArquivo: file.filename, FormatoArquivo: file.mime, Base64Arquivo: req.file.buffer.toString("base64") };
        const payload = body.oldDocumentId ? { CodigoCliente: account.result.client, CodigoCanal: config.channel, TipoDocumentoAntigo: body.type, CodigoDocumentoAntigo: body.oldDocumentId, DocumentoNovo: document } : { CodigoCliente: account.result.client, CodigoCanal: config.channel, RgCnhPossuiNumeroCpf: true, ListaDocumentos: [document] };
        const row = await store.prepare((req.session as any).directusUserId, "homologation", body.oldDocumentId ? "document_replace" : "document_upload", body.idempotencyKey, payload, { client: account.result.client, channel: config.channel });
        res.json({ id: row.id, state: row.state, confirmation: row.confirmation_hash, environment: "dev", preview: { filename: file.filename, type: body.type, client: account.result.client } });
      } catch (error) { bankFailure(error, res); }
    });
  });
  app.post(base + "/operations/:id/confirm", async (req, res) => {
    let claimed: any;
    try {
      const id = z.string().uuid().parse(req.params.id);
      const body = confirmation.parse(req.body);
      // Authentication before claim avoids uncertain-operation status when credentials are absent.
      await transport.token();
      // Recheck the server-side switch before any provider operation, including a prepared one.
      claimed = await store.claim(id, (req.session as any).directusUserId, "homologation", body.confirmation);
      const method = claimed.method as BankMethod;
      if (["company", "document_upload", "document_replace"].includes(claimed.method)) {
        if (!config.newOperationsEnabled || !config.methods.has(claimed.method === "document_replace" ? "document_upload" : claimed.method)) throw new BankError("METHOD_PENDING", "Método desabilitado.", 409);
        const path = claimed.method === "company" ? "/api/ContaDigital/CadastroPj" : claimed.method === "document_upload" ? "/api/ContaDigital/IncluirDocumento" : "/api/ContaDigital/AlterarDocumento";
        const provider = await transport.call(path, claimed.request);
        const result = claimed.method === "company" ? { client: Number(provider?.CodigoCliente), state: "in_review" } : { documents: (Array.isArray(provider) ? provider : [provider]).map((d: any) => ({ id: d?.CodigoDocumento, type: d?.TipoDocumento, filename: d?.NomeArquivo })) };
        if (claimed.method === "company" && !("client" in result && Number.isSafeInteger(result.client) && Number(result.client) > 0)) throw new BankError("RESULT_UNKNOWN", "Cadastro sem código de cliente confirmado.");
        if ("documents" in result && (!result.documents?.length || result.documents.some((d: any) => !Number.isSafeInteger(d.id) || d.id <= 0))) throw new BankError("RESULT_UNKNOWN", "Documento sem identificador confirmado.");
        await store.finish(id, "pending", result);
        return res.json({ id, environment: "dev", state: "pending", result });
      }
      if (claimed.method.startsWith("payout_")) {
        assertPayout(claimed.method.slice(7));
        if (!claimed.quote) throw new BankError("INVALID_QUOTE", "Prepare a saída novamente.", 409);
        const result = await sendPayout(transport, claimed.quote);
        await store.finish(id, "pending", result, result.reference);
        return res.json({ id, environment: "dev", state: "pending", result });
      }
      assertMethod(config, method);
      const result = await executeBankMethod(transport, method, bankInputs[method].parse(claimed.request), id, Number(claimed.origin_client), Number(claimed.origin_nsu));
      await store.finish(id, isReadMethod(method) ? "completed" : "pending", result, "reference" in result ? result.reference : undefined);
      res.json({ id, environment: "dev", state: isReadMethod(method) ? "completed" : "pending", result });
    } catch (error) {
      if (claimed) {
        const rejected = error instanceof BankError && ["PROVIDER_REJECTED", "METHOD_PENDING", "NEW_OPERATIONS_DISABLED", "TERMS_PENDING"].includes(error.code);
        try { await store.finish(claimed.id, rejected ? "rejected" : "unknown", { code: error instanceof BankError ? error.code : "RESULT_UNKNOWN" }); } catch { /* Existing sending intent remains durable; never resend. */ }
      }
      bankFailure(error, res);
    }
  });
  for (const environment of ["dev", "production"] as BankEnvironment[]) {
    app.post(`/api/pinbank/webhooks/${environment}`, async (req, res) => {
      try {
        const prefix = environment === "dev" ? "PINBANK_DEV_" : "PINBANK_PROD_";
        const expected = process.env[prefix + "WEBHOOK_TOKEN"] || "";
        const other = process.env[(environment === "dev" ? "PINBANK_PROD_" : "PINBANK_DEV_") + "WEBHOOK_TOKEN"];
        if (expected && expected === other) throw new BankError("WEBHOOK_ENVIRONMENT_CONFLICT", "Configuração de ambientes do webhook inválida.");
        const supplied = req.get("X-Pinbank-Environment-Token") || "";
        if (!expected || expected.length < 32 || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new BankError("INVALID_WEBHOOK", "Webhook não autorizado.", 401);
        if (!Buffer.isBuffer(req.rawBody)) throw new BankError("INVALID_BODY", "Corpo original indisponível.", 400);
        await verifier.validate(req.rawBody, { timestamp: req.get("Webhook-Timestamp"), signature: req.get("Webhook-Signature"), kid: req.get("Webhook-Key-Id") });
        const event = eventEnvelope.parse(JSON.parse(req.rawBody.toString("utf8")));
        if (req.get("Webhook-Id") !== event.EventId) throw new BankError("INVALID_WEBHOOK", "Identificador divergente.", 400);
        await new BankStore(pool, environment).receive(event, req.rawBody);
        res.status(202).json({ received: true });
      } catch (error) { bankFailure(error, res); }
    });
  }
}
