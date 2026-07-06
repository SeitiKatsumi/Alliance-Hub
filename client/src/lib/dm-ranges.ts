export interface InstitutionalPercentageRange {
  label: string;
  maxValue: number;
  percentual: number;
}

export const DM_RANGES_STORAGE_KEY = "built:dm-institutional-ranges";

export const DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES: InstitutionalPercentageRange[] = [
  { label: "Até R$ 1,5 milhões", maxValue: 1_500_000, percentual: 1.25 },
  { label: "Até R$ 3 milhões", maxValue: 3_000_000, percentual: 1 },
  { label: "Até R$ 7 milhões", maxValue: 7_000_000, percentual: 0.85 },
  { label: "Até R$ 15 milhões", maxValue: 15_000_000, percentual: 0.7 },
  { label: "Até R$ 30 milhões", maxValue: 30_000_000, percentual: 0.6 },
  { label: "Até R$ 75 milhões", maxValue: 75_000_000, percentual: 0.5 },
];

export function formatDmRangeLabel(maxValue: number): string {
  if (maxValue >= 1_000_000) {
    const millions = maxValue / 1_000_000;
    return `Até R$ ${millions.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões`;
  }
  return `Até ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(maxValue)}`;
}

export function normalizeDmRanges(ranges: unknown): InstitutionalPercentageRange[] {
  if (!Array.isArray(ranges)) return DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES;
  const normalized = ranges
    .map((range: any) => {
      const maxValue = Number(range?.maxValue);
      const percentual = Number(range?.percentual);
      if (!Number.isFinite(maxValue) || maxValue <= 0 || !Number.isFinite(percentual) || percentual < 0) return null;
      return {
        label: range?.label || formatDmRangeLabel(maxValue),
        maxValue,
        percentual,
      };
    })
    .filter(Boolean) as InstitutionalPercentageRange[];
  return normalized.length > 0
    ? normalized.sort((a, b) => a.maxValue - b.maxValue)
    : DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES;
}

export function loadDmRanges(): InstitutionalPercentageRange[] {
  if (typeof window === "undefined") return DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES;
  try {
    const stored = window.localStorage.getItem(DM_RANGES_STORAGE_KEY);
    return stored ? normalizeDmRanges(JSON.parse(stored)) : DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES;
  } catch {
    return DEFAULT_INSTITUTIONAL_PERCENTAGE_RANGES;
  }
}

export function saveDmRanges(ranges: InstitutionalPercentageRange[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DM_RANGES_STORAGE_KEY, JSON.stringify(normalizeDmRanges(ranges)));
}

export function getInstitutionalPercentageRange(valorOrigem: number, ranges: InstitutionalPercentageRange[]) {
  if (!valorOrigem || valorOrigem <= 0) return null;
  return normalizeDmRanges(ranges).find((range) => valorOrigem <= range.maxValue) || null;
}
