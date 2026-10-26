import { createHash } from "node:crypto";
import { z } from "zod";
import { asaasSubaccountCreateSchema, type AsaasSubaccountCreate } from "../../shared/asaas";
import { AsaasError, AsaasTransport } from "./client";
import type { AsaasConfig } from "./config";
import { credentialVaultReady, decryptCredential, encryptCredential } from "./credentials";
import { AsaasStore, requestHash } from "./store";

type Transport = Pick<AsaasTransport, "request">;
type TransportFactory = (config: AsaasConfig) => Transport;

const creationResponseSchema = z.object({
  id: z.string().min(1).max(255),
  walletId: z.string().min(1).max(255),
  apiKey: z.string().min(1).max(16_384),
}).passthrough();
const listedAccountsSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1).max(255) }).passthrough()),
  hasMore: z.boolean().optional(),
}).passthrough();
const accountStatusSchema = z.object({ general: z.string().min(1).max(100) }).passthrough();

const accountStatus = (general: string): "pending" | "in_review" | "approved" | "rejected" | "blocked" => {
  if (general === "APPROVED") return "approved";
  if (general === "AWAITING_APPROVAL") return "in_review";
  if (general === "REJECTED") return "rejected";
  if (general === "BLOCKED") return "blocked";
  return "pending";
};

