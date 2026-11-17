import { guestPaymentTotals, type guestPayments } from './oba-guest';

type Payment = ReturnType<typeof guestPayments>[number];
const monthOf = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}/.test(value)) return null;
  const date = value.slice(0, 10);
  const parsed = new Date(date + 'T12:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date.slice(0, 7) : null;
};

/** This dashboard describes registered cash entries and initial quotas, never MAP rights or asset returns. */
export function guestDashboard(payments: Payment[], quotas: number, totalQuotas: number) {
  const totals = guestPaymentTotals(payments);
  const total = Math.round((totals.pago + totals.aPagar) * 100) / 100;
  const monthly = new Map<string, number>();
  let undatedPaid = 0;
  for (const payment of payments) {
    if (payment.status !== 'pago') continue;
    const month = monthOf(payment.pagoEm);
    if (!month) { undatedPaid++; continue; }
    monthly.set(month, (monthly.get(month) || 0) + Math.round(payment.valor * 100));
  }
  const dated = payments.filter(p => p.status !== 'pago').sort((a, b) => {
    const first = monthOf(a.vencimento) ? String(a.vencimento).slice(0, 10) : '9999-99-99';
    const second = monthOf(b.vencimento) ? String(b.vencimento).slice(0, 10) : '9999-99-99';
    return first.localeCompare(second);
  });
  return {
    ...totals, total, undatedPaid,
    paidPercent: total > 0 ? totals.pago / total * 100 : null,
    quotaPercent: Number.isFinite(quotas) && Number.isFinite(totalQuotas) && totalQuotas > 0 && quotas >= 0 && quotas <= totalQuotas
      ? quotas / totalQuotas * 100 : null,
    next: dated[0] || null,
    monthly: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, cents]) => ({ month, value: cents / 100 })),
  };
}
