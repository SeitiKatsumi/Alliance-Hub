import type { AsaasEnvironment, AsaasStatus } from "../../shared/asaas";

export type AsaasConfig = {
  environment: AsaasEnvironment; configurationValid: boolean; enabled: boolean; baasEnabled: boolean;
  apiKey: string; webhookToken: string; baseUrl: string;
};
const urls = { sandbox: "https://api-sandbox.asaas.com/v3", production: "https://api.asaas.com/v3" } as const;

export function asaasConfig(env: Record<string, string | undefined> = process.env): AsaasConfig {
  const selected = env.ASAAS_BASE_ENVIRONMENT || "sandbox";
  const environment: AsaasEnvironment = selected === "production" ? "production" : "sandbox";
  const valid = selected === "sandbox" || selected === "production";
  // Nunca herdar ASAAS_API_KEY/ASAAS_WEBHOOK_TOKEN, usados pela integração antiga.
  return {
    environment, configurationValid: valid, enabled: valid && env.ASAAS_BASE_ENABLED === "true",
    baasEnabled: valid && env.ASAAS_BAAS_ENABLED === "true",
    apiKey: environment === "sandbox" && valid ? (env.ASAAS_SANDBOX_API_KEY || "").trim() : "",
    webhookToken: environment === "sandbox" && valid ? (env.ASAAS_SANDBOX_WEBHOOK_TOKEN || "").trim() : "",
    baseUrl: urls[environment],
  };
}

export function publicAsaasStatus(config: AsaasConfig, storageReady: boolean): AsaasStatus {
  const pending: string[] = [];
  if (!config.configurationValid) pending.push("Selecionar um ambiente válido.");
  if (config.environment === "production") pending.push("Produção bloqueada até a homologação.");
  if (!config.enabled) pending.push("Habilitar a base no ambiente de testes.");
  if (!config.apiKey) pending.push("Configurar a chave própria do Sandbox.");
  if (!config.webhookToken) pending.push("Configurar o token próprio do webhook Sandbox.");
  if (!config.baasEnabled) pending.push("Confirmar a habilitação BaaS com o Asaas.");
  if (!storageReady) pending.push("Aplicar a estrutura de armazenamento da integração.");
  pending.push("Definir a titularidade das contas e homologar as operações.");
  return {
    environment: config.environment, enabled: config.enabled, configurationValid: config.configurationValid,
    credentialsPresent: !!config.apiKey, webhookTokenPresent: !!config.webhookToken, baasEnabled: config.baasEnabled,
    storageReady, operationsEnabled: false, externalRequestsEnabled: false,
    state: config.environment === "production" ? "production_blocked" : !config.enabled ? "disabled"
      : !config.configurationValid || !config.apiKey || !config.webhookToken || !storageReady ? "configuration_pending" : "foundation_ready",
    pending,
    capabilities: [
      { id: "accounts", label: "Contas e onboarding BaaS", available: false },
      { id: "charges", label: "Cobranças Pix, boleto e cartão", available: false },
      { id: "statements", label: "Saldo, extrato e comprovantes", available: false },
      { id: "split", label: "Split e repasses", available: false },
    ],
  };
}
