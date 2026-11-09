import { request as httpsRequest } from "node:https";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { EXTERNAL_BANKS, bankIdSchema, accountKindSchema, bankMoneyCents, completeBankDocument, normalizeBankDocument, type BankReceipt, type ExternalBankId, type AccountKind, type BankEnvironment } from "../shared/external-banking";
import { isolatedStage } from "./isolated-stage";

export class BankingError extends Error {
  constructor(public code: string, message = "Não foi possível concluir a conexão bancária.", public statusCode = 409) { super(message); }
}
const bad = () => new BankingError("INVALID_BANK_RESPONSE", "O banco não retornou os dados necessários para validar esta operação.", 502);
export const bankingEnvironment = (): BankEnvironment => process.env.BUILT_BANKING_ENVIRONMENT === "production" ? "production" : "sandbox";
export function bankingEnabled() {
  return !isolatedStage() && process.env.BUILT_BANKING_ENABLED === "true"
    && /^[a-f\d]{64}$/i.test(process.env.BUILT_BANKING_VAULT_KEY || "")
    && (bankingEnvironment() === "sandbox" || process.env.BUILT_BANKING_PRODUCTION_ENABLED === "true");
}
const key = () => {
  const value = process.env.BUILT_BANKING_VAULT_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(value)) throw new BankingError("VAULT_PENDING", "Cofre bancário aguardando configuração.", 503);
  return Buffer.from(value, "hex");
};
export function sealBankData(value: unknown, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function openBankData(value: any, context: string): any {
  try {
    const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64"));
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]).toString("utf8"));
  } catch { throw new BankingError("VAULT_UNAVAILABLE", "Não foi possível acessar a conexão bancária com segurança.", 503); }
}
// Credenciais/certificados persistidos só como ciphertext. Variáveis em claro são aceitas apenas em testes/sandbox.
export function bankCredential(name: string): string | undefined {
  const vault = process.env.BUILT_BANKING_CREDENTIALS;
  if (vault) {
    let sealed: unknown; try { sealed = JSON.parse(vault); } catch { throw new BankingError("VAULT_UNAVAILABLE"); }
    const value = openBankData(sealed, `banking:credentials:${bankingEnvironment()}`)?.[name];
    return typeof value === "string" && value ? value : undefined;
  }
  return bankingEnvironment() === "sandbox" ? process.env[name] : undefined;
}
export const bankDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export type VerifiedBankAccount = { externalId: string; number: string; ownerDocument: string; kind: AccountKind; bank: ExternalBankId; itemId?: string };
export type BankPage = { receipts: BankReceipt[]; next: string | null };
export interface ReceiptBankProvider {
  verify(binding: any): Promise<VerifiedBankAccount>;
  receipts(account: VerifiedBankAccount, from: string, to: string, cursor: string | null): Promise<BankPage>;
}
const hosts: Record<string, string[]> = {
  c6: ["c6bank.com.br"], sicoob: ["sicoob.com.br"], inter: ["bancointer.com.br", "inter.co", "uatinter.co"], bb: ["bb.com.br"],
  bradesco: ["bradesco.com.br", "bradesco"], santander: ["santander.com.br"], itau: ["itau.com.br"], btg: ["btgpactual.com"], sicredi: ["sicredi.com.br"],
  pluggy: ["api.pluggy.ai"],
};
export function validateBankUrl(raw: string, bank: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash
    || !(hosts[bank] || []).some(h => url.hostname === h || url.hostname.endsWith("." + h))) throw new BankingError("UNSAFE_BANK_ENDPOINT", "Endereço de integração não autorizado.", 503);
  return url;
}
export type BankHttp = (url: string, options: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: unknown; form?: Record<string, string>; cert?: string; privateKey?: string }) => Promise<any>;
export const bankHttp: BankHttp = async (raw, options) => new Promise((resolve, reject) => {
  const fail = () => reject(new BankingError("BANK_UNAVAILABLE", "Banco indisponível; os dados anteriores foram preservados.", 503));
  const body = options.form ? new URLSearchParams(options.form).toString() : options.body === undefined ? undefined : JSON.stringify(options.body);
  const req = httpsRequest(raw, { method: options.method || "GET", cert: options.cert, key: options.privateKey,
    rejectUnauthorized: true, headers: { accept: "application/json", ...(body ? { "content-type": options.form ? "application/x-www-form-urlencoded" : "application/json" } : {}), ...options.headers } }, res => {
    if (res.statusCode === 401 || res.statusCode === 403) { res.resume(); reject(new BankingError("ACCESS_EXPIRED", "A autorização bancária precisa ser renovada.", 409)); return; }
    if (res.statusCode === 429) { res.resume(); reject(new BankingError("RATE_LIMIT", "Limite de consultas atingido; nova tentativa será agendada.", 503)); return; }
    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300 || !/application\/json/i.test(res.headers["content-type"] || "")) { res.resume(); fail(); return; }
    const chunks: Buffer[] = []; let size = 0;
    res.on("data", chunk => { size += chunk.length; if (size > 5_000_000) { res.destroy(); fail(); } else chunks.push(chunk); });
    res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(bad()); } });
    res.on("error", fail);
  });
  req.setTimeout(15_000, () => { req.destroy(); fail(); }); req.on("error", fail); req.end(body);
});
const fieldPath = z.string().min(1).max(150).regex(/^[a-zA-Z0-9_.]+$/);
const profileSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), biaId: z.string().min(1), environment: z.enum(["sandbox", "production"]),
  bank: bankIdSchema, kind: accountKindSchema, contractApproved: z.boolean(), homologated: z.boolean(), costs: z.string().min(1).max(500),
  baseUrl: z.string().url(), tokenUrl: z.string().url(), clientIdEnv: z.string(), clientSecretEnv: z.string().optional(), certEnv: z.string(), privateKeyEnv: z.string(), scope: z.string().min(1),
  identity: z.object({ path: z.string(), account: fieldPath, document: fieldPath }),
  receipts: z.object({ path: z.string(), rows: fieldPath, id: fieldPath, amount: fieldPath, date: fieldPath, direction: fieldPath, creditValue: z.string(), status: fieldPath, settledValue: z.string(), reversedValue: z.string().optional(), currency: fieldPath.optional(), payerDocument: fieldPath.optional(), payerName: fieldPath.optional(), description: fieldPath.optional(), endToEndId: fieldPath.optional(), reference: fieldPath.optional(), next: fieldPath.optional(), fromParam: z.string(), toParam: z.string(), cursorParam: z.string().optional() }),
}).strict();
export type DirectBankProfile = z.infer<typeof profileSchema>;
export function directBankProfiles(): DirectBankProfile[] {
  try { return z.array(profileSchema).parse(JSON.parse(process.env.BUILT_BANKING_DIRECT_PROFILES || "[]")); }
  catch { throw new BankingError("PROFILE_CONFIG_INVALID", "Configuração dos conectores diretos inválida.", 503); }
}
const at = (value: any, path?: string): any => path ? path.split(".").reduce((v, k) => v && Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined, value) : undefined;
const textValue = (v: any) => typeof v === "string" || typeof v === "number" ? String(v) : "";
function checkedAccount(a: VerifiedBankAccount) {
  if (!a.externalId || !a.number || /[*xX•]/.test(a.number) || !completeBankDocument(a.ownerDocument)) throw bad();
  if ((normalizeBankDocument(a.ownerDocument).length === 11 ? "PF" : "PJ") !== a.kind) throw bad();
  return { ...a, ownerDocument: normalizeBankDocument(a.ownerDocument) };
}
// O contrato de cada banco é configurado pelo operador após ler a especificação concedida à conta.
// Nenhuma URL, mapeamento, credencial ou alegação de homologação é aceita do navegador.
export class DirectReceiptProvider implements ReceiptBankProvider {
  constructor(readonly profile: DirectBankProfile, private http: BankHttp = bankHttp) {
    if (!EXTERNAL_BANKS.find(b => b.id === profile.bank)?.direct) throw bad();
    validateBankUrl(profile.baseUrl, profile.bank); validateBankUrl(profile.tokenUrl, profile.bank);
    for (const path of [profile.identity.path, profile.receipts.path]) if (!/^\/[a-zA-Z0-9/_-]+$/.test(path)) throw bad();
    if (!profile.contractApproved || (profile.environment === "production" && !profile.homologated)) throw new BankingError("CONTRACT_PENDING", "Acesso direto aguarda habilitação e homologação.");
    if (!/\bread\b|\.read|:read/.test(profile.scope) || /write|pagamento|transfer|cob\.write/i.test(profile.scope)) throw new BankingError("READ_SCOPE_REQUIRED", "A conexão deve usar apenas permissões de consulta.");
  }
  private async get(path: string, query: URLSearchParams = new URLSearchParams()) {
    const p = this.profile;
    const cert = bankCredential(p.certEnv), privateKey = bankCredential(p.privateKeyEnv), clientId = bankCredential(p.clientIdEnv);
    if (!cert || !privateKey || !clientId) throw new BankingError("CREDENTIALS_PENDING", "Credenciais e certificado de consulta ainda não configurados.");
    const token = await this.http(validateBankUrl(p.tokenUrl, p.bank).href, { method: "POST", cert, privateKey,
      form: { grant_type: "client_credentials", client_id: clientId, ...(p.clientSecretEnv ? { client_secret: bankCredential(p.clientSecretEnv) || "" } : {}), scope: p.scope } });
    if (typeof token.access_token !== "string" || !token.access_token) throw bad();
    const url = new URL(path, p.baseUrl); url.search = query.toString(); validateBankUrl(url.href, p.bank);
    return this.http(url.href, { cert, privateKey, headers: { authorization: `Bearer ${token.access_token}`, client_id: clientId } });
  }
  async verify() {
    const p = this.profile, data = await this.get(p.identity.path);
    const number = textValue(at(data, p.identity.account)), document = textValue(at(data, p.identity.document));
    return checkedAccount({ externalId: number, number, ownerDocument: document, kind: p.kind, bank: p.bank });
  }
  async receipts(account: VerifiedBankAccount, from: string, to: string, cursor: string | null) {
    const r = this.profile.receipts, params = new URLSearchParams({ [r.fromParam]: from, [r.toParam]: to });
    if (cursor) { if (!r.cursorParam) throw bad(); params.set(r.cursorParam, cursor); }
    const data = await this.get(r.path, params), rows = at(data, r.rows);
    if (!Array.isArray(rows)) throw bad();
    const receipts: BankReceipt[] = [];
    for (const row of rows) {
      if (textValue(at(row, r.direction)) !== r.creditValue) continue;
      const id = textValue(at(row, r.id)), date = textValue(at(row, r.date)), state = textValue(at(row, r.status));
      if (!id || !Number.isFinite(Date.parse(date))) throw bad();
      const amountCents = bankMoneyCents(at(row, r.amount)); if (amountCents <= 0) continue;
      receipts.push({ id, bankTransactionId: id, amountCents, receivedAt: new Date(date).toISOString(),
        status: state === r.settledValue ? "settled" : r.reversedValue && state === r.reversedValue ? "reversed" : "pending",
        currency: r.currency ? textValue(at(row, r.currency)) : "BRL", description: textValue(at(row, r.description)).slice(0, 300),
        payerName: textValue(at(row, r.payerName)), payerDocument: textValue(at(row, r.payerDocument)), reference: textValue(at(row, r.reference)), endToEndId: textValue(at(row, r.endToEndId)) });
    }
    const next = at(data, r.next);
    if (next != null && typeof next !== "string" && typeof next !== "number") throw bad();
    return { receipts, next: next == null || next === "" ? null : String(next) };
  }
}

