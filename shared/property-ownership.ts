export const PROPERTY_OWNERSHIP_ACCEPTANCE_VERSION = 1;
export const PROPERTY_MAP_EPSILON = 0.0001;

export type PropertyPartnerInput = {
  id?: string;
  nome?: string | null;
  email?: string | null;
  user_id?: string | null;
  membro_id?: string | null;
  map_percentual?: number | string | null;
  status?: string | null;
};

export type PropertyOriginAllocation = {
  socioId?: string;
  membroId: string;
  nome: string;
  papel: "guardiao" | "multiplicador";
  percentual: number;
  valor: number;
};

export function normalizePropertyPartners(items: unknown): PropertyPartnerInput[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const normalized: PropertyPartnerInput[] = [];
  for (const item of items) {
    const email = String(item?.email || "").trim().toLowerCase();
    const membroId = String(item?.membro_id || "").trim();
    const userId = String(item?.user_id || "").trim();
    const key = membroId || userId || email;
    const percentage = Number(item?.map_percentual);
    if (!key || seen.has(key) || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) continue;
    seen.add(key);
    normalized.push({
      id: item?.id ? String(item.id) : undefined,
      nome: String(item?.nome || email).trim(),
      email: email || null,
      user_id: userId || null,
      membro_id: membroId || null,
      map_percentual: Math.round(percentage * 10_000) / 10_000,
      status: item?.status ? String(item.status) : null,
    });
  }
  return normalized;
}

export function propertyMapTotal(items: PropertyPartnerInput[]): number {
  return Math.round(items.reduce((sum, item) => sum + Number(item.map_percentual || 0), 0) * 10_000) / 10_000;
}

export function propertyMapIsComplete(items: PropertyPartnerInput[]): boolean {
  return items.length > 0 && Math.abs(propertyMapTotal(items) - 100) <= PROPERTY_MAP_EPSILON;
}

export function buildPropertyOriginAllocations(
  partners: PropertyPartnerInput[],
  roles: Record<string, "guardiao" | "multiplicador">,
  originValue: number,
): PropertyOriginAllocation[] {
  if (!propertyMapIsComplete(partners) || !Number.isFinite(originValue) || originValue <= 0) return [];
  const allocations: PropertyOriginAllocation[] = [];
  for (const partner of partners) {
    const memberId = String(partner.membro_id || "");
    const role = roles[String(partner.id || memberId)] || roles[memberId];
    if (!memberId || !role || partner.status !== "aceito") continue;
    const percentage = Number(partner.map_percentual || 0);
    allocations.push({
      socioId: partner.id,
      membroId: memberId,
      nome: String(partner.nome || partner.email || "Coproprietário"),
      papel: role,
      percentual: percentage,
      valor: Math.round(originValue * percentage) / 100,
    });
  }
  return allocations;
}
