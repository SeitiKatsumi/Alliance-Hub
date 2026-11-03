import { STRATEGIC_CELL_BUSINESS_TYPES } from './strategic-cells';

export type BiaThesis = typeof STRATEGIC_CELL_BUSINESS_TYPES[number][1];
export type TrackingValues = Record<string, string | number | null>;
export type BiaTracking = { revision: number; byThesis: Partial<Record<BiaThesis, TrackingValues>>; updatedAt?: string };
export type TrackingField = { key: string; label: string; kind: 'select' | 'money' | 'integer' | 'month' | 'date'; options?: readonly string[]; signed?: boolean };
const stage = (label: string, options: string[]): TrackingField => ({ key: 'stage', label, kind: 'select', options });
const money = (key: string, label: string, signed = false): TrackingField => ({ key, label, kind: 'money', signed });
const integer = (key: string, label: string): TrackingField => ({ key, label, kind: 'integer' });
const exit: TrackingField = { key: 'exitStatus', label: 'Situação da venda ou locação', kind: 'select', options: ['Ainda não definida', 'Em preparação para venda', 'À venda', 'Vendido', 'Em preparação para locação', 'Disponível para locação', 'Alugado', 'Venda e locação'] };
const construction = stage('Andamento da obra', ['Não iniciada', 'Projetos e aprovações', 'Preparação do terreno', 'Fundação', 'Estrutura', 'Instalações', 'Acabamento', 'Concluída', 'Paralisada']);
const period: TrackingField = { key: 'period', label: 'Mês de referência', kind: 'month' };
const operation = [period, integer('availableNights', 'Diárias disponíveis no mês'), integer('occupiedNights', 'Diárias ocupadas no mês'), money('revenue', 'Receita no mês')];

/** Single catalogue for editor, API validation and cards. Values are reported by the BIA manager. */
export const BIA_TRACKING_FIELDS: Record<BiaThesis, readonly TrackingField[]> = {
  APPRECIATION_HOLD: [money('currentValue', 'Valor estimado atual'), money('referenceValue', 'Valor de referência para comparação'), { key: 'valuationDate', label: 'Data da estimativa', kind: 'date' }],
  FLIPPING: [stage('Etapa da reforma', ['Não iniciada', 'Planejamento', 'Em execução', 'Acabamento', 'Concluída', 'Paralisada'])],
  SHORT_TERM_RESALE: [],
  BUY_AND_HOLD: [{ key: 'rentalStatus', label: 'Situação da locação', kind: 'select', options: ['Em preparação', 'Disponível para locação', 'Em negociação', 'Alugado', 'Desocupado', 'Indisponível'] }, money('monthlyRent', 'Receita mensal de aluguel')],
  SHORT_STAY: operation,
  REAL_ESTATE_INCORPORATION: [construction],
  LAND_SUBDIVISION: [stage('Etapa do loteamento', ['Estudos e projetos', 'Licenciamento', 'Registro', 'Obras de infraestrutura', 'Lotes disponíveis', 'Concluído', 'Paralisado'])],
  BUILD_TO_RENT: [construction, integer('rentedUnits', 'Unidades alugadas'), integer('totalUnits', 'Total de unidades')],
  ASSET_REGULARIZATION: [stage('Etapa da regularização', ['Levantamento de pendências', 'Documentação em preparação', 'Protocolado', 'Em análise', 'Em exigência', 'Regularizado']), exit],
  STALLED_CONSTRUCTION_COMPLETION: [construction, exit],
  RETROFIT_REPOSITIONING: [stage('Etapa da transformação', ['Estudos e projetos', 'Aprovações', 'Em execução', 'Acabamento', 'Concluída', 'Paralisada']), exit],
  HOSPITALITY_OPERATION: operation,
  OPERATION_RESTRUCTURING: [stage('Etapa da reestruturação', ['Diagnóstico', 'Plano definido', 'Em execução', 'Estabilização', 'Concluída', 'Suspensa']), period, money('operatingResult', 'Resultado operacional no mês', true)],
};
export const BIA_SALE_TRACKING_THESES = ['FLIPPING', 'SHORT_TERM_RESALE', 'REAL_ESTATE_INCORPORATION', 'LAND_SUBDIVISION'] as const;
export function trackingFields(code: string): readonly TrackingField[] { return BIA_TRACKING_FIELDS[code as BiaThesis] || []; }
// Older snapshots stay readable, but amounts with an existing official source are no longer entered here.
export function manualTrackingFields(code: string): readonly TrackingField[] {
  const automatic = new Set(['currentValue','referenceValue','valuationDate','monthlyRent','revenue','operatingResult']);
  return trackingFields(code).filter(f => !automatic.has(f.key) && !(code === 'OPERATION_RESTRUCTURING' && f.key === 'period'));
}
export function emptyBiaTracking(): BiaTracking { return { revision: 0, byThesis: {} }; }
export function sameTrackingValues(a: TrackingValues, b: TrackingValues): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && a[key] === b[key]);
}
const fail = (message: string): never => { throw Object.assign(new Error(message), { statusCode: 400 }); };

export function parseTrackingValues(code: string, input: unknown): TrackingValues {
  if (!Object.hasOwn(BIA_TRACKING_FIELDS, code)) fail('Selecione uma tese válida.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Dados de acompanhamento inválidos.');
  const fields = trackingFields(code), result: TrackingValues = {};
  for (const key of Object.keys(input as object)) if (!fields.some(f => f.key === key)) fail('Campo de acompanhamento não pertence à tese.');
  for (const field of fields) {
    const value = (input as TrackingValues)[field.key];
    if (value === null || value === undefined || value === '') continue;
    if (field.kind === 'select') {
      if (typeof value !== 'string' || !field.options!.includes(value)) fail(`Selecione uma opção válida em ${field.label}.`);
      result[field.key] = value;
    } else if (field.kind === 'month' || field.kind === 'date') {
      if (typeof value !== 'string' || !(field.kind === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/).test(value)) fail(`Confira ${field.label}.`);
      const date = `${value}${field.kind === 'month' ? '-01' : ''}`;
      if (Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail(`Confira ${field.label}.`);
      result[field.key] = value;
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12 || (!field.signed && value < 0) || (field.kind === 'integer' && !Number.isSafeInteger(value))) fail(`Informe um valor válido em ${field.label}.`);
      result[field.key] = field.kind === 'money' ? Math.round(Number(value) * 100) / 100 : value;
    }
  }
  for (const [part, total, label] of [['occupiedNights', 'availableNights', 'Diárias ocupadas'], ['rentedUnits', 'totalUnits', 'Unidades alugadas']]) {
    if (result[part] !== undefined && result[total] !== undefined && Number(result[part]) > Number(result[total])) fail(`${label} não podem superar o total disponível.`);
  }
  if (fields.some(f => f.key === 'period') && ['revenue', 'availableNights', 'occupiedNights', 'operatingResult'].some(k => result[k] !== undefined) && !result.period) fail('Informe o mês de referência.');
  if (result.currentValue !== undefined && !result.valuationDate) fail('Informe a data da estimativa.');
  return result;
}

export function parseTrackingChanges(input: unknown): BiaTracking['byThesis'] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Dados de acompanhamento inválidos.');
  return Object.fromEntries(Object.entries(input as object).map(([code, values]) => [code, parseTrackingValues(code, values)]));
}
