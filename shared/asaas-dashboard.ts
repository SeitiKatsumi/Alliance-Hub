import { z } from "zod";

export const bankPeriodSchema = z.enum(["30", "90", "365", "all"]).default("90");
export type BankPeriod = z.infer<typeof bankPeriodSchema>;
export const bankEntrySchema = z.object({
  id: z.string(), status: z.string(), value: z.number().finite().nonnegative(),
  createdAt: z.string().nullable(), dueDate: z.string().nullable(), paidAt: z.string().nullable(),
  method: z.string().nullable(), netValue: z.number().finite().nullable(),
  receiptUrl: z.string().nullable(), invoiceUrl: z.string().nullable(),
});
export type BankEntry = z.infer<typeof bankEntrySchema>;
const collectionSchema = z.object({
  items: z.array(bankEntrySchema), complete: z.boolean(), available: z.boolean(),
  totalCount: z.number().int().nonnegative().nullable(), error: z.string().nullable(),
});
export const bankDashboardSchema = z.object({
  environment: z.enum(["sandbox", "production"]), scope: z.literal("company_account"),
  checkedAt: z.string(), from: z.string().nullable(), to: z.string(),
  balance: z.number().finite().nullable(), balanceError: z.string().nullable(),
  payments: collectionSchema, transfers: collectionSchema,
});
export type BankDashboardData = z.infer<typeof bankDashboardSchema>;
export type BankCollection = BankDashboardData["payments"];
export type BankGroup = "received" | "confirmed" | "pending" | "overdue" | "refunded" | "disputed" | "external" | "completed" | "failed" | "cancelled" | "other";

export function bankEntryGroup(kind: "payments" | "transfers", status: string): BankGroup {
  if (kind === "transfers") {
    if (status === "DONE") return "completed";
    if (["PENDING", "BANK_PROCESSING"].includes(status)) return "pending";
    if (status === "FAILED") return "failed";
    if (status === "CANCELLED") return "cancelled";
    return "other";
  }
  if (status === "RECEIVED") return "received";
  if (status === "CONFIRMED") return "confirmed";
  if (["PENDING", "AWAITING_RISK_ANALYSIS", "DUNNING_REQUESTED"].includes(status)) return "pending";
  if (status === "OVERDUE") return "overdue";
  if (["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS"].includes(status)) return "refunded";
  if (["CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(status)) return "disputed";
  if (status === "RECEIVED_IN_CASH") return "external";
  return "other";
}

const labels: Record<string, string> = {
  RECEIVED: "Recebida", CONFIRMED: "Confirmada · aguardando crédito", PENDING: "Pendente",
  OVERDUE: "Vencida", RECEIVED_IN_CASH: "Recebida fora do Asaas", REFUNDED: "Estornada",
  REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Contestação solicitada", CHARGEBACK_DISPUTE: "Em contestação",
  AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão", AWAITING_RISK_ANALYSIS: "Em análise",
  DUNNING_REQUESTED: "Recuperação solicitada", DUNNING_RECEIVED: "Recuperação recebida",
  DONE: "Concluída", BANK_PROCESSING: "Em processamento", FAILED: "Falhou", CANCELLED: "Cancelada",
};
export const bankStatusLabel = (status: string) => labels[status] || `Outra situação (${status})`;
export const bankMethodLabel = (method: string | null) => ({ PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão", TED: "TED", INTERNAL: "Entre contas Asaas", ASAAS_ACCOUNT: "Entre contas Asaas", BANK_ACCOUNT: "Conta bancária", UNDEFINED: "A definir" }[method || ""] || method || "Não informado");

// A total is the face value of the selected records, never an account balance or net cash flow.
export function bankTotals(items: BankEntry[], kind: "payments" | "transfers", group?: BankGroup) {
  const selected = group ? items.filter(item => bankEntryGroup(kind, item.status) === group) : items;
  return { count: selected.length, value: selected.reduce((total, item) => total + Math.round(item.value * 100), 0) / 100 };
}
