import { sql, type SQL } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { AsaasEnvironment, AsaasOperationState } from "../../shared/asaas";
import { AsaasError } from "./client";
import type { EncryptedCredential } from "./credentials";

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
  private table(name: "accounts" | "account_credentials" | "bia_accounts" | "operations" | "events") { return sql.raw(`${this.namespace}.${name}`); }

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

  async credentialStorageReady(): Promise<boolean> {
    try {
      const result = await this.db.execute(sql`SELECT to_regclass(${`${this.namespace}.account_credentials`}) IS NOT NULL AS ready`);
      return result.rows?.[0]?.ready === true;
    } catch { return false; }
  }

  async accountForBia(biaId: string) {
    const result = await this.db.execute(sql`SELECT a.id, a.label, a.state, a.ownership
      FROM ${this.table("bia_accounts")} b JOIN ${this.table("accounts")} a ON a.id = b.account_id WHERE b.bia_id = ${biaId}`);
    return result.rows?.[0] || null;
  }

  async internalAccountForBia(biaId: string) {
    const result = await this.db.execute(sql`SELECT a.*
      FROM ${this.table("bia_accounts")} b JOIN ${this.table("accounts")} a ON a.id = b.account_id WHERE b.bia_id = ${biaId}`);
    return result.rows?.[0] || null;
  }

  async accountByOwner(ownerId: string) {
    const result = await this.db.execute(sql`SELECT * FROM ${this.table("accounts")} WHERE owner_id=${ownerId} AND ownership='company' LIMIT 1`);
    return result.rows?.[0] || null;
  }

  async createAccountDraft(ownerId: string, label: string) {
    const result = await this.db.execute(sql`INSERT INTO ${this.table("accounts")}
      (id,label,ownership,owner_id,state) VALUES (${randomUUID()},${label},'company',${ownerId},'draft')
      ON CONFLICT (owner_id) WHERE owner_id IS NOT NULL AND ownership='company'
      DO UPDATE SET label=EXCLUDED.label,updated_at=now() RETURNING *`);
    return result.rows?.[0];
  }

  async linkAccount(biaId: string, accountId: string) {
    const inserted = await this.db.execute(sql`INSERT INTO ${this.table("bia_accounts")}(bia_id,account_id)
      VALUES (${biaId},${accountId}) ON CONFLICT (bia_id) DO NOTHING RETURNING account_id`);
    if (inserted.rows?.[0]) return;
    const existing = (await this.db.execute(sql`SELECT account_id FROM ${this.table("bia_accounts")} WHERE bia_id=${biaId}`)).rows?.[0];
    if (String(existing?.account_id || "") !== accountId) throw new AsaasError("BIA_ACCOUNT_CONFLICT", "Esta BIA já possui outra conta vinculada.", 409);
  }

  async saveCreatedAccount(input: {
    biaId: string; accountId: string; label: string; externalAccountId: string; walletId: string;
    credential: EncryptedCredential; state: "pending" | "in_review" | "approved";
  }) {
    const result = await this.db.execute(sql`WITH account_updated AS (
        UPDATE ${this.table("accounts")} SET label=${input.label},external_account_id=${input.externalAccountId},wallet_id=${input.walletId},
          credential_reference='database:aes-256-gcm:v1',state=${input.state},updated_at=now()
        WHERE id=${input.accountId} RETURNING id
      ), credential_saved AS (
        INSERT INTO ${this.table("account_credentials")}(account_id,ciphertext,initialization_vector,authentication_tag,key_fingerprint)
        SELECT id,${input.credential.ciphertext},${input.credential.initializationVector},${input.credential.authenticationTag},${input.credential.keyFingerprint}
        FROM account_updated ON CONFLICT(account_id) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,
          initialization_vector=EXCLUDED.initialization_vector,authentication_tag=EXCLUDED.authentication_tag,
          key_fingerprint=EXCLUDED.key_fingerprint,updated_at=now() RETURNING account_id
      ), link_saved AS (
        INSERT INTO ${this.table("bia_accounts")}(bia_id,account_id) SELECT ${input.biaId},id FROM account_updated
        ON CONFLICT(bia_id) DO NOTHING RETURNING account_id
      ) SELECT id FROM account_updated`);
    if (!result.rows?.[0]) throw new AsaasError("ACCOUNT_PERSISTENCE_FAILED", "Não foi possível armazenar a subconta criada.", 503);
    await this.linkAccount(input.biaId, input.accountId);
  }

  async claimAccountCreation(accountId: string): Promise<boolean> {
    const result = await this.db.execute(sql`UPDATE ${this.table("accounts")} SET state='pending',updated_at=now()
      WHERE id=${accountId} AND state IN ('draft','rejected') AND external_account_id IS NULL RETURNING id`);
    return !!result.rows?.[0];
  }

  async setAccountState(accountId: string, state: "draft" | "pending" | "in_review" | "approved" | "rejected" | "blocked") {
    await this.db.execute(sql`UPDATE ${this.table("accounts")} SET state=${state},updated_at=now() WHERE id=${accountId}`);
  }

  async accountCredential(accountId: string): Promise<EncryptedCredential | null> {
    const row = (await this.db.execute(sql`SELECT ciphertext,initialization_vector,authentication_tag,key_fingerprint
      FROM ${this.table("account_credentials")} WHERE account_id=${accountId}`)).rows?.[0];
    return row ? {
      ciphertext: String(row.ciphertext), initializationVector: String(row.initialization_vector),
      authenticationTag: String(row.authentication_tag), keyFingerprint: String(row.key_fingerprint),
    } : null;
  }

  async unresolvedAccountCreation(accountId: string) {
    const result = await this.db.execute(sql`SELECT id,state FROM ${this.table("operations")}
      WHERE account_id=${accountId} AND kind='create_subaccount' AND state IN ('sent','pending','unknown') ORDER BY created_at DESC LIMIT 1`);
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

  async recordExternalOperation(id: string, externalId: string, next: "pending" | "completed") {
    const result = await this.db.execute(sql`UPDATE ${this.table("operations")} SET external_id=${externalId},state=${next},updated_at=now()
      WHERE id=${id} AND state='sent' RETURNING *`);
    if (!result.rows?.[0]) throw new AsaasError("OPERATION_CONFLICT", "A operação foi atualizada. Consulte seu estado antes de repetir.", 409);
    return result.rows[0];
  }

  async reconcileExternalOperation(externalId: string, next: "pending" | "completed" | "rejected" | "cancelled") {
    const result = await this.db.execute(sql`UPDATE ${this.table("operations")} SET state=${next},updated_at=now()
      WHERE external_id=${externalId} AND state IN ('sent','pending','unknown') RETURNING *`);
    return result.rows?.[0] || null;
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
