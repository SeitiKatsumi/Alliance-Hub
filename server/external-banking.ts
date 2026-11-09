import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { EXTERNAL_BANKS, bankConnectionInputSchema, matchBankReceipt, normalizeBankDocument, type BankEnvironment, type ReceiptFlow, type BankReceipt, type BankCandidate } from "../shared/external-banking";
import { BankingError, bankingEnabled, bankingEnvironment, bankCredential, bankDigest, sealBankData, openBankData, directBankProfiles, DirectReceiptProvider, PluggyReceiptProvider, type ReceiptBankProvider, type VerifiedBankAccount } from "./external-banking-provider";

type Dependencies = {
  db: any; lock: <T>(biaId: string, work: (tx: any) => Promise<T>) => Promise<T>;
  flows: (biaId: string) => Promise<ReceiptFlow[]>;
  canAutomate: (biaId: string, actor: string) => Promise<boolean>;
  canRead: (biaId: string, actor: string) => Promise<boolean>;
  apply: (input: { biaId: string; flowId: string; receiptId: string; receipt: BankReceipt; actor: string; previousStatus: string | null }, tx: any) => Promise<void>;
  provider?: (connection: any) => ReceiptBankProvider;
  enabled?: () => boolean; environment?: BankEnvironment;
};
const safeCode = (e: unknown) => e instanceof BankingError ? e.code : "BANK_RETRY_PENDING";
const accountKey = (a: VerifiedBankAccount) => bankDigest(`${a.bank}:${normalizeBankDocument(a.ownerDocument)}:${a.number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`);
const active = (c: any) => ["connected", "attention"].includes(c?.state) && !!c?.activated_at && !!c?.account_key;
const when = (v: any) => new Date(v).toISOString();
export async function usesAsaasBanking(db: any, biaId: string, environment: BankEnvironment) {
  if (!(await db.execute(sql`SELECT to_regclass('bia_bank_choices') IS NOT NULL AS ready`)).rows[0]?.ready) return true;
  return (await db.execute(sql`SELECT choice FROM bia_bank_choices WHERE bia_id=${biaId} AND environment=${environment}`)).rows[0]?.choice !== "external";
}
export class ExternalBanking {
  readonly environment: BankEnvironment;
  readonly pluggy = new PluggyReceiptProvider();
  constructor(readonly deps: Dependencies) { this.environment = deps.environment || bankingEnvironment(); }
  enabled() { return this.deps.enabled ? this.deps.enabled() : bankingEnabled(); }
  async ready(executor = this.deps.db) {
    const row = (await executor.execute(sql`SELECT to_regclass('bia_bank_choices') IS NOT NULL AND to_regclass('bia_bank_connections') IS NOT NULL AND to_regclass('bia_bank_receipts') IS NOT NULL AND to_regclass('bia_bank_events') IS NOT NULL AS ready`)).rows[0];
    return row?.ready === true;
  }
  async requireReady() { if (!await this.ready()) throw new BankingError("STORAGE_PENDING", "Conexão bancária aguardando a migração de armazenamento.", 503); }
  requireEnabled() { if (!this.enabled()) throw new BankingError("BANKING_DISABLED", "Conexões externas ainda não habilitadas neste ambiente.", 503); }
  async choice(biaId: string, executor = this.deps.db) {
    if (!await this.ready(executor)) return "asaas";
    return (await executor.execute(sql`SELECT choice FROM bia_bank_choices WHERE bia_id=${biaId} AND environment=${this.environment}`)).rows[0]?.choice || "asaas";
  }
  async choose(biaId: string, choice: "external" | "asaas", actor: string) {
    await this.requireReady();
    return this.deps.lock(biaId, async tx => {
      const creating = (await tx.execute(sql`SELECT to_regclass('bia_contribution_charges') IS NOT NULL AS ready`)).rows[0]?.ready;
      if (choice === "external" && creating && (await tx.execute(sql`SELECT id FROM bia_contribution_charges WHERE bia_id=${biaId} AND environment=${this.environment} AND job_state='creating' LIMIT 1`)).rows.length) throw new BankingError("CHARGE_BUSY", "Aguarde a conciliação da emissão em andamento antes de trocar a conta.");
      await tx.execute(sql`INSERT INTO bia_bank_choices(bia_id,environment,choice,actor_id) VALUES(${biaId},${this.environment},${choice},${actor}) ON CONFLICT(bia_id,environment) DO UPDATE SET choice=excluded.choice,actor_id=excluded.actor_id,updated_at=now()`);
      // Voltar ao Asaas interrompe baixas externas; a conta e seu histórico são preservados.
      if (choice === "asaas") await tx.execute(sql`UPDATE bia_bank_connections SET auto_enabled=false WHERE bia_id=${biaId} AND environment=${this.environment}`);
      return { choice };
    });
  }
  async connection(biaId: string, id?: string, executor = this.deps.db) {
    const rows = (await executor.execute(sql`SELECT * FROM bia_bank_connections WHERE bia_id=${biaId} AND environment=${this.environment} ORDER BY created_at DESC`)).rows;
    const c = id ? rows.find((r: any) => r.id === id) : rows.find((r: any) => r.state !== "disconnected");
    if (id && !c) throw new BankingError("CONNECTION_NOT_FOUND", "Conexão não encontrada nesta BIA.", 404);
    return c || null;
  }
  async catalog(biaId: string) {
    let profiles: ReturnType<typeof directBankProfiles> = [], profileError = false;
    try { profiles = directBankProfiles(); } catch { profileError = true; }
    let mapping: any = {}; try { mapping = JSON.parse(process.env.BUILT_PLUGGY_CONNECTORS || "{}"); } catch { /* indisponível */ }
    return EXTERNAL_BANKS.map(bank => ({ ...bank, options: (["PF", "PJ"] as const).flatMap(kind => {
      const configured = profiles.filter(p => p.biaId === biaId && p.bank === bank.id && p.kind === kind && p.environment === this.environment);
      const direct = configured.map(p => {
        let credentials = false, valid = false;
        try {
          credentials = !!bankCredential(p.clientIdEnv) && !!bankCredential(p.certEnv) && !!bankCredential(p.privateKeyEnv) && (!p.clientSecretEnv || !!bankCredential(p.clientSecretEnv));
          new DirectReceiptProvider(p); valid = true;
        } catch { /* contrato/cofre inválido: não anunciar disponibilidade */ }
        return { method: "direct", kind, profileId: p.id, costs: p.costs, available: this.enabled() && credentials && valid, blocker: !p.contractApproved ? "Habilitação contratual pendente" : !credentials ? "Credenciais e certificado de consulta pendentes" : this.environment === "production" && !p.homologated ? "Homologação de produção pendente" : !valid ? "Contrato de consulta aguardando validação" : !this.enabled() ? "Conexão externa ainda não habilitada" : null };
      });
      const connectorId = mapping[`${bank.id}:${kind}`];
      const homologated = this.environment === "sandbox" || (process.env.BUILT_PLUGGY_HOMOLOGATED_CONNECTORS || "").split(",").map(s => s.trim()).includes(`${bank.id}:${kind}`);
      let pluggyCredentials = false;
      try { pluggyCredentials = !!bankCredential("BUILT_PLUGGY_CLIENT_ID") && !!bankCredential("BUILT_PLUGGY_CLIENT_SECRET"); } catch { /* cofre não disponível */ }
      const pluggyAvailable = this.enabled() && homologated && process.env.BUILT_PLUGGY_APPROVED === "true" && pluggyCredentials && Number.isSafeInteger(connectorId) && connectorId > 0;
      if (!direct.length && bank.direct) direct.push({ method: "direct", kind, profileId: "", costs: bank.cost, available: false, blocker: profileError ? "Configuração do conector inválida" : "Credenciais, contrato e validação da conta ainda necessários" });
      return [...direct, { method: "pluggy", kind, profileId: "", costs: "Serviço de Open Finance sujeito à contratação e cobertura confirmadas.", available: pluggyAvailable, blocker: pluggyAvailable ? null : "Parceiro Open Finance ainda não habilitado para esta modalidade" }];
    }) }));
  }
  async status(biaId: string) {
    const ready = await this.ready(), c = ready ? await this.connection(biaId) : null;
    return { environment: this.environment, storageReady: ready, enabled: this.enabled(), choice: ready ? await this.choice(biaId) : "asaas", banks: await this.catalog(biaId),
      connection: c ? { id: c.id, bank: c.bank, kind: c.account_kind, method: c.method, state: c.state, maskedAccount: c.masked_account,
        activatedAt: c.activated_at, autoEnabled: c.auto_enabled, lastSuccessAt: c.last_success_at, errorCode: c.error_code } : null };
  }
  provider(c: any): ReceiptBankProvider {
    if (this.deps.provider) return this.deps.provider(c);
    if (c.method === "pluggy") {
      let connectors: any = {}; try { connectors = JSON.parse(process.env.BUILT_PLUGGY_CONNECTORS || "{}"); } catch { /* bloqueado abaixo */ }
      const binding = openBankData(c.secret, c.id), modality = `${c.bank}:${c.account_kind}`;
      const homologated = this.environment === "sandbox" || (process.env.BUILT_PLUGGY_HOMOLOGATED_CONNECTORS || "").split(",").map(s => s.trim()).includes(modality);
      if (process.env.BUILT_PLUGGY_APPROVED !== "true" || !homologated || connectors[modality] !== binding.connectorId) throw new BankingError("CONNECTOR_PENDING", "A conexão exige habilitação comercial e homologação desta modalidade.");
      return this.pluggy;
    }
    const p = directBankProfiles().find(p => p.id === c.profile_id && p.biaId === c.bia_id && p.bank === c.bank && p.kind === c.account_kind && p.environment === this.environment);
    if (!p) throw new BankingError("PROFILE_PENDING", "Perfil bancário ainda não configurado.");
    return new DirectReceiptProvider(p);
  }
  async start(biaId: string, actor: string, raw: unknown) {
    await this.requireReady(); this.requireEnabled();
    const input = bankConnectionInputSchema.parse(raw);
    const options = (await this.catalog(biaId)).find(b => b.id === input.bank)!.options;
    if (!options.some(o => o.available && o.method === input.method && o.kind === input.kind && (input.method === "pluggy" || o.profileId === input.profileId))) throw new BankingError("CONNECTOR_PENDING", "Esta conexão ainda precisa de acesso bancário e habilitação.");
    const id = randomUUID(), binding: any = { expectedDocument: normalizeBankDocument(input.ownerDocument), clientUserId: randomUUID() };
    if (input.method === "pluggy") binding.connectorId = JSON.parse(process.env.BUILT_PLUGGY_CONNECTORS || "{}")[`${input.bank}:${input.kind}`];
    await this.deps.lock(biaId, async tx => {
      if (await this.connection(biaId, undefined, tx)) throw new BankingError("ALREADY_CONNECTED", "Desconecte a conta anterior antes de conectar outra.");
      await tx.execute(sql`INSERT INTO bia_bank_connections(id,bia_id,environment,bank,account_kind,method,actor_id,state,profile_id,secret) VALUES(${id},${biaId},${this.environment},${input.bank},${input.kind},${input.method},${actor},'authorizing',${input.profileId || null},${JSON.stringify(sealBankData(binding, id))}::jsonb)`);
    });
    try {
      if (input.method === "direct") { await this.finish(biaId, id, actor, {}); return { id, connected: true }; }
      const result = await this.pluggy.request("/connect_token", { options: { clientUserId: binding.clientUserId, avoidDuplicates: true } });
      if (typeof result.accessToken !== "string") throw new BankingError("TOKEN_INVALID");
      return { id, connected: false, connectToken: result.accessToken, connectorId: binding.connectorId, sandbox: this.environment === "sandbox" };
    } catch (e) {
      await this.deps.db.execute(sql`UPDATE bia_bank_connections SET state='attention',error_code=${safeCode(e)} WHERE id=${id} AND state='authorizing'`); throw e;
    }
  }
  async accounts(biaId: string, id: string, actor: string, itemId: string) {
    this.requireEnabled(); const c = await this.connection(biaId, id);
    if (c.actor_id !== actor || c.method !== "pluggy" || c.activated_at || Date.now() - Date.parse(c.created_at) > 30 * 60_000) throw new BankingError("AUTHORIZATION_EXPIRED", "Reinicie a autorização da conta.");
    const binding = openBankData(c.secret, c.id), item = await this.pluggy.request(`/items/${encodeURIComponent(itemId)}`);
    if (item.clientUserId !== binding.clientUserId || item.connector?.id !== binding.connectorId || !item.connector?.isOpenFinance) throw new BankingError("ACCOUNT_MISMATCH", "A autorização não corresponde à conexão iniciada.");
    const list = await this.pluggy.request(`/accounts?itemId=${encodeURIComponent(itemId)}&type=BANK`);
    if (!Array.isArray(list.results)) throw new BankingError("INVALID_BANK_RESPONSE");
    // Guardar Item apenas depois da leitura autenticada; ID vindo do widget não é prova de propriedade.
    await this.deps.db.execute(sql`UPDATE bia_bank_connections SET secret=${JSON.stringify(sealBankData({ ...binding, itemId }, c.id))}::jsonb WHERE id=${c.id} AND state IN ('authorizing','attention')`);
    return list.results.filter((a: any) => a.itemId === itemId && a.type === "BANK" && a.currencyCode === "BRL" && normalizeBankDocument(a.taxNumber) === binding.expectedDocument)
      .map((a: any) => ({ id: a.id, label: `${String(a.name || "Conta").slice(0, 80)} · final ${String(a.number || "").slice(-4)}` }));
  }
  async finish(biaId: string, id: string, actor: string, input: { accountId?: string }) {
    this.requireEnabled(); const c = await this.connection(biaId, id);
    if (c.actor_id !== actor || c.activated_at || c.state === "disconnected") throw new BankingError("CONNECTION_STATE", "Reinicie a autorização da conta.");
    const binding = openBankData(c.secret, c.id);
    if (c.method === "pluggy" && (!binding.itemId || !input.accountId || Date.now() - Date.parse(c.created_at) > 30 * 60_000)) throw new BankingError("AUTHORIZATION_EXPIRED");
    const args = { ...binding, accountId: input.accountId, bank: c.bank, kind: c.account_kind };
    const account = await this.provider(c).verify(args);
    if (account.bank !== c.bank || account.kind !== c.account_kind || normalizeBankDocument(account.ownerDocument) !== binding.expectedDocument) throw new BankingError("OWNER_MISMATCH", "O titular retornado pelo banco não corresponde ao informado.");
    try {
      await this.deps.lock(biaId, async tx => {
        const current = await this.connection(biaId, id, tx);
        if (!current || current.state === "disconnected" || current.activated_at) throw new BankingError("CONNECTION_STATE");
        await tx.execute(sql`UPDATE bia_bank_connections SET state='connected',account_key=${accountKey(account)},masked_account=${"•••• " + account.number.slice(-4)},secret=${JSON.stringify(sealBankData({ ...args, account }, c.id))}::jsonb,binding_hash=${bankDigest(JSON.stringify(account))},activated_at=now(),error_code=NULL,updated_at=now() WHERE id=${id}`);
      });
    } catch (e: any) { if (e?.code === "23505" || e?.cause?.code === "23505") throw new BankingError("ACCOUNT_IN_USE", "Esta conta já está vinculada a uma BIA."); throw e; }
    return { connected: true };
  }
  async setAutomation(biaId: string, id: string, enabled: boolean, actor: string) {
    await this.requireReady();
    return this.deps.lock(biaId, async tx => {
      const c = await this.connection(biaId, id, tx);
      if (enabled && (!active(c) || await this.choice(biaId, tx) !== "external" || !await this.deps.canAutomate(biaId, actor))) throw new BankingError("AUTOMATION_NOT_AUTHORIZED", "Conecte a conta e confirme seu acesso ao Financeiro antes de ativar a baixa automática.", 403);
      if (enabled) this.requireEnabled();
      await tx.execute(sql`UPDATE bia_bank_connections SET auto_enabled=${enabled},auto_actor=${enabled ? actor : null},updated_at=now() WHERE id=${id}`);
      return { autoEnabled: enabled };
    });
  }
  async disconnect(biaId: string, id: string) {
    await this.requireReady();
    return this.deps.lock(biaId, async tx => {
      await this.connection(biaId, id, tx);
      await tx.execute(sql`UPDATE bia_bank_connections SET state='disconnected',secret=NULL,auto_enabled=false,auto_actor=NULL,lease_until=NULL,updated_at=now() WHERE id=${id}`);
      return { disconnected: true };
    });
  }
  async listReceipts(biaId: string) {
    if (!await this.ready()) return [];
    const rows = (await this.deps.db.execute(sql`SELECT * FROM bia_bank_receipts WHERE bia_id=${biaId} AND environment=${this.environment} ORDER BY created_at DESC LIMIT 100`)).rows;
    return rows.map((r: any) => {
      const receipt: BankReceipt = openBankData(r.receipt, r.id);
      return { id: r.id, state: r.state, flowId: r.flow_id, automatic: r.automatic, amountCents: receipt.amountCents, currency: receipt.currency, date: receipt.receivedAt,
        description: receipt.description, payerName: receipt.payerName, candidates: r.candidates, errorCode: r.error_code };
    });
  }
  async sync(biaId: string, id: string) {
    await this.requireReady(); this.requireEnabled();
    const c = (await this.deps.db.execute(sql`UPDATE bia_bank_connections SET lease_until=now()+interval '5 minutes' WHERE id=${id} AND bia_id=${biaId} AND environment=${this.environment} AND state IN ('connected','attention') AND activated_at IS NOT NULL AND (lease_until IS NULL OR lease_until<now()) RETURNING *`)).rows[0];
    if (!c) throw new BankingError("SYNC_BUSY", "Conexão indisponível ou atualização já em andamento.");
    try {
      if (!await this.deps.canRead(biaId, c.actor_id)) throw new BankingError("BANK_ACCESS_REMOVED", "O responsável precisa renovar a autorização de acesso à BIA.", 403);
      const binding = openBankData(c.secret, c.id), provider = this.provider(c), account = await provider.verify(binding);
      if (accountKey(account) !== c.account_key) throw new BankingError("ACCOUNT_MISMATCH", "A conta retornada pelo banco mudou; reconecte para conferir.");
      const from = c.sync_from ? when(c.sync_from) : new Date(Math.max(Date.parse(c.activated_at), c.last_success_at ? Date.parse(c.last_success_at) - 2 * 86400000 : 0)).toISOString();
      const to = c.sync_to ? when(c.sync_to) : new Date().toISOString();
      const seen = new Set<string>(); let cursor: string | null = c.sync_cursor || null, pages = 0;
      if (cursor) seen.add(cursor);
      do {
        const current = await this.connection(biaId, id);
        if (!active(current) || !await this.deps.canRead(biaId, c.actor_id)) throw new BankingError("BANK_ACCESS_REMOVED");
        await this.deps.db.execute(sql`UPDATE bia_bank_connections SET lease_until=now()+interval '5 minutes' WHERE id=${id} AND state<>'disconnected'`);
        const page = await provider.receipts(account, from, to, cursor); pages++;
        for (const receipt of page.receipts) {
          if (Date.parse(receipt.receivedAt) < Date.parse(from) || Date.parse(receipt.receivedAt) > Date.parse(to) || receipt.amountCents <= 0) continue;
          const receiptId = randomUUID(), transactionKey = bankDigest(`${c.account_key}:${receipt.endToEndId || receipt.bankTransactionId}`);
          const saved = (await this.deps.db.execute(sql`INSERT INTO bia_bank_receipts(id,connection_id,bia_id,environment,transaction_key,receipt,state) VALUES(${receiptId},${id},${biaId},${this.environment},${transactionKey},${JSON.stringify(sealBankData(receipt, receiptId))}::jsonb,'unmatched') ON CONFLICT(environment,transaction_key) DO NOTHING RETURNING id`)).rows[0];
          if (!saved) {
            const prior = (await this.deps.db.execute(sql`SELECT * FROM bia_bank_receipts WHERE environment=${this.environment} AND transaction_key=${transactionKey}`)).rows[0];
            if (prior?.bia_id !== biaId) throw new BankingError("RECEIPT_IN_USE");
            const old: BankReceipt = openBankData(prior.receipt, prior.id);
            if (old.status !== receipt.status || old.amountCents !== receipt.amountCents || old.currency !== receipt.currency) {
              await this.deps.db.execute(sql`UPDATE bia_bank_receipts SET receipt=${JSON.stringify(sealBankData(receipt, prior.id))}::jsonb,state=CASE WHEN state IN ('applying','reconciled','review') THEN 'review' ELSE 'unmatched' END,error_code=CASE WHEN state IN ('applying','reconciled','review') THEN 'RECEIPT_CHANGED' ELSE NULL END,updated_at=now() WHERE id=${prior.id}`);
            }
          }
        }
        if (page.next && seen.has(page.next)) throw new BankingError("REPEATED_PAGE");
        if (page.next) seen.add(page.next); cursor = page.next;
        if (cursor && pages >= 20) {
          await this.deps.db.execute(sql`UPDATE bia_bank_connections SET sync_cursor=${cursor},sync_from=${from},sync_to=${to} WHERE id=${id} AND state<>'disconnected'`);
          throw new BankingError("SYNC_PARTIAL", "Consulta parcial; a próxima atualização retomará a conferência.", 503);
        }
      } while (cursor);
      await this.deps.db.execute(sql`UPDATE bia_bank_connections SET state='connected',last_success_at=${to},sync_cursor=NULL,sync_from=NULL,sync_to=NULL,next_sync_at=now()+interval '15 minutes',error_code=NULL WHERE id=${id} AND state<>'disconnected'`);
      await this.reconcile(biaId, c);
      return { synced: true };
    } catch (e) {
      await this.deps.db.execute(sql`UPDATE bia_bank_connections SET state='attention',error_code=${safeCode(e)},next_sync_at=now()+interval '15 minutes' WHERE id=${id} AND state<>'disconnected'`); throw e;
    } finally { await this.deps.db.execute(sql`UPDATE bia_bank_connections SET lease_until=NULL WHERE id=${id}`); }
  }
  async reconcile(biaId: string, c: any) {
    const rows = (await this.deps.db.execute(sql`SELECT * FROM bia_bank_receipts WHERE bia_id=${biaId} AND connection_id=${c.id} AND environment=${this.environment} AND state IN ('unmatched','suggested','applying') ORDER BY updated_at,id LIMIT 100`)).rows;
    for (const row of rows) {
      if (row.state === "applying") {
        if (await this.choice(biaId) === "external" && (!row.automatic || c.auto_enabled) && await this.deps.canAutomate(biaId, row.decision_actor)) {
          await this.applyReceipt(biaId, row.id, row.flow_id, row.decision_actor, row.automatic);
        } else {
          await this.deps.db.execute(sql`UPDATE bia_bank_receipts SET updated_at=now() WHERE id=${row.id} AND state='applying'`);
        }
        continue;
      }
      const receipt: BankReceipt = openBankData(row.receipt, row.id), candidates = matchBankReceipt(receipt, await this.deps.flows(biaId), biaId);
      // A pessoa pode ter confirmado a sugestão enquanto o banco era consultado.
      const updated = await this.deps.db.execute(sql`UPDATE bia_bank_receipts SET candidates=${JSON.stringify(candidates)}::jsonb,state=${candidates.length ? "suggested" : receipt.status === "reversed" ? "review" : "unmatched"},updated_at=now() WHERE id=${row.id} AND state IN ('unmatched','suggested') RETURNING id`);
      if (!updated.rows.length) continue;
      if (c.auto_enabled && candidates.length === 1 && candidates[0].automatic && await this.deps.canAutomate(biaId, c.auto_actor)) await this.applyReceipt(biaId, row.id, candidates[0].flowId, c.auto_actor, true);
    }
  }
  async applyReceipt(biaId: string, id: string, flowId: string, actor: string, automatic: boolean) {
    this.requireEnabled();
    if (!await this.deps.canAutomate(biaId, actor)) throw new BankingError("FINANCE_ACCESS_REQUIRED", "Acesso de edição ao Banco e ao Financeiro necessário.", 403);
    // Reserva é gravada antes da escrita externa, e não se perde se Directus aplicar e a resposta cair.
    await this.deps.lock(biaId, async tx => {
      const row = (await tx.execute(sql`SELECT * FROM bia_bank_receipts WHERE id=${id} AND bia_id=${biaId} AND environment=${this.environment} FOR UPDATE`)).rows[0];
      if (!row || row.state === "review") throw new BankingError("RECEIPT_REVIEW", "Recebimento exige conferência financeira.");
      if (row.state === "reconciled") { if (row.flow_id !== flowId) throw new BankingError("RECEIPT_IN_USE"); return; }
      const c = await this.connection(biaId, row.connection_id, tx);
      if (!active(c) || await this.choice(biaId, tx) !== "external" || automatic && !c.auto_enabled) throw new BankingError("AUTOMATION_PAUSED", "Conexão ou baixa automática interrompida.");
      if (row.state === "applying") { if (row.flow_id !== flowId || row.decision_actor !== actor || row.automatic !== automatic) throw new BankingError("RECEIPT_IN_USE"); return; }
      const receipt: BankReceipt = openBankData(row.receipt, row.id), flows = await this.deps.flows(biaId);
      const candidates = matchBankReceipt(receipt, flows, biaId), selected = candidates.find(x => x.flowId === flowId);
      if (!selected || selected.conflict || selected.differenceCents !== 0 || automatic && !selected.automatic) throw new BankingError("MATCH_CHANGED", "Confira os valores e eventuais cobranças ativas antes de confirmar a baixa.");
      await tx.execute(sql`UPDATE bia_bank_receipts SET state='applying',flow_id=${flowId},decision_actor=${actor},automatic=${automatic},previous_status=${flows.find(f => f.id === flowId)!.status},candidates=${JSON.stringify(candidates)}::jsonb WHERE id=${id}`);
    });
    try { await this.deps.lock(biaId, async tx => {
      const row = (await tx.execute(sql`SELECT * FROM bia_bank_receipts WHERE id=${id} AND bia_id=${biaId} AND environment=${this.environment} FOR UPDATE`)).rows[0];
      if (row.state === "reconciled") return;
      if (row.state !== "applying" || row.flow_id !== flowId || row.decision_actor !== actor || row.automatic !== automatic) throw new BankingError("RECEIPT_REVIEW");
      const c = await this.connection(biaId, row.connection_id, tx);
      if (!active(c) || await this.choice(biaId, tx) !== "external" || automatic && !c.auto_enabled || !await this.deps.canAutomate(biaId, actor)) throw new BankingError("AUTOMATION_PAUSED");
      const receipt: BankReceipt = openBankData(row.receipt, row.id);
      await this.deps.apply({ biaId, flowId, receiptId: id, receipt, actor, previousStatus: row.previous_status }, tx);
      await tx.execute(sql`UPDATE bia_bank_receipts SET state='reconciled',error_code=NULL,updated_at=now() WHERE id=${id}`);
      await tx.execute(sql`INSERT INTO bia_bank_events(id,environment,provider,event_key,connection_id,action) VALUES(${randomUUID()},${this.environment},'reconciliation',${id},${c.id},${automatic ? "automatic_receipt" : "confirmed_receipt"}) ON CONFLICT DO NOTHING`);
    }); } catch (e) {
      // Erros de transporte mantêm a intenção para retomada; conflito de negócio exige revisão explícita.
      if (e instanceof BankingError && ["FLOW_CHANGED", "FLOW_PROTECTED", "MATCH_CHANGED"].includes(e.code)) {
        await this.deps.lock(biaId, async tx => {
          await tx.execute(sql`UPDATE bia_bank_receipts SET state='review',error_code=${e.code},updated_at=now() WHERE id=${id} AND bia_id=${biaId} AND environment=${this.environment} AND state='applying'`);
        });
      }
      throw e;
    }
    return { reconciled: true };
  }
  async webhook(secret: string, body: any) {
    const expected = process.env.BUILT_BANKING_WEBHOOK_SECRET || "";
    if (expected.length < 32 || Buffer.byteLength(secret) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) throw new BankingError("WEBHOOK_UNAUTHORIZED", "Não autorizado.", 401);
    if (!this.enabled() || !await this.ready()) throw new BankingError("BANKING_DISABLED", "Integração indisponível.", 503);
    if (typeof body?.itemId !== "string" || typeof body?.eventId !== "string" || body.eventId.length > 200) throw new BankingError("INVALID_EVENT", "Evento inválido.", 400);
    // Só acorda conexões previamente verificadas. Payload/link/valor do webhook nunca autoriza baixa.
    const rows = (await this.deps.db.execute(sql`SELECT * FROM bia_bank_connections WHERE environment=${this.environment} AND method='pluggy' AND state IN ('connected','attention') AND activated_at IS NOT NULL`)).rows;
    for (const c of rows) {
      const binding = openBankData(c.secret, c.id); if (binding.itemId !== body.itemId) continue;
      await this.deps.lock(c.bia_id, async tx => {
        const event = (await tx.execute(sql`INSERT INTO bia_bank_events(id,environment,provider,event_key,connection_id,action) VALUES(${randomUUID()},${this.environment},'pluggy',${body.eventId + ":" + c.id},${c.id},'sync_requested') ON CONFLICT DO NOTHING RETURNING id`)).rows[0];
        if (!event) return;
        // Crédito removido pode ser estorno. Pausar é conservador: o evento nunca desfaz pagamento/CPP.
        if (body.event === "transactions/deleted") {
          await tx.execute(sql`UPDATE bia_bank_connections SET auto_enabled=false,error_code='RECEIPT_REMOVED' WHERE id=${c.id}`);
          await tx.execute(sql`UPDATE bia_bank_receipts SET state='review',error_code='RECEIPT_REMOVED',updated_at=now() WHERE connection_id=${c.id} AND state IN ('suggested','applying','reconciled')`);
        }
        await tx.execute(sql`UPDATE bia_bank_connections SET next_sync_at=now(),sync_from=activated_at,sync_to=NULL,sync_cursor=NULL WHERE id=${c.id} AND state<>'disconnected'`);
      });
    }
    return { accepted: true };
  }
  private busy = false;
  async tick() {
    if (this.busy || !this.enabled() || !await this.ready()) return;
    this.busy = true;
    try {
      const rows = (await this.deps.db.execute(sql`SELECT id,bia_id FROM bia_bank_connections WHERE environment=${this.environment} AND state IN ('connected','attention') AND activated_at IS NOT NULL AND next_sync_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_sync_at LIMIT 10`)).rows;
      for (const c of rows) { try { await this.sync(c.bia_id, c.id); } catch { /* Erro sanitizado preservado na conexão; recuperação no próximo ciclo. */ } }
    } finally { this.busy = false; }
  }
}
