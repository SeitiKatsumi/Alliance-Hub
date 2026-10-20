import type { AsaasEnvironment, AsaasStatus } from "../../shared/asaas";
import { credentialVaultReady } from "./credentials";

export type AsaasConfig = {
  environment: AsaasEnvironment; configurationValid: boolean; enabled: boolean; baasEnabled: boolean;
  chargesEnabled: boolean; transfersEnabled: boolean; productionOperationsEnabled: boolean;
  apiKey: string; webhookToken: string; webhookUrl: string; credentialEncryptionKey: string; baseUrl: string;
};
const urls = { sandbox: "https://api-sandbox.asaas.com/v3", production: "https://api.asaas.com/v3" } as const;

export function asaasConfig(env: Record<string, string | undefined> = process.env): AsaasConfig {
  const selected = env.ASAAS_BASE_ENVIRONMENT || "sandbox";
  const environment: AsaasEnvironment = selected === "production" ? "production" : "sandbox";
  const valid = selected === "sandbox" || selected === "production";
  // Nunca herdar ASAAS_API_KEY/ASAAS_WEBHOOK_TOKEN, usados pela integração antiga.
  const prefix = environment === "sandbox" ? "ASAAS_SANDBOX" : "ASAAS_PRODUCTION";
  return {
    environment, configurationValid: valid, enabled: valid && env.ASAAS_BASE_ENABLED === "true",
    baasEnabled: valid && env.ASAAS_BAAS_ENABLED === "true",
    chargesEnabled: valid && env.ASAAS_CONTRIBUTIONS_ENABLED === "true",
    transfersEnabled: valid && env.ASAAS_TRANSFERS_ENABLED === "true",
    productionOperationsEnabled: environment !== "production" || env.ASAAS_PRODUCTION_OPERATIONS_ENABLED === "true",
    apiKey: valid ? (env[`${prefix}_API_KEY`] || "").trim() : "",
    webhookToken: valid ? (env[`${prefix}_WEBHOOK_TOKEN`] || "").trim() : "",
    webhookUrl: valid ? (env[`${prefix}_WEBHOOK_URL`] || "").trim() : "",
    credentialEncryptionKey: valid ? (env[`${prefix}_CREDENTIAL_ENCRYPTION_KEY`] || "").trim() : "",
    baseUrl: urls[environment],
  };
}

export function publicAsaasStatus(config: AsaasConfig, storageReady: boolean, credentialStorageReady = storageReady): AsaasStatus {
  const vaultReady = credentialVaultReady(config.credentialEncryptionKey);
  const environmentReady = config.environment === "sandbox" || config.productionOperationsEnabled;
  const baseReady = config.configurationValid && config.enabled && config.baasEnabled && !!config.apiKey && !!config.webhookToken && !!config.webhookUrl && storageReady && credentialStorageReady && vaultReady && environmentReady;
  const pending: string[] = [];
  if (!config.configurationValid) pending.push("Selecionar um ambiente válido.");
  if (!config.enabled) pending.push("Habilitar a integração neste ambiente.");
  if (!config.apiKey) pending.push(`Configurar a chave própria de ${config.environment === "sandbox" ? "Sandbox" : "Produção"}.`);
  if (!config.webhookToken) pending.push(`Configurar o token do webhook de ${config.environment === "sandbox" ? "Sandbox" : "Produção"}.`);
  if (!config.webhookUrl) pending.push(`Configurar a URL pública do webhook de ${config.environment === "sandbox" ? "Sandbox" : "Produção"}.`);
  if (!config.baasEnabled) pending.push("Confirmar a habilitação BaaS com o Asaas.");
  if (!environmentReady) pending.push("Autorizar explicitamente as operações de Produção neste servidor.");
  if (!storageReady || !credentialStorageReady) pending.push("Aplicar a estrutura de armazenamento da integração.");
  if (!vaultReady) pending.push(`Configurar o cofre de credenciais de ${config.environment === "sandbox" ? "Sandbox" : "Produção"}.`);
  if (!config.chargesEnabled) pending.push("Habilitar cobranças de aportes neste ambiente.");
  if (!config.transfersEnabled) pending.push("Habilitar transferências neste ambiente.");
  const operationsEnabled = baseReady && (config.chargesEnabled || config.transfersEnabled);
  return {
    environment: config.environment, enabled: config.enabled, configurationValid: config.configurationValid,
    credentialsPresent: !!config.apiKey, webhookTokenPresent: !!config.webhookToken, baasEnabled: config.baasEnabled,
    storageReady, credentialVaultReady: vaultReady, operationsEnabled, externalRequestsEnabled: baseReady,
    state: !config.enabled ? "disabled" : !baseReady ? "configuration_pending" : operationsEnabled ? "operational" : "foundation_ready",
    pending,
    capabilities: [
      { id: "accounts", label: "Criação de subcontas BaaS", available: baseReady },
      { id: "onboarding", label: "Onboarding documental BaaS", available: false },
      { id: "charges", label: "Cobranças Pix e boleto", available: baseReady && config.chargesEnabled },
      { id: "transfers", label: "Transferências Pix e entre contas Asaas", available: baseReady && config.transfersEnabled },
      { id: "statements", label: "Saldo e histórico de transferências", available: baseReady },
      { id: "split", label: "Split e repasses", available: false },
    ],
  };
}
