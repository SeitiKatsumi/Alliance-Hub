export type BankEnvironment = "dev" | "production";
export type BankProduct = "pix" | "banking";

export class BankError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}

export function bankConfig(environment: BankEnvironment, env = process.env) {
  const prefix = environment === "dev" ? "PINBANK_DEV_" : "PINBANK_PROD_";
  const read = (name: string) => env[prefix + name] || "";
  return {
    environment,
    baseUrl: environment === "dev" ? "https://dev.pinbank.com.br/services/api" : "https://pinbank.com.br/services/api",
    username: read("USERNAME"), keyValue: read("KEY_VALUE"),
    requestOrigin: read("REQUEST_ORIGIN") || (environment === "dev" ? "5" : ""),
    channel: Number(read("CODIGO_CANAL") || (environment === "dev" ? "47" : "0")),
    clients: { pix: environment === "dev" ? 3505 : 0, banking: environment === "dev" ? 3510 : 0 },
    storeKeys: { pix: read("PIX_KEY_LOJA"), banking: read("BANKING_KEY_LOJA") },
    termCode: read("CODIGO_TERMO"),
    enabled: read("ENABLED") === "true",
    newOperationsEnabled: read("NEW_OPERATIONS_ENABLED") === "true",
    methods: new Set(read("ENABLED_METHODS").split(",").map(s => s.trim()).filter(Boolean)),
  };
}

export function assertBankCredentials(config: ReturnType<typeof bankConfig>) {
  if (!config.enabled) throw new BankError("ENVIRONMENT_DISABLED", "Ambiente Pinbank desabilitado.");
  if (!config.username || Buffer.byteLength(config.keyValue, "utf8") !== 16 || !config.requestOrigin || !config.channel) {
    throw new BankError("CONFIGURATION_PENDING", "Configuração Pinbank incompleta no servidor.");
  }
}

export function bankUrl(base: string, path: string) {
  if (!/^\/api\/[A-Za-z0-9/]+$/.test(path)) throw new BankError("INVALID_PATH", "Método Pinbank inválido.", 400);
  const url = new URL(base);
  if (url.protocol !== "https:" || !["dev.pinbank.com.br", "pinbank.com.br"].includes(url.hostname) || url.port || url.username || url.password) {
    throw new BankError("INVALID_HOST", "Destino Pinbank inválido.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api$/, "") + path;
  url.search = ""; url.hash = "";
  return url.toString();
}