export class PluggyReceiptProvider implements ReceiptBankProvider {
  private token: string | null = null;
  private tokenUntil = 0;
  constructor(private http: BankHttp = bankHttp) {}
  async request(path: string, body?: unknown) {
    if (!this.token || Date.now() > this.tokenUntil) {
      const result = await this.http("https://api.pluggy.ai/auth", { method: "POST", body: { clientId: bankCredential("BUILT_PLUGGY_CLIENT_ID"), clientSecret: bankCredential("BUILT_PLUGGY_CLIENT_SECRET") } });
      if (typeof result.apiKey !== "string") throw bad(); this.token = result.apiKey; this.tokenUntil = Date.now() + 90 * 60_000;
    }
    if (!/^\/(?:items|accounts|connectors|connect_token|v2\/transactions)(?:[/?]|$)/.test(path) || path.includes("..")) throw bad();
    return this.http(new URL(path, "https://api.pluggy.ai").href, { method: body === undefined ? "GET" : "POST", body, headers: { "X-API-KEY": this.token! } });
  }
  async verify(binding: { itemId: string; accountId: string; clientUserId: string; connectorId: number; bank: ExternalBankId; kind: AccountKind }) {
    const item = await this.request(`/items/${encodeURIComponent(binding.itemId)}`);
    if (item.clientUserId !== binding.clientUserId || item.connector?.id !== binding.connectorId || !item.connector?.isOpenFinance || item.connector?.isSandbox && bankingEnvironment() !== "sandbox") throw bad();
    if (item.status !== "UPDATED" || item.executionStatus !== "SUCCESS") throw new BankingError("CONSENT_PENDING", "Aguarde a autorização e a atualização completa dos dados no banco.");
    const account = await this.request(`/accounts/${encodeURIComponent(binding.accountId)}`);
    if (account.itemId !== item.id || account.type !== "BANK" || account.currencyCode !== "BRL") throw bad();
    return checkedAccount({ bank: binding.bank, kind: binding.kind, itemId: item.id, externalId: account.id,
      number: account.bankData?.transferNumber || account.number, ownerDocument: account.taxNumber });
  }
  async receipts(account: VerifiedBankAccount, from: string, to: string, cursor: string | null) {
    const query = new URLSearchParams({ accountId: account.externalId, dateFrom: from.slice(0, 10), dateTo: to.slice(0, 10) });
    if (cursor) query.set("after", cursor);
    const data = await this.request(`/v2/transactions?${query}`); if (!Array.isArray(data.results)) throw bad();
    const receipts: BankReceipt[] = [];
    for (const r of data.results) {
      if (r.accountId !== account.externalId) throw bad();
      if (r.type !== "CREDIT") continue;
      if (!r.id || !Number.isFinite(Date.parse(r.date))) throw bad();
      const amountCents = bankMoneyCents(r.amount); if (amountCents <= 0) continue;
      receipts.push({ id: r.id, bankTransactionId: r.providerId || r.id, amountCents, currency: r.currencyCode,
        status: r.status === "POSTED" ? "settled" : "pending", receivedAt: new Date(r.date).toISOString(), description: String(r.description || "").slice(0, 300),
        payerName: r.paymentData?.payer?.name || "", payerDocument: r.paymentData?.payer?.documentNumber?.value || "",
        reference: r.paymentData?.referenceNumber || "", endToEndId: r.paymentData?.endToEndId || "" });
    }
    let next: string | null = null;
    if (data.next != null) {
      if (typeof data.next !== "string" || !data.next.startsWith("?")) throw bad();
      const q = new URLSearchParams(data.next);
      if (q.get("accountId") !== account.externalId || !q.get("after")) throw bad();
      next = q.get("after");
    }
    return { receipts, next };
  }
}
