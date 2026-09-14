import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { bankConfig, BankError } from "./config";
import { BankStore } from "./store";
import { BankTransport } from "./transport";
import { payoutInput, preparePayout, sendPayout } from "./payouts";
import { bankFailure } from "./routes";

export type BiaBankAuthority = { biaId: string; userId: string; memberId: string; canManage: boolean; participantIds: string[]; canEditFinance: boolean };
export type ProductionBankDependencies = {
  authorize: (req: Request, res: Response) => Promise<BiaBankAuthority | null>;
  readLedger: (id: string) => Promise<any>;
  updateLedger: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
};

export function assertLedgerBinding(entry: any, biaId: string, amountCents: number, direction: "entrada" | "saida", operationId?: string) {
  const entryBia = typeof entry?.bia === "object" ? entry.bia?.id : entry?.bia;
  if (!entry?.id || String(entryBia) !== biaId || entry.tipo !== direction || !Number.isFinite(Number(entry.valor)) || Math.round(Number(entry.valor) * 100) !== amountCents) throw new BankError("INVALID_LEDGER", "Lançamento incompatível com a BIA, o tipo ou o valor da operação.", 409);
  if (["pago", "parcial", "cancelado"].includes(entry.status)) throw new BankError("PROTECTED_LEDGER", "Lançamento já possui evidência financeira.", 409);
  if (entry.pagamento_id && entry.pagamento_id !== operationId) throw new BankError("LEDGER_ALREADY_BOUND", "Lançamento vinculado a outra operação.", 409);
}

export function registerProductionBankRoutes(app: Express, pool: Pool, deps: ProductionBankDependencies) {
  const config = bankConfig("production");
  const store = new BankStore(pool, "production");
  const transport = new BankTransport(config);
  const base = "/api/bias/:biaId/banco/saidas";
  async function grant(authority: BiaBankAuthority) {
    if (!authority.memberId || !authority.canEditFinance) return false;
    const result = await pool.query("SELECT 1 FROM pinbank_production.execution_grants WHERE bia_id=$1 AND member_id=$2 AND revoked_at IS NULL", [authority.biaId, authority.memberId]);
    return !!result.rows.length;
  }
  async function requireExecution(authority: BiaBankAuthority, type: string) {
    if (!(await grant(authority))) throw new BankError("EXECUTION_DENIED", "Você não possui autorização explícita para executar saídas desta BIA.", 403);
    if (!config.enabled || !config.newOperationsEnabled || !config.methods.has("payout_" + type)) throw new BankError("PRODUCTION_DISABLED", "Saídas de produção ainda não habilitadas.", 409);
    // This release cannot enable real payments until the ledger consumer is homologated.
    throw new BankError("PRODUCTION_HOMOLOGATION_PENDING", "Ativação de produção depende da homologação e da baixa financeira.", 409);
  }
  async function account(biaId: string) {
    const result = await pool.query("SELECT codigo_cliente FROM pinbank_production.account_bindings WHERE bia_id=$1", [biaId]);
    const client = Number(result.rows[0]?.codigo_cliente);
    if (!Number.isSafeInteger(client) || client <= 0 || [3505, 3510].includes(client)) throw new BankError("ACCOUNT_UNCLASSIFIED", "Conta da BIA sem classificação de produção.", 409);
    return client;
  }
  app.get(base + "/permissao", async (req, res) => {
    try { const authority = await deps.authorize(req, res); if (!authority) return; res.json({ environment: "production", authorized: await grant(authority), enabled: false, reason: "Produção aguarda homologação e liberação explícita." }); } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/permissoes", async (req, res) => {
    try {
      const authority = await deps.authorize(req, res); if (!authority) return;
      const body = z.object({ memberId: z.string().min(1).max(100), enabled: z.boolean() }).strict().parse(req.body);
      if (!authority.canManage || !authority.participantIds.includes(body.memberId)) throw new BankError("GRANT_DENIED", "Somente a gestão da BIA pode autorizar um participante.", 403);
      await pool.query(`WITH updated AS (
        INSERT INTO pinbank_production.execution_grants(bia_id,member_id,granted_by,revoked_at) VALUES ($1,$2,$3,CASE WHEN $4 THEN NULL ELSE now() END)
        ON CONFLICT(bia_id,member_id) DO UPDATE SET granted_by=$3,granted_at=now(),revoked_at=CASE WHEN $4 THEN NULL ELSE now() END RETURNING bia_id
      ) INSERT INTO pinbank_production.permission_history(bia_id,member_id,actor_id,enabled) SELECT $1,$2,$3,$4 FROM updated`, [authority.biaId, body.memberId, authority.userId, body.enabled]);
      res.json({ authorized: body.enabled, productionEnabled: false });
    } catch (error) { bankFailure(error, res); }
  });
  app.get(base + "/operacoes", async (req, res) => {
    try { const authority = await deps.authorize(req, res); if (!authority) return; res.json(await store.list(authority.biaId)); } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/preparar", async (req, res) => {
    try {
      const authority = await deps.authorize(req, res); if (!authority) return;
      const body = z.object({ ledgerId: z.string().min(1).max(100), input: payoutInput, idempotencyKey: z.string().uuid() }).strict().parse(req.body);
      await requireExecution(authority, body.input.type);
      const client = await account(authority.biaId);
      const entry = await deps.readLedger(body.ledgerId);
      assertLedgerBinding(entry, authority.biaId, body.input.amountCents, "saida");
      const row = await store.prepare(authority.userId, authority.biaId, "payout_" + body.input.type, body.idempotencyKey, { ...body.input, ledgerId: body.ledgerId }, { client, channel: config.channel });
      await store.reserveQuote(row.id, authority.userId, authority.biaId);
      const quote = await preparePayout(transport, body.input, row.id, client);
      await deps.updateLedger(body.ledgerId, { pagamento_provider: "pinbank", pagamento_id: row.id, pagamento_status: "prepared", pagamento_gerado_em: new Date().toISOString() });
      const prepared = await store.saveQuote(row.id, quote, quote.preview);
      res.json({ id: row.id, confirmation: prepared.confirmation_hash, preview: quote.preview, environment: "production" });
    } catch (error) { bankFailure(error, res); }
  });
  app.post(base + "/:id/confirmar", async (req, res) => {
    let operation: any;
    try {
      const authority = await deps.authorize(req, res); if (!authority) return;
      const id = z.string().uuid().parse(req.params.id);
      const body = z.object({ confirmation: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
      const prepared = await store.getOperation(id, authority.biaId);
      if (!prepared || prepared.actor_id !== authority.userId) throw new BankError("OPERATION_NOT_FOUND", "Operação não disponível.", 404);
      await requireExecution(authority, prepared.request.type);
      if (await account(authority.biaId) !== Number(prepared.origin_client)) throw new BankError("ACCOUNT_CHANGED", "Conta de origem alterada. Prepare novamente.", 409);
      assertLedgerBinding(await deps.readLedger(prepared.request.ledgerId), authority.biaId, prepared.request.amountCents, "saida", id);
      operation = await store.claim(id, authority.userId, authority.biaId, body.confirmation);
      const result = await sendPayout(transport, operation.quote);
      await store.finish(id, "pending", result, result.reference);
      res.json({ id, state: "pending", result });
    } catch (error) {
      if (operation) { try { await store.finish(operation.id, "unknown", { code: "RECONCILIATION_REQUIRED" }); } catch {} }
      bankFailure(error, res);
    }
  });
}
