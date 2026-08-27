export const PUBLIC_LABELS = {
  Market: "Tipo de negócio",
  StrategicCell: "Célula",
  GovernanceProfile: "Regras desta BIA",
  ContributionArea: "O que você pode oferecer",
} as const;

export type PublicLabelKey = keyof typeof PUBLIC_LABELS;

export function publicLabel(key: PublicLabelKey) {
  return PUBLIC_LABELS[key];
}
