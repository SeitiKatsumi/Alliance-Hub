import type { OfferQuota } from "@shared/bia-offer";

export function paymentsPerQuota(positions: readonly OfferQuota[]) {
  const reference = positions.find(position => position.pagamentos.length > 0);
  return reference?.pagamentos.map(({ mes, bloco }, index) => {
    let min = Infinity;
    let max = 0;
    for (const position of positions) {
      const payment = position.pagamentos[index];
      if (!payment || position.quantidade <= 0) continue;
      // The published rateio distributes each payment across whole quotas, with at most a cent of difference.
      const perQuota = payment.centavos / position.quantidade;
      min = Math.min(min, Math.floor(perQuota));
      max = Math.max(max, Math.ceil(perQuota));
    }
    return { mes, bloco, min, max };
  }) ?? [];
}
