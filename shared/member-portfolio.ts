export const BUILT_MEMBER_ANNUAL_FEE_BRL = 3197;

export type MembershipStatus = "pending" | "active" | "expired" | "canceled" | "refunded" | "disputed";

export function membershipEndsAt(startsAt: Date): Date {
  const endsAt = new Date(startsAt);
  endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
  return endsAt;
}

export function isMembershipActive(
  membership: { status?: unknown; starts_at?: unknown; ends_at?: unknown } | null | undefined,
  now = new Date(),
): boolean {
  if (!membership || !["active", "canceled"].includes(String(membership.status || ""))) return false;
  const startsAt = new Date(String(membership.starts_at || ""));
  const endsAt = new Date(String(membership.ends_at || ""));
  return Number.isFinite(startsAt.getTime())
    && Number.isFinite(endsAt.getTime())
    && startsAt <= now
    && endsAt > now;
}

export type MapContribution = { memberId: string; name?: string; value: number };
export type MapTransfer = { status?: string; fromMemberId: string; toMemberId: string; value: number };

export function calculateMap(contributions: MapContribution[], transfers: MapTransfer[]) {
  const values = new Map<string, { memberId: string; name: string; value: number }>();
  for (const contribution of contributions) {
    if (!contribution.memberId || !Number.isFinite(contribution.value) || contribution.value <= 0) continue;
    const current = values.get(contribution.memberId) || { memberId: contribution.memberId, name: contribution.name || "Membro", value: 0 };
    current.value += contribution.value;
    values.set(contribution.memberId, current);
  }
  for (const transfer of transfers) {
    if (transfer.status !== "aceita" || transfer.fromMemberId === transfer.toMemberId) continue;
    const source = values.get(transfer.fromMemberId);
    if (!source) continue;
    const moved = Math.min(Math.max(0, transfer.value), Math.max(0, source.value));
    if (!moved) continue;
    source.value -= moved;
    const target = values.get(transfer.toMemberId) || { memberId: transfer.toMemberId, name: "Membro", value: 0 };
    target.value += moved;
    values.set(transfer.toMemberId, target);
  }
  const rows = Array.from(values.values()).filter((row) => row.value > 0.005);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({ ...row, percent: total ? (row.value / total) * 100 : 0 }));
}

export function calculatePortfolioTotals(
  properties: Array<{ acquisitionValue?: number; currentValue?: number; debt?: number; liquidity?: string; ownershipPercent?: number }>,
  alliances: Array<{ invested?: number; participationValue?: number | null; liquidity?: string }>,
) {
  const share = (item: { ownershipPercent?: number }) => Math.min(100, Math.max(0, Number(item.ownershipPercent ?? 100))) / 100;
  const acquisitionValue = properties.reduce((sum, item) => sum + Number(item.acquisitionValue || 0) * share(item), 0);
  const propertyCurrentValue = properties.reduce((sum, item) => sum + Number(item.currentValue || 0) * share(item), 0);
  const debt = properties.reduce((sum, item) => sum + Number(item.debt || 0) * share(item), 0);
  const allianceInvested = alliances.reduce((sum, item) => sum + Number(item.invested || 0), 0);
  const allianceValue = alliances.reduce((sum, item) => sum + Number(item.participationValue || 0), 0);
  const netWorth = propertyCurrentValue - debt + allianceValue;
  const estimatedTotal = propertyCurrentValue + allianceValue;
  const acquisitionTotal = acquisitionValue + allianceInvested;
  const propertyAppreciation = properties.reduce((sum, item) => {
    const acquisition = Number(item.acquisitionValue || 0) * share(item);
    const current = Number(item.currentValue || 0) * share(item);
    return acquisition > 0 && current > 0 ? sum + current - acquisition : sum;
  }, 0);
  const allianceAppreciation = alliances.reduce((sum, item) => {
    const invested = Number(item.invested || 0);
    const current = item.participationValue == null ? 0 : Number(item.participationValue);
    return invested > 0 && current > 0 ? sum + current - invested : sum;
  }, 0);
  const lowLiquidityValue = properties.reduce((sum, item) => sum + (item.liquidity === "baixa" ? Number(item.currentValue || 0) * share(item) : 0), 0)
    + alliances.reduce((sum, item) => sum + (item.liquidity === "baixa" ? Number(item.participationValue || 0) : 0), 0);
  return {
    netWorth,
    estimatedTotal,
    acquisitionValue,
    acquisitionTotal,
    propertyCurrentValue,
    debt,
    allianceInvested,
    allianceValue,
    registeredAppreciation: propertyAppreciation + allianceAppreciation,
    valuationCoverage: {
      propertiesIncluded: properties.filter((item) => Number(item.acquisitionValue || 0) > 0 && Number(item.currentValue || 0) > 0).length,
      propertiesTotal: properties.length,
      alliancesIncluded: alliances.filter((item) => Number(item.invested || 0) > 0 && item.participationValue != null && Number(item.participationValue) > 0).length,
      alliancesTotal: alliances.length,
    },
    lowLiquidityPercent: netWorth > 0 ? (lowLiquidityValue / netWorth) * 100 : 0,
  };
}

export type PortfolioExchangeRate = { moeda: string; taxaBrl: number; data: string; fonte: string };

export function convertPortfolioAmountToBrl(
  value: number,
  currency: string | null | undefined,
  rates: Map<string, PortfolioExchangeRate>,
): number | null {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return null;
  const normalized = String(currency || "BRL").trim().toUpperCase();
  if (normalized === "BRL") return amount;
  const rate = rates.get(normalized);
  return rate && Number.isFinite(rate.taxaBrl) && rate.taxaBrl > 0 ? amount * rate.taxaBrl : null;
}

export function normalizeFinancingInstallments(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item: any) => ({
    parcela: Math.max(1, Number(item?.parcela || 0)),
    valor: Math.max(0, Number(item?.valor || 0)),
    data: String(item?.data_vencimento || item?.data || ""),
    status: ["pago", "agendado", "vencido", "pendente", "cancelado"].includes(String(item?.status)) ? String(item.status) : "pendente",
  })).filter((item) => item.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.data));
}
