import { createCipheriv, createDecipheriv } from "node:crypto";
import { assertBankCredentials, BankError, bankUrl, type bankConfig } from "./config";

export function encryptBankBody(body: unknown, keyValue: string) {
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(keyValue, "utf8"), Buffer.alloc(16));
  return Buffer.concat([cipher.update(JSON.stringify(body), "utf8"), cipher.final()]).toString("base64");
}

export class BankTransport {
  private cached?: { value: string; expires: number };
  private pending?: Promise<string>;
  constructor(readonly config: ReturnType<typeof bankConfig>, private fetcher: typeof fetch = fetch) {}

  async token(): Promise<string> {
    assertBankCredentials(this.config);
    if (this.cached && this.cached.expires > Date.now()) return this.cached.value;
    if (this.pending) return this.pending;
    this.pending = this.fetchToken();
    try { return await this.pending; } finally { this.pending = undefined; }
  }

  private async fetchToken() {
    const response = await this.fetcher(bankUrl(this.config.baseUrl, "/api/token"), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: this.config.username, password: this.config.keyValue, grant_type: "password" }),
    });
    if (!response.ok) throw new BankError("AUTHENTICATION_FAILED", "Pinbank não autorizou a autenticação.");
    const data = await response.json();
    if (typeof data.access_token !== "string" || !data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) {
      throw new BankError("INVALID_TOKEN_RESPONSE", "Resposta de autenticação inválida.");
    }
    const ttl = Number(data.expires_in) * 1000;
    this.cached = { value: data.access_token, expires: Date.now() + Math.max(0, ttl - Math.min(30_000, ttl / 10)) };
    return data.access_token as string;
  }

  // Only a proven authentication rejection is retried. Timeouts and 5xx are never resent.
  async call(path: string, data: Record<string, unknown>, retryAuth = true): Promise<any> {
    const token = await this.token();
    let response: Response;
    try {
      response = await this.fetcher(bankUrl(this.config.baseUrl, path.endsWith("Encrypted") ? path : path + "Encrypted"), {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, UserName: this.config.username, RequestOrigin: this.config.requestOrigin },
        body: JSON.stringify({ Data: { Json: encryptBankBody({ Data: data }, this.config.keyValue) } }),
      });
    } catch { throw new BankError("RESULT_UNKNOWN", "Não foi possível confirmar o resultado. Conciliação necessária."); }
    if (response.status === 401 && retryAuth) { this.cached = undefined; return this.call(path, data, false); }
    if (!response.ok) throw new BankError(response.status >= 500 ? "RESULT_UNKNOWN" : "PROVIDER_REJECTED", "A Pinbank não confirmou a operação.");
    try {
      let result = await response.json();
      if (typeof result?.Data?.Json === "string") {
        const decipher = createDecipheriv("aes-128-cbc", Buffer.from(this.config.keyValue, "utf8"), Buffer.alloc(16));
        result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(result.Data.Json, "base64")), decipher.final()]).toString("utf8"));
      }
      // Null, booleans and blank strings must never coerce to a successful code.
      const validCode = (code: unknown) => (typeof code === "number" && Number.isSafeInteger(code)) || (typeof code === "string" && /^-?\d+$/.test(code));
      if (!validCode(result?.ResultCode)) throw new Error("invalid result");
      if (result.ValidationData != null && !validCode(result.ValidationData.ResultCode)) throw new Error("invalid validation result");
      if (Number(result.ResultCode) !== 0 || Number(result.ValidationData?.ResultCode ?? 0) !== 0) throw new BankError("PROVIDER_REJECTED", "A Pinbank recusou a solicitação. Confira os dados e a liberação do método.", 422);
      return result.Data;
    } catch (error) {
      if (error instanceof BankError) throw error;
      throw new BankError("RESULT_UNKNOWN", "Resposta Pinbank inválida. Conciliação necessária.");
    }
  }
}
