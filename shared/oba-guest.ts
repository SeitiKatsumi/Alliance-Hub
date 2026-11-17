import { isCashEntry } from './initial-contributions';

export const OBA_GUEST_CODE_TTL_MS = 10 * 60 * 1000;
export const OBA_GUEST_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const OBA_GUEST_MAX_ATTEMPTS = 5;

export function guestEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Informe um e-mail válido.'), { statusCode: 400 });
  }
  return email;
}

const relationId = (value: any) => String(value?.id ?? value ?? '');

/** Only the verified participant's cash contributions, with an explicit output allowlist. */
export function guestPayments(entries: any[], biaId: string, memberId: string) {
  return entries.filter(entry => relationId(entry.bia) === biaId
    && relationId(entry.membro_responsavel) === memberId
    && String(entry.tipo).toLowerCase() === 'entrada'
    && isCashEntry(entry) && entry.parcela_vigente !== false
    && ['pago', 'agendado', 'pendente', 'vencido'].includes(String(entry.status).toLowerCase()))
    .map(entry => ({
      id: String(entry.id), descricao: String(entry.descricao || 'Aporte'),
      valor: Number(entry.valor), status: String(entry.status).toLowerCase(),
      vencimento: entry.data_vencimento || null, pagoEm: entry.data_pagamento || null,
      pagamentoUrl: typeof entry.pagamento_url === 'string' && /^https:\/\//.test(entry.pagamento_url) ? entry.pagamento_url : null,
      arquivos: (Array.isArray(entry.Anexos) ? entry.Anexos : []).map((item: any) => relationId(item.directus_files_id)).filter(Boolean),
    })).filter(entry => Number.isFinite(entry.valor) && entry.valor >= 0);
}

export function guestPaymentTotals(payments: ReturnType<typeof guestPayments>) {
  const paid = payments.filter(item => item.status === 'pago').reduce((sum, item) => sum + Math.round(item.valor * 100), 0);
  const pending = payments.filter(item => item.status !== 'pago').reduce((sum, item) => sum + Math.round(item.valor * 100), 0);
  return { pago: paid / 100, aPagar: pending / 100 };
}
