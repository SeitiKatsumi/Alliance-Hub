import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AsaasError } from "./client";

const ALGORITHM = "aes-256-gcm";

function decodeKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (/^[a-fA-F0-9]{64}$/.test(value)) return Buffer.from(value, "hex");
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  return decoded.length === 32 ? decoded : null;
}

export function credentialVaultReady(raw: string): boolean {
  return decodeKey(raw) !== null;
}

export type EncryptedCredential = {
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
  keyFingerprint: string;
};

export function encryptCredential(secret: string, rawKey: string): EncryptedCredential {
  const key = decodeKey(rawKey);
  if (!key) throw new AsaasError("CREDENTIAL_VAULT_NOT_CONFIGURED", "O cofre de credenciais Sandbox não está configurado.", 503);
  if (!secret.trim() || secret.length > 16_384) throw new AsaasError("INVALID_PROVIDER_CREDENTIAL", "A credencial retornada pelo Asaas é inválida.", 502);
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, initializationVector);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    initializationVector: initializationVector.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
    keyFingerprint: createHash("sha256").update(key).digest("hex").slice(0, 16),
  };
}

export function decryptCredential(value: EncryptedCredential, rawKey: string): string {
  const key = decodeKey(rawKey);
  if (!key) throw new AsaasError("CREDENTIAL_VAULT_NOT_CONFIGURED", "O cofre de credenciais Sandbox não está configurado.", 503);
  const fingerprint = createHash("sha256").update(key).digest("hex").slice(0, 16);
  if (fingerprint !== value.keyFingerprint) throw new AsaasError("CREDENTIAL_KEY_MISMATCH", "A chave do cofre Sandbox não corresponde à credencial armazenada.", 503);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(value.initializationVector, "base64"));
    decipher.setAuthTag(Buffer.from(value.authenticationTag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
    if (!plain) throw new Error("empty");
    return plain;
  } catch {
    throw new AsaasError("CREDENTIAL_DECRYPTION_FAILED", "Não foi possível abrir a credencial da subconta Sandbox.", 503);
  }
}
