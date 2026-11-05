import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';

export type DossierFile = { id: string; name: string; folder: string; bytes?: Uint8Array };
export type DossierSource = { name: string; currency: string; entries: any[]; files: DossierFile[]; notes: string[] };
export function dossierYear(value: unknown) {
  if (!/^\d{4}$/.test(String(value)) || Number(value) < 1900 || Number(value) > 2100) throw Object.assign(new Error('Informe um ano entre 1900 e 2100.'), { status: 400 });
  return Number(value);
}
export function dossierEntries(entries: any[], year: number) {
  return entries.filter(e => String(e.data_pagamento || e.data || e.data_vencimento || '').slice(0, 4) === String(year));
}
const safeName = (s: string) => String(s).replace(/[^\p{L}\p{N} ._-]/gu, '_').replace(/^\.+/, '_').slice(0, 140) || 'arquivo';
const cell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
export async function buildDossier(source: DossierSource, year: number, read: (id: string) => Promise<{ bytes: Uint8Array; name?: string }>, pdf: (title: string, body: string) => Uint8Array) {
  const entries = dossierEntries(source.entries, year);
  const archive: Record<string, Uint8Array> = {};
  const manifest: any[] = [];
  const notes = [...source.notes];
  let size = 0;
  if (source.files.length > 300) throw Object.assign(new Error('Dossiê excede 300 arquivos. Reduza os documentos antes de exportar.'), { status: 413 });
  for (const [index, file] of source.files.entries()) {
    const result = file.bytes ? { bytes: file.bytes, name: file.name } : await read(file.id);
    size += result.bytes.byteLength;
    if (size > 100 * 1024 * 1024) throw Object.assign(new Error('Dossiê excede 100 MB.'), { status: 413 });
    const path = `${safeName(file.folder)}/${index + 1}-${safeName(result.name || file.name)}`;
    archive[path] = result.bytes;
    manifest.push({ arquivo: path, origem: file.id, bytes: result.bytes.byteLength, sha256: createHash('sha256').update(result.bytes).digest('hex') });
  }
  let income = 0, expense = 0;
  for (const e of entries) {
    const amount = Number(e.valor);
    if (!Number.isFinite(amount)) { notes.push(`Lançamento ${e.id}: valor inválido, não somado.`); continue; }
    if (e.status !== 'pago' || (e.natureza && e.natureza !== 'caixa')) continue;
    if (['entrada', 'receita'].includes(e.tipo)) income += Math.round(amount * 100);
    if (['saida', 'despesa'].includes(e.tipo)) expense += Math.round(amount * 100);
  }
  const money = (n: number) => `${source.currency} ${(n / 100).toFixed(2)}`;
  const title = `Dossiê — ${source.name} — ${year}`;
  const body = [
    `Gerado em: ${new Date().toISOString()}`, `Lançamentos: ${entries.length}`, `Entradas pagas: ${money(income)}`, `Saídas pagas: ${money(expense)}`, `Resultado registrado: ${money(income - expense)}`,
    'Período por data de pagamento; quando ausente, data do lançamento ou vencimento. Pendentes constam no extrato, mas não nos totais pagos. Movimentos não caixa não entram nos totais.',
    'Extrato dos registros da plataforma, não extrato bancário. Material de apoio ao contador; não determina tributação nem substitui declaração.',
    'Documentos cadastrais são incluídos independentemente do ano. MAPs identificam a data e versão registradas; não se presume posição no encerramento do ano.',
    ...notes,
  ].join('\n\n');
  archive['Resumo.pdf'] = pdf(title, body);
  archive['Leia-me.txt'] = strToU8(`${title}\n\n${body}`);
  const columns = ['id','descricao','tipo','valor','status','data','data_vencimento','data_pagamento','natureza'];
  archive['Extrato.csv'] = strToU8('\uFEFF' + [columns.join(';'), ...entries.map(e => columns.map(c => cell(e[c])).join(';'))].join('\r\n'));
  archive['Manifesto.json'] = strToU8(JSON.stringify({ titulo: title, ano: year, gerado_em: new Date().toISOString(), arquivos: manifest, observacoes: notes }, null, 2));
  return zipSync(archive, { level: 0 });
}
