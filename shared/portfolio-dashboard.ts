export const PROPERTY_ESTIMATE_VALIDATION_VERSION = 3;
export interface PortfolioMetric { value: number | null; included: number; total: number; partial: boolean }
export interface PortfolioDashboard {
  acquisition: PortfolioMetric;
  propertyEstimate: PortfolioMetric & { min: number | null; max: number | null; indicative?: boolean; validationVersion?: number };
  cppBase: PortfolioMetric;
  cppContributed: PortfolioMetric;
  cppRemaining: PortfolioMetric;
  cppEstimate: PortfolioMetric;
}
export interface PortfolioObservation { day: string; observedAt: string; metrics: PortfolioDashboard }

export type PortfolioProperty = {
  nome?: string; tipo?: string; ocupacao?: string; bairro?: string; cidade?: string;
  id: string; consolidado_via_bia?: boolean; participacao_percentual?: number; valor_pago?: unknown;
  valor_aquisicao_brl?: number | null;
  estimativa_dashboard?: { min: number | null; max: number | null; value: number | null; indicative?: boolean };
};
type Property = PortfolioProperty;
type Alliance = { id: string; map_percent?: number; cpp_base_brl?: number | null; cpp_contributed_brl?: number | null; cpp_remaining_brl?: number | null; valor_participacao_brl?: number | null; estimativa_patrimonial?: { partial: boolean } };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function portfolioPropertyBreakdown(properties: PortfolioProperty[]) {
  const own = [...new Map(properties.filter(p => !p.consolidado_via_bia && Number(p.participacao_percentual ?? 100) > 0).map(p => [p.id, p])).values()];
  return own.map(p => {
    const share = Math.min(100, Math.max(0, Number(p.participacao_percentual ?? 100)));
    const e = p.estimativa_dashboard;
    const valid = !!e && !e.indicative && finite(e.min) && finite(e.max) && finite(e.value) && e.min > 0 && e.min <= e.value && e.value <= e.max;
    const scale = (n: unknown) => finite(n) ? round(n * share / 100) : null;
    return { id: p.id, nome: p.nome || "Imóvel", share, acquisition: scale(p.valor_aquisicao_brl),
      estimate: valid ? scale(e!.value) : null, min: valid ? scale(e!.min) : null, max: valid ? scale(e!.max) : null };
  });
}

export function portfolioPropertyRegions(properties: PortfolioProperty[]) {
  const source = new Map(properties.map(p => [p.id, p]));
  const regions = new Map<string, Array<number | null>>();
  for (const row of portfolioPropertyBreakdown(properties)) {
    const p = source.get(row.id)!;
    const key = [p.bairro, p.cidade].filter(Boolean).join(", ") || "Localização não informada";
    regions.set(key, [...(regions.get(key) || []), row.estimate]);
  }
  return [...regions].map(([region, values]) => {
    const result = metric(values);
    return { region, assets: values.length, value: result.partial ? null : result.value, partial: result.partial };
  }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}

/**
 * An acquisition value that was never declared contributes zero to the
 * declared-acquisition total. A declared amount that could not be converted to
 * BRL remains unknown so a currency/integration failure is not hidden as zero.
 */
export function dashboardAcquisitionValue(declaredValue: unknown, convertedBrl: number | null | undefined): number | null {
  if (declaredValue == null || (typeof declaredValue === "string" && !declaredValue.trim())) return 0;
  return finite(convertedBrl) ? convertedBrl : null;
}

/** Normalizes an API payload so older servers apply the current acquisition rule too. */
export function portfolioDashboardFromApi(properties: Property[], alliances: Alliance[]): PortfolioDashboard {
  return portfolioDashboard(properties.map(property => ({
    ...property,
    valor_aquisicao_brl: dashboardAcquisitionValue(property.valor_pago, property.valor_aquisicao_brl),
  })), alliances);
}

function metric(values: Array<number | null | undefined>, hasPartial = false): PortfolioMetric {
  const known = values.filter(finite);
  return { value: !values.length ? 0 : known.length ? round(known.reduce((a, b) => a + b, 0)) : null,
    included: known.length, total: values.length, partial: hasPartial || known.length !== values.length };
}

/** Server-converted BRL only. No VO, promised capital or fabricated historical prices. */
export function portfolioDashboard(properties: Property[], alliances: Alliance[]): PortfolioDashboard {
  const own = [...new Map(properties.filter(p => !p.consolidado_via_bia && Number(p.participacao_percentual ?? 100) > 0).map(p => [p.id, p])).values()];
  const bias = [...new Map(alliances.filter(b => b.map_percent == null || b.map_percent > 0).map(b => [b.id, b])).values()];
  const breakdown = portfolioPropertyBreakdown(own);
  const estimates = breakdown.map(p => p.estimate);
  const cppEstimate = metric(bias.map(b => b.estimativa_patrimonial?.partial ? null : b.valor_participacao_brl));
  const cppContributed = metric(bias.map(b => b.cpp_contributed_brl));
  const cppRemaining = metric(bias.map(b => b.cpp_remaining_brl));
  // A subtotal of only some alliances must not be presented as the total value of all CPPs.
  if(cppEstimate.partial)cppEstimate.value=null;
  if(cppContributed.partial)cppContributed.value=null;
  if(cppRemaining.partial)cppRemaining.value=null;
  return {
    acquisition: metric(breakdown.map(p => p.acquisition)),
    propertyEstimate: { ...metric(estimates), validationVersion: PROPERTY_ESTIMATE_VALIDATION_VERSION,
      indicative: false,
      min: metric(breakdown.map(p => p.min)).value,
      max: metric(breakdown.map(p => p.max)).value },
    cppBase: metric(bias.map(b => b.cpp_base_brl)),
    cppContributed,
    cppRemaining,
    cppEstimate,
  };
}
