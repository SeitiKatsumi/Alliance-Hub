import { getContributionAreaDisplayName, normalizeContributionAreaValues } from "@shared/contribution-areas";
import { normalizeProfileLanguages } from "@shared/profile-taxonomy";
import { formatRamosDisplay, formatSegmentosDisplay } from "@/lib/ramos-segmentos";

export type OnboardingConfigurationSummaryInput = {
  areas?: unknown;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  area_atuacao?: string | null;
  especialidade_livre?: string | null;
  idiomas?: unknown;
};

export type OnboardingActivitySummaryItem = {
  label: string;
  value: string;
};

export function buildOnboardingConfigurationSummary(configuration?: OnboardingConfigurationSummaryInput | null) {
  const config = configuration || {};
  const contributionAreas = normalizeContributionAreaValues(config.areas)
    .map(getContributionAreaDisplayName);

  const activity: OnboardingActivitySummaryItem[] = [
    { label: "Ramo", value: formatRamosDisplay(config.ramo_atuacao) },
    { label: "Segmento", value: formatSegmentosDisplay(config.segmento) },
    { label: "Área de atuação", value: String(config.area_atuacao || "").trim() },
    { label: "Especialidade", value: String(config.especialidade_livre || "").trim() },
    { label: "Idiomas", value: normalizeProfileLanguages(config.idiomas).join(", ") },
  ].filter((item) => item.value);

  return { contributionAreas, activity };
}
