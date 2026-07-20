export const BIA_ACCESS_KEYS = [
  "diretoria",
  "configuracao_bia",
  "documentos_tecnico",
  "documentos_obra",
  "documentos_comercial",
  "documentos_capital",
  "capital_banco",
  "capital_financeiro",
  "capital_analises",
  "capital_calculadora",
] as const;

export type BiaAccessKey = (typeof BIA_ACCESS_KEYS)[number];
export type BiaAccessLevel = "none" | "view" | "edit";
export type BiaAccessMatrix = Record<BiaAccessKey, BiaAccessLevel>;

export const EMPTY_BIA_ACCESS: BiaAccessMatrix = Object.freeze({
  diretoria: "none",
  configuracao_bia: "none",
  documentos_tecnico: "none",
  documentos_obra: "none",
  documentos_comercial: "none",
  documentos_capital: "none",
  capital_banco: "none",
  capital_financeiro: "none",
  capital_analises: "none",
  capital_calculadora: "none",
});

export const FULL_BIA_ACCESS: BiaAccessMatrix = Object.freeze(
  Object.fromEntries(BIA_ACCESS_KEYS.map((key) => [key, "edit"])) as BiaAccessMatrix,
);

export const BIA_PARTICIPANT_ROLE_FIELDS = {
  autor: "autor_bia",
  aliado: "aliado_built",
  diretor_alianca: "diretor_alianca",
  diretor_tecnico: "diretor_nucleo_tecnico",
  diretor_obra: "diretor_execucao",
  diretor_comercial: "diretor_comercial",
  diretor_capital: "diretor_capital",
} as const;

export type BiaParticipantRole = keyof typeof BIA_PARTICIPANT_ROLE_FIELDS
  | "socio_guardiao"
  | "socio_multiplicador"
  | "terceiro";

export const BIA_PARTICIPANT_ROLE_LABELS: Record<BiaParticipantRole, string> = {
  autor: "Autor da Oportunidade",
  aliado: "Aliado BUILT",
  diretor_alianca: "Diretor de Aliança",
  diretor_tecnico: "Diretor do Núcleo Técnico",
  diretor_obra: "Diretor do Núcleo de Obra",
  diretor_comercial: "Diretor do Núcleo Comercial",
  diretor_capital: "Diretor do Núcleo de Capital",
  socio_guardiao: "Sócio Guardião",
  socio_multiplicador: "Sócio Multiplicador",
  terceiro: "Terceiro vinculado",
};

const LEVEL_RANK: Record<BiaAccessLevel, number> = { none: 0, view: 1, edit: 2 };

export function isBiaAccessLevel(value: unknown): value is BiaAccessLevel {
  return value === "none" || value === "view" || value === "edit";
}

export function normalizeBiaAccessMatrix(value: unknown): BiaAccessMatrix {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    BIA_ACCESS_KEYS.map((key) => [key, isBiaAccessLevel(source[key]) ? source[key] : "none"]),
  ) as BiaAccessMatrix;
}

export function mergeBiaAccess(...matrices: Array<Partial<BiaAccessMatrix> | null | undefined>): BiaAccessMatrix {
  const merged = { ...EMPTY_BIA_ACCESS };
  for (const matrix of matrices) {
    if (!matrix) continue;
    for (const key of BIA_ACCESS_KEYS) {
      const level = matrix[key];
      if (level && LEVEL_RANK[level] > LEVEL_RANK[merged[key]]) merged[key] = level;
    }
  }
  return merged;
}

export function hasBiaAccess(
  matrix: Partial<BiaAccessMatrix> | null | undefined,
  key: BiaAccessKey,
  required: Exclude<BiaAccessLevel, "none"> = "view",
): boolean {
  return LEVEL_RANK[matrix?.[key] || "none"] >= LEVEL_RANK[required];
}

export function relationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (item.id !== null && item.id !== undefined) return String(item.id);
    if (item.cadastro_geral_id !== null && item.cadastro_geral_id !== undefined) {
      return relationId(item.cadastro_geral_id);
    }
    return null;
  }
  return String(value).trim() || null;
}

export function parseBiaParticipantList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(relationId).filter((id): id is string => Boolean(id))));
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseBiaParticipantList(parsed);
  } catch {}
  return Array.from(new Set(value.split(",").map((id) => id.trim()).filter(Boolean)));
}

export function collectBiaParticipantRoles(bia: Record<string, any>): Map<string, BiaParticipantRole[]> {
  const participants = new Map<string, BiaParticipantRole[]>();
  const add = (memberId: string | null, role: BiaParticipantRole) => {
    if (!memberId) return;
    const roles = participants.get(memberId) || [];
    if (!roles.includes(role)) roles.push(role);
    participants.set(memberId, roles);
  };

  for (const [role, field] of Object.entries(BIA_PARTICIPANT_ROLE_FIELDS)) {
    add(relationId(bia[field]), role as BiaParticipantRole);
  }
  for (const id of parseBiaParticipantList(bia.socios_guardioes)) add(id, "socio_guardiao");
  for (const id of parseBiaParticipantList(bia.socios_multiplicadores)) add(id, "socio_multiplicador");
  for (const id of parseBiaParticipantList(bia.terceiros)) add(id, "terceiro");
  return participants;
}

export function defaultBiaAccessForRoles(roles: BiaParticipantRole[]): BiaAccessMatrix {
  const matrices: Partial<BiaAccessMatrix>[] = [];
  for (const role of roles) {
    if (role === "autor") matrices.push({ diretoria: "view" });
    if (role === "aliado" || role === "diretor_alianca") {
      matrices.push({ diretoria: "edit", configuracao_bia: "edit" });
    }
    if (role === "diretor_tecnico") matrices.push({ documentos_tecnico: "edit" });
    if (role === "diretor_obra") matrices.push({ documentos_obra: "edit" });
    if (role === "diretor_comercial") matrices.push({ documentos_comercial: "edit" });
    if (role === "diretor_capital") {
      matrices.push({
        documentos_capital: "edit",
        capital_banco: "edit",
        capital_financeiro: "edit",
        capital_analises: "edit",
        capital_calculadora: "edit",
      });
    }
  }
  return mergeBiaAccess(...matrices);
}

export function canManageBiaAccess(roles: BiaParticipantRole[]): boolean {
  return roles.includes("aliado") || roles.includes("diretor_alianca");
}

export function resolveBiaParticipantPermissions(
  roles: BiaParticipantRole[],
  override: unknown | null | undefined,
  storageAvailable = true,
): BiaAccessMatrix {
  const managerFloor = canManageBiaAccess(roles) ? { diretoria: "edit" as const } : null;
  if (!storageAvailable) return mergeBiaAccess(EMPTY_BIA_ACCESS, managerFloor);

  const base = override === null || override === undefined
    ? defaultBiaAccessForRoles(roles)
    : normalizeBiaAccessMatrix(override);
  return mergeBiaAccess(base, managerFloor);
}
