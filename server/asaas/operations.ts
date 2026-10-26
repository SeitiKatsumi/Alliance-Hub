import { z } from "zod";
import { asaasTransferSchema, type AsaasTransferInput } from "../../shared/asaas";
import { cents, safeAsaasUrl } from "../../shared/contribution-billing";
import { AsaasError, AsaasTransport } from "./client";
import type { AsaasConfig } from "./config";
import { decryptCredential } from "./credentials";
import { AsaasStore } from "./store";
import { readBankDashboard } from "./dashboard";
import type { BankPeriod } from "../../shared/asaas-dashboard";

type Transport = Pick<AsaasTransport, "request">;
type TransportFactory = (config: AsaasConfig) => Transport;
const transferResponse = z.object({
  id: z.string().min(1).max(255), status: z.string().optional(), value: z.coerce.number().nonnegative().optional(),
  dateCreated: z.string().optional(), transferDate: z.string().optional(), effectiveDate: z.string().nullable().optional(),
  type: z.string().optional(), operationType: z.string().nullable().optional(), externalReference: z.string().nullable().optional(),
  transactionReceiptUrl: z.string().nullable().optional(),
}).passthrough();
const transferList = z.object({ data: z.array(transferResponse), hasMore: z.boolean().optional() }).passthrough();
const balanceResponse = z.object({ balance: z.coerce.number().finite().nonnegative() }).passthrough();

function operationState(status?: string): "pending" | "completed" | "rejected" | "cancelled" {
  if (status === "DONE") return "completed";
  if (status === "FAILED") return "rejected";
  if (status === "CANCELLED") return "cancelled";
  return "pending";
}

function publicTransfer(raw: z.infer<typeof transferResponse>) {
  return {
    id: raw.id, status: raw.status || "PENDING", value: raw.value || 0,
    date: raw.effectiveDate || raw.transferDate || raw.dateCreated || null,
    type: raw.type || null, operationType: raw.operationType || null,
    receiptUrl: safeAsaasUrl(raw.transactionReceiptUrl),
  };
}

export class AsaasAccountOperations {
  constructor(
    private readonly store: AsaasStore,
    private readonly config: AsaasConfig,
    private readonly transportFactory: TransportFactory = config => new AsaasTransport(config),
  ) {}

  private async connected(biaId: string) {
    if (!this.config.configurationValid || !this.config.enabled || !this.config.baasEnabled || !this.config.productionOperationsEnabled) {
      throw new AsaasError("OPERATIONS_DISABLED", "As operações deste ambiente ainda não estão habilitadas.", 503);
    }
    const account = await this.store.internalAccountForBia(biaId);
    if (!account?.id || !account.external_account_id || account.state !== "approved") {
      throw new AsaasError("ACCOUNT_PENDING", "A conta da empresa precisa estar aprovada antes de operar.", 409);
    }
    const encrypted = await this.store.accountCredential(String(account.id));
    if (!encrypted) throw new AsaasError("ACCOUNT_CREDENTIAL_PENDING", "A credencial da conta não está disponível.", 503);
    const apiKey = decryptCredential(encrypted, this.config.credentialEncryptionKey);
    return { account, transport: this.transportFactory({ ...this.config, apiKey }) };
  }

  async dashboard(biaId: string, period: BankPeriod) {
    const { transport } = await this.connected(biaId);
    return readBankDashboard(transport, this.config.environment, period);
  }

  async overview(biaId: string) {
    const { transport } = await this.connected(biaId);
    const [balance, listed] = await Promise.all([
      transport.request("/finance/balance").then(value => balanceResponse.parse(value)),
      transport.request("/transfers?limit=20").then(value => transferList.parse(value)),
    ]);
    for (const item of listed.data) await this.store.reconcileExternalOperation(item.id, operationState(item.status));
    return { environment: this.config.environment, balance: balance.balance, transfers: listed.data.map(publicTransfer), hasMore: listed.hasMore === true };
  }

  async transfer(biaId: string, actorId: string, raw: AsaasTransferInput) {
    if (!this.config.transfersEnabled) throw new AsaasError("TRANSFERS_DISABLED", "Transferências ainda não estão habilitadas neste ambiente.", 503);
    const input = asaasTransferSchema.parse(raw);
    const { account, transport } = await this.connected(biaId);
    const amountCents = cents(input.value);
    const balance = balanceResponse.parse(await transport.request("/finance/balance"));
    if (amountCents > cents(balance.balance)) throw new AsaasError("INSUFFICIENT_BALANCE", "Saldo disponível insuficiente para a transferência.", 422);
    const externalReference = `built:transfer:${this.config.environment}:${biaId}:${input.idempotencyKey}`;
    const body = input.destinationType === "PIX"
      ? { value: amountCents / 100, pixAddressKey: input.pixAddressKey, pixAddressKeyType: input.pixAddressKeyType, description: input.description || undefined, externalReference }
      : { value: amountCents / 100, walletId: input.walletId, externalReference };
    const operation = await this.store.prepareOperation({
      biaId, accountId: String(account.id), actorId, kind: input.destinationType === "PIX" ? "transfer_pix" : "transfer_asaas",
      amountCents, externalReference, idempotencyKey: input.idempotencyKey, request: body,
    });
    if (["pending", "completed"].includes(String(operation.state))) return { operation: { id: operation.id, state: operation.state, externalId: operation.external_id || null } };
    if (operation.state !== "prepared") throw new AsaasError("TRANSFER_UNCONFIRMED", "A transferência já foi enviada ou está sem confirmação. Consulte o histórico antes de repetir.", 409);
    await this.store.transition(String(operation.id), "prepared", "sent");
    try {
      const transfer = transferResponse.parse(await transport.request("/transfers", { method: "POST", body }));
      const state = operationState(transfer.status);
      await this.store.recordExternalOperation(String(operation.id), transfer.id, state === "completed" ? "completed" : "pending");
      return { operation: { id: operation.id, state, externalId: transfer.id }, transfer: publicTransfer(transfer) };
    } catch (error) {
      const rejected = error instanceof AsaasError && error.code === "PROVIDER_REJECTED";
      await this.store.transition(String(operation.id), "sent", rejected ? "rejected" : "unknown").catch(() => null);
      if (rejected) throw error;
      throw new AsaasError("TRANSFER_UNCONFIRMED", "O resultado da transferência não foi confirmado. Consulte o histórico; não repita a operação.", 503);
    }
  }
}
