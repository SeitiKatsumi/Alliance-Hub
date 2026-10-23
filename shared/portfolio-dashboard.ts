export const PROPERTY_ESTIMATE_VALIDATION_VERSION = 2;
export interface PortfolioMetric { value: number | null; included: number; total: number; partial: boolean }
export interface PortfolioDashboard {
  acquisition: PortfolioMetric;
  propertyEstimate: PortfolioMetric & { min: number | null; max: number | null; indicative?: boolean; validationVersion?: number };
  cppBase: PortfolioMetric;
  cppEstimate: PortfolioMetric;
}
export interface PortfolioObservation { day: string; observedAt: string; metrics: PortfolioDashboard }

type Property = {
  id: string; consolidado_via_bia?: boolean; participacao_percentual?: number;
  valor_aquisicao_brl?: number | null;
  estimativa_dashboard?: { min: number | null; max: number | null; value: number | null; indicative?: boolean };
};
type Alliance = { id: string; map_percent?: number; cpp_base_brl?: number | null; valor_participacao_brl?: number | null; estimativa_patrimonial?: { partial: boolean } };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
function metric(values: Array<number | null | undefined>, hasPartial = false): PortfolioMetric {
  const known = values.filter(finite);
  return { value: !values.length ? 0 : known.length ? round(known.reduce((a, b) => a + b, 0)) : null,
    included: known.length, total: values.length, partial: hasPartial || known.length !== values.length };
}

/** Server-converted BRL only. No VO, promised capital or fabricated historical prices. */
export function portfolioDashboard(properties: Property[], alliances: Alliance[]): PortfolioDashboard {
  const own = [...new Map(properties.filter(p => !p.consolidado_via_bia && Number(p.participacao_percentual ?? 100) > 0).map(p => [p.id, p])).values()];
  const bias = [...new Map(alliances.filter(b => b.map_percent == null || b.map_percent > 0).map(b => [b.id, b])).values()];
  const share = (p: Property) => Math.min(100, Math.max(0, Number(p.participacao_percentual ?? 100))) / 100;
  const proportional = (p: Property, value: unknown) => finite(value) ? value * share(p) : null;
  const validRange = (p: Property) => {
    const e = p.estimativa_dashboard;
    return !!e && finite(e.min) && finite(e.max) && finite(e.value) && e.min > 0 && e.min <= e.value && e.value <= e.max;
  };
  const estimates = own.map(p => validRange(p) ? proportional(p, p.estimativa_dashboard!.value) : null);
  return {
    acquisition: metric(own.map(p => proportional(p, p.valor_aquisicao_brl))),
    propertyEstimate: { ...metric(estimates), validationVersion: PROPERTY_ESTIMATE_VALIDATION_VERSION,
      indicative: own.some(p => validRange(p) && p.estimativa_dashboard?.indicative === true),
      min: metric(own.map(p => validRange(p) ? proportional(p, p.estimativa_dashboard!.min) : null)).value,
      max: metric(own.map(p => validRange(p) ? proportional(p, p.estimativa_dashboard!.max) : null)).value },
    cppBase: metric(bias.map(b => b.cpp_base_brl)),
    cppEstimate: metric(bias.map(b => b.valor_participacao_brl), bias.some(b => b.estimativa_patrimonial?.partial === true)),
  };
}
