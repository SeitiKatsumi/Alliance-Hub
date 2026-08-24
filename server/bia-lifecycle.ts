type DirectusRelation = string | number | { id?: string | number | null; cadastro_geral_id?: DirectusRelation; membro_id?: DirectusRelation } | null | undefined;

export interface BiaLifecycleRecord {
  situacao?: string | null;
  aliado_built?: DirectusRelation;
  diretor_alianca?: DirectusRelation;
  diretor_nucleo_tecnico?: DirectusRelation;
  diretor_execucao?: DirectusRelation;
  diretor_comercial?: DirectusRelation;
  diretor_capital?: DirectusRelation;
  socios_guardioes?: DirectusRelation[] | null;
  socios_multiplicadores?: DirectusRelation[] | null;
}

export function lifecycleRelationId(value: DirectusRelation): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    if (value.id !== null && value.id !== undefined && value.id !== "") return String(value.id);
    return lifecycleRelationId(value.cadastro_geral_id) || lifecycleRelationId(value.membro_id);
  }
  return String(value);
}

export function biaDirectorIds(bia: BiaLifecycleRecord) {
  return [
    bia.diretor_alianca,
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ].map(lifecycleRelationId).filter((id): id is string => Boolean(id));
}

export function isBiaDirector(bia: BiaLifecycleRecord, memberId: unknown) {
  const normalizedMemberId = lifecycleRelationId(memberId as DirectusRelation);
  return Boolean(normalizedMemberId && biaDirectorIds(bia).includes(normalizedMemberId));
}

export function biaFormalParticipantIds(bia: BiaLifecycleRecord) {
  const listIds = (value: DirectusRelation[] | null | undefined) => (Array.isArray(value) ? value : [])
    .map(lifecycleRelationId)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set([
    ...biaDirectorIds(bia),
    ...listIds(bia.socios_guardioes),
    ...listIds(bia.socios_multiplicadores),
  ]));
}

export function biaActivationRequirements(input: {
  bia: BiaLifecycleRecord;
  pendingDirectorInvites?: number;
  pendingPartnerInvites?: number;
  acceptedMouMemberIds?: Iterable<string>;
}) {
  const { bia } = input;
  const missing: string[] = [];
  if (!lifecycleRelationId(bia.aliado_built)) missing.push("Aliado BUILT");
  if (!lifecycleRelationId(bia.diretor_alianca)) missing.push("Diretor da Aliança");
  if (Number(input.pendingDirectorInvites || 0) > 0) {
    missing.push(`${input.pendingDirectorInvites} convite(s) de diretoria pendente(s)`);
  }
  if (Number(input.pendingPartnerInvites || 0) > 0) {
    missing.push(`${input.pendingPartnerInvites} convite(s) de sócio pendente(s)`);
  }
  const accepted = new Set(Array.from(input.acceptedMouMemberIds || []).map(String));
  const missingMou = biaFormalParticipantIds(bia).filter((memberId) => !accepted.has(memberId));
  if (missingMou.length > 0) missing.push(`${missingMou.length} aceite(s) de MOU pendente(s)`);
  return { canActivate: missing.length === 0, missing, missingMou };
}

export function canCreateObaForBia(bia: BiaLifecycleRecord, memberId: unknown, isPlatformAdmin = false) {
  if (String(bia.situacao || "ativa") !== "ativa") return false;
  return isPlatformAdmin || isBiaDirector(bia, memberId);
}

export function biaDeletionTargets(biaId: string, communityLinkIds: Array<string | number>) {
  return [
    ...communityLinkIds.map((id) => ({ collection: "comunidade_bias", id: String(id) })),
    { collection: "bias_projetos", id: biaId },
  ];
}