function webhook(config: AsaasConfig, email: string) {
  if (!config.webhookUrl) return undefined;
  let url: URL;
  try { url = new URL(config.webhookUrl); }
  catch { throw new AsaasError("INVALID_WEBHOOK_URL", "A URL do webhook Asaas é inválida.", 503); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new AsaasError("INVALID_WEBHOOK_URL", "A URL do webhook Asaas deve ser HTTPS.", 503);
  return [{
    name: `BUILT ${config.environment === "sandbox" ? "Sandbox" : "Produção"} · operações`, url: url.toString(), email,
    sendType: "SEQUENTIALLY", interrupted: false, enabled: true, apiVersion: 3,
    authToken: config.webhookToken,
    events: [
      "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED", "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING", "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
      "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED", "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING", "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
      "ACCOUNT_STATUS_DOCUMENT_APPROVED", "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_DOCUMENT_PENDING", "ACCOUNT_STATUS_DOCUMENT_REJECTED",
      "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED", "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING", "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
      "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE",
      "PAYMENT_REFUNDED", "PAYMENT_DELETED",
      "TRANSFER_CREATED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING", "TRANSFER_BLOCKED",
      "TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED",
    ],
  }];
}

export function sandboxAccountCreationBlockers(config: AsaasConfig, storageReady: boolean, credentialStorageReady: boolean): string[] {
  const blockers: string[] = [];
  if (!config.configurationValid || !config.enabled || !config.apiKey) blockers.push(`A conta-pai de ${config.environment === "sandbox" ? "Sandbox" : "Produção"} não está configurada.`);
  if (!config.baasEnabled) blockers.push("O BaaS ainda não foi habilitado.");
  if (config.environment === "production" && !config.productionOperationsEnabled) blockers.push("As operações de Produção ainda não foram autorizadas neste servidor.");
  if (!storageReady || !credentialStorageReady) blockers.push("A estrutura de armazenamento das subcontas ainda não foi aplicada.");
  if (!credentialVaultReady(config.credentialEncryptionKey)) blockers.push(`O cofre de credenciais de ${config.environment === "sandbox" ? "Sandbox" : "Produção"} ainda não foi configurado.`);
  return blockers;
}

export class AsaasSandboxAccounts {
  constructor(
    private readonly store: AsaasStore,
    private readonly config: AsaasConfig,
    private readonly transportFactory: TransportFactory = config => new AsaasTransport(config),
  ) {}

  private async assertReady() {
    const storageReady = await this.store.storageReady();
    const credentialStorageReady = await this.store.credentialStorageReady();
    const blockers = sandboxAccountCreationBlockers(this.config, storageReady, credentialStorageReady);
    if (blockers.length) throw new AsaasError("ACCOUNT_CREATION_DISABLED", blockers[0], 503);
    await this.store.requireExclusiveStorage();
  }

  private ownerId(cnpj: string) {
    return `cnpj-sha256:${createHash("sha256").update(cnpj).digest("hex")}`;
  }

  private providerBody(input: z.output<typeof asaasSubaccountCreateSchema>) {
    const configuredWebhook = webhook(this.config, input.email);
    return {
      name: input.name, email: input.email, cpfCnpj: input.cpfCnpj, companyType: input.companyType,
      mobilePhone: input.mobilePhone, incomeValue: input.incomeValue, address: input.address,
      addressNumber: input.addressNumber, ...(input.complement ? { complement: input.complement } : {}),
      province: input.province, postalCode: input.postalCode, ...(input.taxRegime ? { taxRegime: input.taxRegime } : {}),
      ...(configuredWebhook ? { webhooks: configuredWebhook } : {}),
    };
  }

  async create(biaId: string, actorId: string, raw: AsaasSubaccountCreate) {
    await this.assertReady();
    const input = asaasSubaccountCreateSchema.parse(raw);
    const ownerId = this.ownerId(input.cpfCnpj);
    const linked = await this.store.internalAccountForBia(biaId);
    if (linked) return { created: false, reused: true, account: await this.store.accountForBia(biaId) };

    const known = await this.store.accountByOwner(ownerId);
    if (known?.external_account_id && await this.store.accountCredential(String(known.id))) {
      await this.store.linkAccount(biaId, String(known.id));
      return { created: false, reused: true, account: await this.store.accountForBia(biaId) };
    }
    if (known && await this.store.unresolvedAccountCreation(String(known.id))) {
      throw new AsaasError("ACCOUNT_CREATION_UNCONFIRMED", "Existe uma criação anterior sem confirmação. Não tente novamente; faça a conciliação antes de continuar.", 409);
    }

    const parent = this.transportFactory(this.config);
    const listed = listedAccountsSchema.parse(await parent.request(`/accounts?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}&limit=2`));
    if (listed.data.length) throw new AsaasError("ACCOUNT_ALREADY_EXISTS_PROVIDER", `Já existe uma subconta com este CNPJ no Asaas ${this.config.environment === "sandbox" ? "Sandbox" : "Produção"}, mas a credencial não está vinculada à BUILT.`, 409);

    const draft = await this.store.createAccountDraft(ownerId, input.name);
    if (!draft?.id) throw new AsaasError("ACCOUNT_DRAFT_FAILED", "Não foi possível preparar a criação da subconta.", 503);
    const providerBody = this.providerBody(input);
    const hash = requestHash(providerBody);
    const operation = await this.store.prepareOperation({
      biaId: null, accountId: String(draft.id), actorId, kind: "create_subaccount", amountCents: 0,
      externalReference: `asaas-subaccount:${ownerId}`, idempotencyKey: `create-subaccount:${hash.slice(0, 48)}`, request: providerBody,
    });
    if (operation.state === "completed") {
      await this.store.linkAccount(biaId, String(draft.id));
      return { created: false, reused: true, account: await this.store.accountForBia(biaId) };
    }
    if (operation.state === "rejected") throw new AsaasError("ACCOUNT_DATA_REJECTED", "O Asaas já recusou estes mesmos dados. Corrija o cadastro antes de tentar novamente.", 422);
    if (operation.state !== "prepared") throw new AsaasError("ACCOUNT_CREATION_UNCONFIRMED", "A criação já está em processamento ou sem confirmação. Não tente novamente.", 409);

    if (!(await this.store.claimAccountCreation(String(draft.id)))) throw new AsaasError("ACCOUNT_CREATION_UNCONFIRMED", "A criação já está em processamento ou sem confirmação. Não tente novamente.", 409);
    await this.store.transition(String(operation.id), "prepared", "sent");
    try {
      const created = creationResponseSchema.parse(await parent.request("/accounts", { method: "POST", body: providerBody }));
      const credential = encryptCredential(created.apiKey, this.config.credentialEncryptionKey);
      await this.store.saveCreatedAccount({
        biaId, accountId: String(draft.id), label: input.name, externalAccountId: created.id,
        walletId: created.walletId, credential, state: "pending",
      });
      await this.store.transition(String(operation.id), "sent", "completed").catch(() => null);
      await this.refresh(biaId).catch(() => null);
      return { created: true, reused: false, account: await this.store.accountForBia(biaId) };
    } catch (error) {
      const providerRejected = error instanceof AsaasError && error.code === "PROVIDER_REJECTED";
      await this.store.transition(String(operation.id), "sent", providerRejected ? "rejected" : "unknown").catch(() => null);
      await this.store.setAccountState(String(draft.id), providerRejected ? "rejected" : "pending").catch(() => null);
      if (providerRejected) throw error;
      if (error instanceof AsaasError && error.code === "ACCOUNT_PERSISTENCE_FAILED") throw error;
      throw new AsaasError("ACCOUNT_CREATION_UNCONFIRMED", "O resultado da criação não foi confirmado. Não tente novamente; faça a conciliação antes de continuar.", 503);
    }
  }

  async refresh(biaId: string) {
    await this.assertReady();
    const account = await this.store.internalAccountForBia(biaId);
    if (!account?.id || !account.external_account_id) throw new AsaasError("ACCOUNT_NOT_LINKED", "Nenhuma subconta está vinculada a esta BIA.", 404);
    const encrypted = await this.store.accountCredential(String(account.id));
    if (!encrypted) throw new AsaasError("ACCOUNT_CREDENTIAL_PENDING", "A credencial da subconta ainda não está disponível.", 503);
    const apiKey = decryptCredential(encrypted, this.config.credentialEncryptionKey);
    const transport = this.transportFactory({ ...this.config, apiKey });
    const status = accountStatusSchema.parse(await transport.request("/myAccount/status"));
    await this.store.setAccountState(String(account.id), accountStatus(status.general));
    return await this.store.accountForBia(biaId);
  }
}
