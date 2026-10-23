export const PUBLIC_LABELS = {
  Market: "Tese de interesse",
  StrategicCell: "Célula",
  GovernanceProfile: "Regras desta BIA",
  ContributionArea: "O que você pode oferecer",
} as const;

export type PublicLabelKey = keyof typeof PUBLIC_LABELS;

export function publicLabel(key: PublicLabelKey, override?: string | null) {
  const label = override?.trim();
  const normalized = label?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  // Translate only retired names of this concept; preserve unrelated custom labels.
  if (key === "Market" && /^(?:tipos? de negocios?|objetivo da alianca)$/.test(normalized || "")) return PUBLIC_LABELS.Market;
  return label || PUBLIC_LABELS[key];
}
