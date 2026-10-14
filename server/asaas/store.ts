import { sql, type SQL } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { AsaasEnvironment, AsaasOperationState } from "../../shared/asaas";
import { AsaasError } from "./client";

export interface AsaasDatabase { execute(query: SQL): Promise<any> }
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const result = JSON.stringify(value);
    if (result === undefined) throw new AsaasError("INVALID_REQUEST", "Pedido inválido.", 400);
    return result;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export const requestHash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");

type PrepareOperation = {
  biaId?: string | null; accountId?: string | null; actorId: string; kind: string;
  amountCents: number; externalReference: string; idempotencyKey: string; request: unknown;
};
const transitions: Record<AsaasOperationState, readonly AsaasOperationState[]> = {
  prepared: ["sent", "cancelled"], sent: ["pending", "unknown", "completed", "rejected"],
  pending: ["unknown", "completed", "rejected", "cancelled"], unknown: ["pending", "completed", "rejected", "cancelled"],
  completed: [], rejected: [], cancelled: [],
};

export class AsaasStore {
  readonly namespace: "asaas_sandbox" | "asaas_production";
  constructor(private readonly db: AsaasDatabase, readonly environment: AsaasEnvironment) {
    if (environment !== "sandbox" && environment !== "production") throw new AsaasError("INVALID_ENVIRONMENT", "Ambiente inválido.", 400);
    this.namespace = environment === "sandbox" ? "asaas_sandbox" : "asaas_production";
  }
  private table(name: "accounts" | "bia_accounts" | "operations" | "events") { return sql.raw(`${this.namespace}.${name}`); }

  async storageReady(): Promise<boolean> {
    try {
      const result = await this.db.execute(sql`SELECT
        to_regclass(${`${this.namespace}.accounts`}) IS NOT NULL AND
        to_regclass(${`${this.namespace}.bia_accounts`}) IS NOT NULL AND
        to_regclass(${`${this.namespace}.operations`}) IS NOT NULL AND
        to_regclass(${`${this.namespace}.events`}) IS NOT NULL AS ready`);
      return result.rows?.[0]?.ready === true;
    } catch { return false; }
  }

  async accountForBia(biaId: string) {
    const result = await this.db.execute(sql`SELECT a.id, a.label, a.state, a.ownership
      FROM ${this.table("bia_accounts")} b JOIN ${this.table("accounts")} a ON a.id = b.account_id WHERE b.bia_id = ${biaId}`);
    return result.rows?.[0] || null;
  }

  async prepareOperation(input: PrepareOperation) {
    for (const field of [input.actorId, input.kind, input.externalReference, input.idempotencyKey]) {
      if (typeof field !== "string" || !field.trim() || field.length > 255) throw new AsaasError("INVALID_REQUEST", "Identificação da operação inválida.", 400);
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) throw new AsaasError("INVALID_AMOUNT", "Valor em centavos inválido.", 400);
    const scope = `${input.accountId || "platform"}:${input.biaId || "platform"}`;
    const hash = requestHash({ ...input, biaId: input.biaId || null, accountId: input.accountId || null });
    const inserted = await this.db.execute(sql`INSERT INTO ${this.table("operations")}
      (id,scope_key,bia_id,account_id,actor_id,kind,amount_cents,external_reference,idempotency_key,request_hash)
      VALUES (${randomUUID()},${scope},${input.biaId || null},${input.accountId || null},${input.actorId},${input.kind},${input.amountCents},${input.externalReference},${input.idempotencyKey},${hash})
      ON CONFLICT(scope_key,idempotency_key) DO NOTHING RETURNING *`);
    const existing = inserted.rows?.[0] || (await this.db.execute(sql`SELECT * FROM ${this.table("operations")} WHERE scope_key=${scope} AND idempotency_key=${input.idempotencyKey}`)).rows?.[0];
    if (!existing || existing.request_hash !== hash) throw new AsaasError("IDEMPOTENCY_CONFLICT", "A chave já identifica um pedido diferente.", 409);
    return existing;
  }

  async transition(id: string, expected: AsaasOperationState, next: AsaasOperationState) {
    if (!transitions[expected]?.includes(next)) throw new AsaasError("INVALID_TRANSITION", "Transição de operação inválida.", 409);
    const result = await this.db.execute(sql`UPDATE ${this.table("operations")} SET state=${next},updated_at=now() WHERE id=${id} AND state=${expected} RETURNING *`);
    if (!result.rows?.[0]) throw new AsaasError("OPERATION_CONFLICT", "A operação foi atualizada. Consulte seu estado antes de repetir.", 409);
    return result.rows[0];
  }

  async receiveEvent(event: { id: string; type: string; accountId: string | null; entityType: string | null; entityId: string | null; hash: string; summary: Record<string, unknown> }) {
    const result = await this.db.execute(sql`INSERT INTO ${this.table("events")}
      (event_id,event_type,source_account_id,entity_type,entity_id,body_hash,summary)
      VALUES (${event.id},${event.type},${event.accountId},${event.entityType},${event.entityId},${event.hash},${JSON.stringify(event.summary)}::jsonb)
      ON CONFLICT(event_id) DO NOTHING RETURNING event_id`);
    if (!result.rows?.[0]) {
      const previous = (await this.db.execute(sql`SELECT event_type,source_account_id,entity_type,entity_id FROM ${this.table("events")} WHERE event_id=${event.id}`)).rows?.[0];
      if (!previous || previous.event_type !== event.type || previous.source_account_id !== event.accountId || previous.entity_type !== event.entityType || previous.entity_id !== event.entityId) throw new AsaasError("EVENT_CONFLICT", "Identificação do evento em conflito.", 409);
    }
    return { duplicate: !result.rows?.[0] };
  }
}
