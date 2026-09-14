import { createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { BankError } from "./config";

type SigningKey = JsonWebKey & { kid: string; crv: string; kty: string };
export class BankWebhookVerifier {
  private keys: SigningKey[] = [];
  private refreshed = 0;
  private pending?: Promise<void>;
  constructor(private fetcher: typeof fetch = fetch) {}
  async refresh() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const response = await this.fetcher("https://pinbank.com.br/webhook/signing-key", { redirect: "error", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new BankError("KEY_UNAVAILABLE", "Validação do webhook indisponível.");
      const body = await response.json();
      if (!Array.isArray(body?.jwks?.keys)) throw new BankError("KEY_UNAVAILABLE", "Chaves do webhook inválidas.");
      this.keys = body.jwks.keys.filter((k: SigningKey) => k.kty === "OKP" && k.crv === "Ed25519" && k.kid && k.x);
      this.refreshed = Date.now();
    })();
    try { await this.pending; } finally { this.pending = undefined; }
  }
  async validate(raw: Buffer, headers: { timestamp?: string; signature?: string; kid?: string }, now = Date.now()) {
    const { timestamp, signature, kid } = headers;
    if (!timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300_000 || !kid || !signature?.startsWith("v1a,")) {
      throw new BankError("INVALID_SIGNATURE", "Webhook inválido.", 401);
    }
    const encoded = signature.slice(4);
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== 64 || bytes.toString("base64") !== encoded) throw new BankError("INVALID_SIGNATURE", "Webhook inválido.", 401);
    if (!this.keys.length) await this.refresh();
    const check = () => {
      const key = this.keys.find(k => k.kid === kid);
      if (!key) return false;
      try { return verify(null, Buffer.concat([Buffer.from(timestamp + "."), raw]), createPublicKey({ key, format: "jwk" }), bytes); } catch { return false; }
    };
    if (check()) return;
    // Bound refresh attempts on attacker-controlled invalid signatures.
    if (Date.now() - this.refreshed > 60_000) { await this.refresh(); if (check()) return; }
    throw new BankError("INVALID_SIGNATURE", "Webhook inválido.", 401);
  }
}
