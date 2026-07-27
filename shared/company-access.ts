export const COMPANY_ACCESS_KEYS = [
  "inicio",
  "agenda",
  "carteira",
  "vitrine",
  "alliances",
  "capital",
  "aura",
] as const;

export type CompanyAccessKey = typeof COMPANY_ACCESS_KEYS[number];
export type CompanyAccessLevel = "none" | "view" | "edit";
export type CompanyAccessMatrix = Record<CompanyAccessKey, CompanyAccessLevel>;

export const COMPANY_ACCESS_LABELS: Record<CompanyAccessKey, string> = {
  inicio: "Início",
  agenda: "Agenda",
  carteira: "Carteira",
  vitrine: "BUILT Vitrine",
  alliances: "BUILT Alliances",
  capital: "BUILT Capital",
  aura: "Aura",
};

export const DEFAULT_COMPANY_ACCESS: CompanyAccessMatrix = {
  inicio: "view",
  agenda: "none",
  carteira: "none",
  vitrine: "none",
  alliances: "none",
  capital: "none",
  aura: "none",
};

const ACCESS_WEIGHT: Record<CompanyAccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
};

export function isCompanyAccessLevel(value: unknown): value is CompanyAccessLevel {
  return value === "none" || value === "view" || value === "edit";
}

export function normalizeCompanyAccess(value: unknown): CompanyAccessMatrix {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    COMPANY_ACCESS_KEYS.map((key) => [
      key,
      isCompanyAccessLevel(source[key]) ? source[key] : DEFAULT_COMPANY_ACCESS[key],
    ]),
  ) as CompanyAccessMatrix;
}

export function hasCompanyAccess(
  permissions: unknown,
  key: CompanyAccessKey,
  required: Exclude<CompanyAccessLevel, "none"> = "view",
): boolean {
  const normalized = normalizeCompanyAccess(permissions);
  return ACCESS_WEIGHT[normalized[key]] >= ACCESS_WEIGHT[required];
}

export function companyAccessToLegacyPermissions(permissions: unknown): Record<string, CompanyAccessLevel> {
  const normalized = normalizeCompanyAccess(permissions);
  return {
    oportunidades: normalized.alliances,
    bias: normalized.alliances,
    calculadora: normalized.capital,
    fluxo_caixa: normalized.capital,
    membros: normalized.alliances,
    aura: normalized.aura,
    painel: normalized.inicio,
    admin: "none",
  };
}
