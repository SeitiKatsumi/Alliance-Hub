import { relationId } from './bia-access';
import { categoryText } from './financial-categories';
import { isCashEntry } from './initial-contributions';
import type { BiaSetup } from './bia-setup';

export type AutomaticBiaIndicators = {
  period: string; salesReceived: number | null; rentReceived: number | null;
  operationReceived: number | null; lodgingReceived: number | null;
  plannedSales: number | null; assetValue: number | null; appreciation: number | null;
};
export function currentBiaMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}
const number = (v: unknown): number | null => {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '') return null;
  const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null;
};
const normalized = (v: unknown) => categoryText(String(v || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const names = new Map([['venda do ativo / unidades','sale'],['receita de locacao','rent'],['receita de operacao','operation']]);
/** IDs and numeric codes alone are not classifications: entrance and expense codes overlap. */
function receiptKind(entry: any): string | null {
  const categories = Array.isArray(entry.Categoria) ? entry.Categoria : [];
  const kinds = categories.map((row: any) => {
    const c = row?.categorias_id || row;
    if (!c || typeof c !== 'object' || normalized(c.Tipo_de_categoria) !== 'entrada') return null;
    if (c.bia_id && relationId(c.bia_id) !== relationId(entry.bia)) return null;
    return names.get(normalized(c.Nome_da_categoria).replace(/^\d+(?:\.\d+)*\s+/, '')) || null;
  });
  // A mixed or unresolved classification cannot allocate the whole amount to multiple metrics.
  return kinds.length && kinds.every((k: string | null) => k && k === kinds[0]) ? kinds[0] : null;
}
export function paidBiaReceipts(biaId: string, entries: any[] | null, period: string) {
  if (entries === null) return {salesReceived:null,rentReceived:null,operationReceived:null,lodgingReceived:null};
  let sales = 0, rent = 0, operation = 0, monthUnknown = false;
  const seen = new Set<string>();
  for (const entry of entries) {
    if (relationId(entry.bia) !== biaId || normalized(entry.tipo) !== 'entrada' || normalized(entry.status) !== 'pago' || !isCashEntry(entry) || entry.parcela_vigente === false) continue;
    const id = relationId(entry.id); if (!id || seen.has(id)) continue; seen.add(id);
    const kind = receiptKind(entry), value = number(entry.valor); if (!kind) continue;
    if (value === null || !Number.isSafeInteger(Math.round(value * 100))) return {salesReceived:null,rentReceived:null,operationReceived:null,lodgingReceived:null};
    const cents = Math.round(value * 100);
    if (kind === 'sale') { sales += cents; continue; }
    const date = String(entry.data_pagamento || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) { monthUnknown = true; continue; }
    if (!date.startsWith(period + '-')) continue;
    if (kind === 'rent') rent += cents;
    if (kind === 'operation') operation += cents;
  }
  return {salesReceived:sales/100,rentReceived:monthUnknown?null:rent/100,operationReceived:monthUnknown?null:operation/100,lodgingReceived:monthUnknown?null:(rent+operation)/100};
}

/** Reuses the current asset version. A partial asset forecast is not presented as the whole VGV. */
export function plannedBiaSales(setup: BiaSetup): number | null {
  const values = setup.ativos.map(a => number(a.indicadores.valor_geral_venda_vgv));
  if (values.some(v => v !== null)) return values.every(v => v !== null) ? values.reduce<number>((sum,v) => sum + Math.round(v! * 100),0)/100 : null;
  return number(setup.indicadoresLegados.valor_geral_venda_vgv);
}
export type ValuationAsset = {id:string;value:unknown;acquisition:unknown;currency:string;share:number|null};
export function biaAssetIndicators(assets: ValuationAsset[], currency: string) {
  const unique = [...new Map(assets.map(a => [a.id,a])).values()];
  if (!unique.length || unique.some(a => a.currency !== currency || number(a.value) === null || a.share === null || a.share <= 0 || a.share > 100)) return {assetValue:null,appreciation:null};
  const assetValue = unique.reduce((sum,a) => sum + Math.round(number(a.value)! * a.share!),0)/100;
  const acquisition = unique.every(a => number(a.acquisition) !== null) ? unique.reduce((sum,a) => sum + Math.round(number(a.acquisition)! * a.share!),0)/100 : null;
  return {assetValue,appreciation: acquisition !== null && acquisition > 0 ? (assetValue/acquisition-1)*100 : null};
}
