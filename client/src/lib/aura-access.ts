import type { AppUser } from "@/hooks/use-auth";

function userRedes(user?: AppUser | null): string[] {
  return Array.isArray(user?.Outras_redes_as_quais_pertenco) ? user!.Outras_redes_as_quais_pertenco! : [];
}

function truthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isBuiltMemberForAura(user?: AppUser | null): boolean {
  const role = user?.role || "";
  const redes = userRedes(user);
  return (
    truthyFlag(user?.em_membros_built) ||
    ["membro", "aliado", "manager", "admin", "superadmin"].includes(role) ||
    redes.includes("BUILT_PROUD_MEMBER") ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER")
  );
}

export function isVitrineOnlyUser(user?: AppUser | null): boolean {
  return (
    user?.role === "user" &&
    truthyFlag(user?.na_vitrine) &&
    !truthyFlag(user?.em_membros_built) &&
    !truthyFlag(user?.em_built_capital)
  );
}

function relationId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "object") {
    if (value.id) return String(value.id);
    if (value.cadastro_geral_id) return relationId(value.cadastro_geral_id);
    if (value.bias_projetos_id) return relationId(value.bias_projetos_id);
    return null;
  }
  return String(value);
}

function parseMemberList(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => relationId(item?.cadastro_geral_id ?? item))
      .filter((id): id is string => Boolean(id));
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseMemberList(parsed);
  } catch {
    // Keep the comma-separated fallback below for legacy records.
  }
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function isCurrentUserLinkedToBia(bia: any, currentMemberId?: string | null): boolean {
  if (!currentMemberId) return false;
  const current = String(currentMemberId);
  const singleFields = [
    "autor_bia",
    "aliado_built",
    "diretor_alianca",
    "diretor_nucleo_tecnico",
    "diretor_execucao",
    "diretor_comercial",
    "diretor_capital",
  ];
  if (singleFields.some((field) => relationId(bia?.[field]) === current)) return true;
  return [
    ...parseMemberList(bia?.socios_guardioes),
    ...parseMemberList(bia?.socios_multiplicadores),
    ...parseMemberList(bia?.terceiros),
  ].includes(current);
}

export function getAuraLinkedMemberIds({
  comunidades = [],
  bias = [],
  currentMemberId,
}: {
  comunidades?: any[];
  bias?: any[];
  currentMemberId?: string | null;
}): Set<string> {
  const ids = new Set<string>();
  const current = currentMemberId ? String(currentMemberId) : "";

  for (const comunidade of comunidades) {
    const aliadoId = relationId(comunidade?.aliado);
    if (aliadoId) ids.add(aliadoId);
    const membros = Array.isArray(comunidade?.membros) ? comunidade.membros : [];
    for (const membro of membros) {
      const id = relationId(membro?.cadastro_geral_id ?? membro);
      if (id) ids.add(id);
    }
  }

  const biaMemberFields = [
    "autor_bia",
    "aliado_built",
    "diretor_alianca",
    "diretor_nucleo_tecnico",
    "diretor_execucao",
    "diretor_comercial",
    "diretor_capital",
  ];
  for (const bia of bias) {
    if (!isCurrentUserLinkedToBia(bia, current)) continue;
    for (const field of biaMemberFields) {
      const id = relationId(bia?.[field]);
      if (id) ids.add(id);
    }
    for (const id of parseMemberList(bia?.socios_guardioes)) ids.add(id);
    for (const id of parseMemberList(bia?.socios_multiplicadores)) ids.add(id);
    for (const id of parseMemberList(bia?.terceiros)) ids.add(id);
  }

  if (current) ids.delete(current);
  return ids;
}

export function canRegisterAuraForMember({
  user,
  targetMemberId,
  linkedMemberIds,
}: {
  user?: AppUser | null;
  targetMemberId?: string | null;
  linkedMemberIds?: Set<string>;
}): boolean {
  if (!targetMemberId || user?.membro_directus_id === targetMemberId) return false;
  if (!isBuiltMemberForAura(user)) return false;
  return Boolean(linkedMemberIds?.has(String(targetMemberId)));
}
