import { z } from "zod";
import { bankPeriodSchema, type BankPeriod, type BankCollection, type BankDashboardData, type BankEntry } from "../../shared/asaas-dashboard";
import { safeAsaasUrl } from "../../shared/contribution-billing";
import type { AsaasTransport } from "./client";

const amount = z.number().finite();
const recordSchema = z.object({
  id: z.string().min(1), status: z.string().min(1), value: amount.nonnegative(),
  dateCreated: z.string().nullable().optional(), dueDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(), effectiveDate: z.string().nullable().optional(),
  scheduleDate: z.string().nullable().optional(), netValue: amount.nullable().optional(),
  type: z.string().nullable().optional(), operationType: z.string().nullable().optional(), billingType: z.string().nullable().optional(),
  transactionReceiptUrl: z.string().nullable().optional(), invoiceUrl: z.string().nullable().optional(),
});
const pageSchema = z.object({ data: z.array(recordSchema), hasMore: z.boolean(), totalCount: z.number().int().nonnegative().optional() });
type Transport = Pick<AsaasTransport, "request">;

export function bankDateRange(period: BankPeriod, now: Date) {
  bankPeriodSchema.parse(period);
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const from = period === "all" ? null : new Date(Date.parse(`${to}T12:00:00Z`) - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function project(raw: z.infer<typeof recordSchema>, kind: "payments" | "transfers"): BankEntry {
  return {
    id: raw.id, status: raw.status, value: raw.value, netValue: raw.netValue ?? null,
    createdAt: raw.dateCreated ?? null, dueDate: raw.dueDate ?? raw.scheduleDate ?? null,
    paidAt: kind === "payments" ? raw.paymentDate ?? null : raw.effectiveDate ?? null,
    method: kind === "payments" ? raw.billingType ?? null : raw.operationType ?? raw.type ?? null,
    receiptUrl: safeAsaasUrl(raw.transactionReceiptUrl), invoiceUrl: kind === "payments" ? safeAsaasUrl(raw.invoiceUrl) : null,
  };
}

async function collection(transport: Transport, kind: "payments" | "transfers", range: { from: string | null; to: string }): Promise<BankCollection> {
  const items = new Map<string, BankEntry>();
  let offset = 0, totalCount: number | null = null;
  const started = Date.now();
  try {
    // Bounded read, no polling/financial writes. A cap or failed next page is explicit, never a full total.
    for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
      const params = new URLSearchParams({ limit: "100", offset: String(offset), "dateCreated[le]": range.to });
      if (range.from) params.set("dateCreated[ge]", range.from);
      const page = pageSchema.parse(await transport.request(`/${kind}?${params}`));
      totalCount = page.totalCount ?? totalCount;
      const before = items.size;
      for (const row of page.data) items.set(row.id, project(row, kind));
      if (!page.hasMore) {
        const complete = totalCount === null || totalCount === items.size;
        return { items: [...items.values()], complete, available: true, totalCount, error: complete ? null : "A listagem mudou durante a consulta. Atualize para conferir o total." };
      }
      offset += page.data.length;
      if (!page.data.length || items.size === before || Date.now() - started > 10000) break;
    }
    return { items: [...items.values()], complete: false, available: true, totalCount, error: "Consulta parcial. Reduza o período para consultar menos registros." };
  } catch {
    return { items: [...items.values()], complete: false, available: items.size > 0, totalCount, error: "Não foi possível consultar todos os registros no Asaas. Tente novamente." };
  }
}

export async function readBankDashboard(transport: Transport, environment: "sandbox" | "production", period: BankPeriod, now = new Date()): Promise<BankDashboardData> {
  const range = bankDateRange(period, now);
  const [balance, payments, transfers] = await Promise.all([
    transport.request("/finance/balance").then(raw => z.object({ balance: amount }).parse(raw).balance).catch(() => null),
    collection(transport, "payments", range), collection(transport, "transfers", range),
  ]);
  return { environment, scope: "bia_account", checkedAt: new Date().toISOString(), ...range, balance,
    balanceError: balance === null ? "Saldo indisponível no Asaas." : null, payments, transfers };
}
