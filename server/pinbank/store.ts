import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { BankError, type BankEnvironment } from "./config";
import { bankEventEvidence } from "./events";

export type OperationState = "preparing" | "prepared" | "sending" | "pending" | "unknown" | "completed" | "settled" | "rejected" | "cancelled" | "refunded";
export function nextBankState(current: OperationState, incoming: OperationState): OperationState {
  if (current === "refunded") return current;
  if (current === "settled") return incoming === "refunded" ? incoming : current;
  if (["cancelled", "rejected"].includes(current) && incoming !== "settled") return current;
  return incoming;
}
export function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
export const bankDigest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

export class BankStore {
  readonly schema: "pinbank_dev" | "pinbank_production";
  constructor(private pool: Pool, readonly environment: BankEnvironment) {
    this.schema = environment === "dev" ? "pinbank_dev" : "pinbank_production";
  }
  // Migrations are explicit, never a request-time best-effort fallback.
  async ready() { await this.pool.query(`SELECT id FROM ${this.schema}.operations LIMIT 0`); }
  async prepare(actor: string, scope: string, method: string, key: string, payload: unknown, origin?: { client: number; channel: number }) {
    const digest = bankDigest({ method, payload, origin: origin || null });
    const result = await this.pool.query(`INSERT INTO ${this.schema}.operations
      (id, actor_id, scope_id, method, idempotency_key, request_hash, request, state, confirmation_hash, origin_client, origin_channel)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'prepared',$8,$9,$10)
      ON CONFLICT (scope_id, idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
      RETURNING *`, [randomUUID(), actor, scope, method, key, digest, JSON.stringify(payload), bankDigest({ digest, actor, scope }), origin?.client || null, origin?.channel || null]);
    const row = result.rows[0];
    if (row.request_hash !== digest || row.actor_id !== actor) throw new BankError("IDEMPOTENCY_CONFLICT", "Identificador já utilizado para outra solicitação.", 409);
    return row;
  }
  async claim(id: string, actor: string, scope: string, confirmation: string) {
    const result = await this.pool.query(`UPDATE ${this.schema}.operations SET state='sending', sent_at=now(), updated_at=now()
      WHERE id=$1 AND actor_id=$2 AND scope_id=$3 AND confirmation_hash=$4 AND state='prepared' AND created_at > now() - interval '10 minutes' RETURNING *`, [id, actor, scope, confirmation]);
    if (!result.rows[0]) throw new BankError("CONFIRMATION_CONFLICT", "Confirmação expirada ou operação já enviada. Consulte o histórico.", 409);
    return result.rows[0];
  }
  async reserveQuote(id: string, actor: string, scope: string) {
    const result = await this.pool.query(`UPDATE ${this.schema}.operations SET state='preparing', updated_at=now() WHERE id=$1 AND actor_id=$2 AND scope_id=$3 AND state='prepared' AND quote IS NULL RETURNING *`, [id, actor, scope]);
    if (!result.rows[0]) throw new BankError("PREPARATION_IN_PROGRESS", "Preparação já iniciada. Consulte o histórico.", 409);
    return result.rows[0];
  }
  async saveQuote(id: string, quote: unknown, preview: unknown) {
    const digest = bankDigest({ id, quote });
    const result = await this.pool.query(`UPDATE ${this.schema}.operations SET state='prepared', quote=$2, preview=$3, confirmation_hash=$4, updated_at=now() WHERE id=$1 AND state='preparing' RETURNING *`, [id, JSON.stringify(quote), JSON.stringify(preview), digest]);
    if (!result.rows[0]) throw new BankError("PREPARATION_CONFLICT", "Preparação não disponível.", 409);
    return result.rows[0];
  }
  async failQuote(id: string) {
    await this.pool.query(`UPDATE ${this.schema}.operations SET state='rejected', updated_at=now() WHERE id=$1 AND state='preparing'`, [id]);
  }
  async finish(id: string, state: OperationState, result: unknown, providerId?: string) {
    const saved = await this.pool.query(`UPDATE ${this.schema}.operations SET state=$2, result=$3, provider_id=$4, updated_at=now() WHERE id=$1 AND state='sending' RETURNING id`, [id, state, JSON.stringify(result), providerId || null]);
    if (!saved.rows.length) throw new BankError("PERSISTENCE_CONFLICT", "Não foi possível registrar o retorno. Consulte a operação.");
  }
  async list(scope: string) {
    return (await this.pool.query(`SELECT id, method, state, created_at, updated_at, result, last_reconciled_at, reconciliation_error FROM ${this.schema}.operations WHERE scope_id=$1 ORDER BY created_at DESC LIMIT 100`, [scope])).rows;
  }
  async recoverInterrupted() {
    await this.pool.query(`UPDATE ${this.schema}.operations SET state='rejected', updated_at=now() WHERE state='prepared' AND created_at <= now() - interval '10 minutes'`);
    await this.pool.query(`UPDATE ${this.schema}.operations SET state='unknown', updated_at=now() WHERE state='sending' AND sent_at < now() - interval '2 minutes'`);
    await this.pool.query(`UPDATE ${this.schema}.operations SET state='rejected', updated_at=now() WHERE state='preparing' AND updated_at < now() - interval '2 minutes'`);
  }
  async receive(event: { EventId: string; EventType: string; EntityId: string; OccurredAt: string }, raw: Buffer) {
    const hash = createHash("sha256").update(raw).digest("hex");
    const result = await this.pool.query(`INSERT INTO ${this.schema}.events (event_id,event_type,entity_id,occurred_at,body,body_hash)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_id) DO UPDATE SET event_id=EXCLUDED.event_id RETURNING body_hash`,
    [event.EventId, event.EventType, event.EntityId, event.OccurredAt, raw, hash]);
    if (result.rows[0].body_hash !== hash) throw new BankError("EVENT_CONFLICT", "Evento conflitante.", 409);
  }
  async processEvents() {
    // Production requires its ledger outbox consumer before event processing can be activated.
    if (this.environment !== "dev") throw new BankError("PRODUCTION_PENDING", "Conciliação de produção ainda não habilitada.");
    // Rotate unresolved events so an old unmatched batch cannot starve later settlements.
    const events = (await this.pool.query(`SELECT event_id, body FROM ${this.schema}.events WHERE processed_at IS NULL ORDER BY attempts,received_at,event_id LIMIT 100`)).rows;
    for (const row of events) {
      const evidence = bankEventEvidence(JSON.parse(Buffer.from(row.body).toString("utf8")));
      if (!evidence) { await this.pool.query(`UPDATE ${this.schema}.events SET error_code='UNSUPPORTED_EVENT', attempts=attempts+1 WHERE event_id=$1`, [row.event_id]); continue; }
      const methods = evidence.family === "boleto" ? ["boleto", "boleto_split"] : [evidence.family];
      const result = await this.pool.query(`WITH target AS (
        SELECT id,state FROM ${this.schema}.operations WHERE method=ANY($2::text[]) AND origin_client=$3 AND origin_channel=$4
        AND (($5::text IS NOT NULL AND provider_id=$5) OR ($6::text IS NOT NULL AND result->>'receiptId'=$6))
        AND ($7::bigint IS NULL OR (request->>'amountCents')::bigint=$7) AND (state IN ('sending','pending','unknown','settled','refunded') OR ($8='settled' AND state IN ('rejected','cancelled')))
        FOR UPDATE
      ), changed AS (
        UPDATE ${this.schema}.operations o SET state=CASE WHEN o.state='refunded' THEN o.state WHEN o.state='settled' THEN o.state ELSE $8 END,
        result=COALESCE(o.result,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('lastEventId',$1::text,'paymentDate',COALESCE(o.result->>'paymentDate',$9::text))), updated_at=now()
        FROM target WHERE o.id=target.id AND (SELECT count(*) FROM target)=1 RETURNING o.id
      ) UPDATE ${this.schema}.events SET processed_at=now(),error_code=NULL,attempts=attempts+1 WHERE event_id=$1 AND EXISTS (SELECT 1 FROM changed) RETURNING event_id`,
      [row.event_id, methods, evidence.client, evidence.channel, evidence.reference || null, evidence.receiptId || null, evidence.amountCents ?? null, evidence.state, evidence.paymentDate || null]);
      if (!result.rows.length) await this.pool.query(`UPDATE ${this.schema}.events SET error_code='UNMATCHED_EVENT', attempts=attempts+1 WHERE event_id=$1`, [row.event_id]);
    }
  }
  async pending() {
    return (await this.pool.query(`SELECT * FROM ${this.schema}.operations WHERE state IN ('pending','unknown') AND origin_client IS NOT NULL AND origin_channel IS NOT NULL ORDER BY last_reconciled_at NULLS FIRST,created_at,id LIMIT 50`)).rows;
  }
  async recordReconciliation(id: string, error: "METHOD_PENDING" | "EVIDENCE_PENDING" | "QUERY_FAILED" | null) {
    await this.pool.query(`UPDATE ${this.schema}.operations SET last_reconciled_at=now(),reconciliation_error=$2 WHERE id=$1`, [id, error]);
  }
  async observe(id: string, state: OperationState, result: unknown) {
    if (this.environment !== "dev") throw new BankError("PRODUCTION_PENDING", "Baixa de produção não habilitada.");
    await this.pool.query(`UPDATE ${this.schema}.operations SET state=$2, result=COALESCE(result,'{}'::jsonb)||$3::jsonb, updated_at=now() WHERE id=$1 AND state IN ('pending','unknown')`, [id, state, JSON.stringify(result)]);
  }
  async getOperation(id: string, scope: string) {
    const rows = await this.pool.query(`SELECT * FROM ${this.schema}.operations WHERE id=$1 AND scope_id=$2`, [id, scope]);
    return rows.rows[0] || null;
  }
  async acceptTerms(operationId: string, actor: string) {
    const result = await this.pool.query(`INSERT INTO ${this.schema}.term_acceptances(id,actor_id,version,content_hash,content,accepted_at)
      SELECT id,$2,result->>'version',encode(sha256(convert_to(result->>'content','UTF8')),'hex'),result->>'content',now() FROM ${this.schema}.operations
      WHERE id=$1 AND method='terms' AND state='completed' AND COALESCE(result->>'content','')<>'' AND COALESCE(result->>'version','')<>''
      ON CONFLICT (id,actor_id) DO NOTHING RETURNING id`, [operationId, actor]);
    if (!result.rows.length) throw new BankError("TERMS_UNAVAILABLE", "Termo indisponível ou já aceito por este responsável.", 409);
  }
  async termsForActor(id: string, actor: string) {
    const result = await this.pool.query(`SELECT version FROM ${this.schema}.term_acceptances WHERE id=$1 AND actor_id=$2`, [id, actor]);
    if (!result.rows[0]) throw new BankError("TERMS_REQUIRED", "Aceite os termos oficiais antes do cadastro.", 409);
    return result.rows[0].version;
  }
  async ownsDocument(client: number, documentId: number, type: number) {
    const result = await this.pool.query(`SELECT 1 FROM ${this.schema}.operations o, jsonb_array_elements(COALESCE(o.result->'documents','[]'::jsonb)) d
      WHERE o.origin_client=$1 AND ((o.method IN ('document_upload','document_replace') AND o.state IN ('pending','completed')) OR (o.method='documents' AND o.state='completed')) AND d->>'id'=$2 AND d->>'type'=$3 LIMIT 1`, [client, String(documentId), String(type)]);
    return !!result.rows.length;
  }
}
