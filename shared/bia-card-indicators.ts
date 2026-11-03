import { biaBusinessTypeCode, biaBusinessTypeLabel } from "./bia-business-type";
import { STRATEGIC_CELL_BUSINESS_TYPES } from "./strategic-cells";
import { parseTrackingValues, type BiaTracking } from './bia-tracking';
import type { AutomaticBiaIndicators } from './bia-automatic-indicators';
type Thesis = typeof STRATEGIC_CELL_BUSINESS_TYPES[number][1];
type Field = "valor_geral_venda_vgv" | "valor_realizado_venda";
type Spec = readonly [string, Field?];
export type BiaIndicatorSource = { business_type_code?: unknown; objetivo_alianca?: unknown; valor_geral_venda_vgv?: unknown; valor_realizado_venda?: unknown; acompanhamento?: BiaTracking; indicadores_automaticos?: AutomaticBiaIndicators };
const indicators: Record<Thesis, readonly Spec[]> = {
APPRECIATION_HOLD: [["Valor registrado dos ativos"], ["Valorização sobre aquisição"]],
FLIPPING: [["Etapa da reforma"], ["Recebido em vendas", "valor_realizado_venda"]],
SHORT_TERM_RESALE: [["Venda prevista (VGV)", "valor_geral_venda_vgv"], ["Recebido em vendas", "valor_realizado_venda"]],
BUY_AND_HOLD: [["Situação da locação"], ["Aluguéis recebidos no mês"]],
SHORT_STAY: [["Ocupação no período"], ["Receita recebida no período"]],
REAL_ESTATE_INCORPORATION: [["Andamento da obra"], ["Recebido em vendas", "valor_realizado_venda"]],
LAND_SUBDIVISION: [["Etapa do loteamento"], ["Recebido em vendas", "valor_realizado_venda"]],
BUILD_TO_RENT: [["Andamento da obra"], ["Unidades alugadas"]],
ASSET_REGULARIZATION: [["Etapas da regularização"], ["Situação da venda ou locação"]],
STALLED_CONSTRUCTION_COMPLETION: [["Andamento da obra"], ["Situação da venda ou locação"]],
RETROFIT_REPOSITIONING: [["Etapa da transformação"], ["Situação da venda ou locação"]],
HOSPITALITY_OPERATION: [["Ocupação no período"], ["Receita recebida no período"]],
OPERATION_RESTRUCTURING: [["Etapas da reestruturação"], ["Receita operacional recebida no mês"]],
};
function amount(value: unknown): number | null {
if (typeof value !== "number" && typeof value !== "string") return null;
if (typeof value === "string" && !value.trim()) return null;
const parsed = Number(value);
return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
export function biaCardIndicators(bia: BiaIndicatorSource) {
const code = biaBusinessTypeCode(bia) as Thesis;
const auto = bia.indicadores_automaticos;
let data: Record<string, string | number | null> = {};
try { data = parseTrackingValues(code, bia.acompanhamento?.byThesis[code] || {}); } catch { /* Invalid legacy tracking must never manufacture a metric. */ }
const n = (key: string) => typeof data[key] === 'number' ? data[key] as number : null;
const text = (key: string) => typeof data[key] === 'string' ? data[key] as string : null;
const operational: Partial<Record<Thesis, [string | number | null, string | number | null]>> = {
  APPRECIATION_HOLD: [auto?.assetValue ?? null, auto?.appreciation ?? null],
  FLIPPING: [text('stage'), null],
  BUY_AND_HOLD: [text('rentalStatus'), auto?.rentReceived ?? null],
  SHORT_STAY: [(n('availableNights') ?? 0) > 0 && n('occupiedNights') !== null ? n('occupiedNights')! / n('availableNights')! * 100 : null, auto?.lodgingReceived ?? null],
  REAL_ESTATE_INCORPORATION: [text('stage'), null],
  LAND_SUBDIVISION: [text('stage'), null],
  BUILD_TO_RENT: [text('stage'), n('rentedUnits') === null ? null : n('totalUnits') === null ? String(n('rentedUnits')) : `${n('rentedUnits')} de ${n('totalUnits')}`],
  ASSET_REGULARIZATION: [text('stage'), text('exitStatus')],
  STALLED_CONSTRUCTION_COMPLETION: [text('stage'), text('exitStatus')],
  RETROFIT_REPOSITIONING: [text('stage'), text('exitStatus')],
  HOSPITALITY_OPERATION: [(n('availableNights') ?? 0) > 0 && n('occupiedNights') !== null ? n('occupiedNights')! / n('availableNights')! * 100 : null, auto?.lodgingReceived ?? null],
  OPERATION_RESTRUCTURING: [text('stage'), auto?.operationReceived ?? null],
};
return {thesis: biaBusinessTypeLabel(bia) || "Tese não definida", period: ['BUY_AND_HOLD','SHORT_STAY','HOSPITALITY_OPERATION','OPERATION_RESTRUCTURING'].includes(code) ? auto?.period || text('period') : null, valuationDate: null, metrics: (indicators[code] || []).map(([label, field], index) => ({
  label, value: field ? amount(field === 'valor_realizado_venda' ? auto?.salesReceived : auto?.plannedSales) : operational[code]?.[index] ?? null,
  kind: ((code === 'APPRECIATION_HOLD' && index === 1) || (['SHORT_STAY','HOSPITALITY_OPERATION'].includes(code) && index === 0)) ? 'percent' : 'currency',
}))};
}
