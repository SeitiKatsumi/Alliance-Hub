type LedCommunity = { id: string | number; nome?: string | null; aliado: string | number | { id: string | number } | null };

export function selectLedCommunity(communities: LedCommunity[], memberId: string, exceptId?: string) {
  const matches = communities.filter(({ id, aliado }) => {
    const leaderId = typeof aliado === "object" ? aliado?.id : aliado;
    return String(leaderId ?? "") === memberId && String(id) !== exceptId;
  });
  if (matches.length > 1 && exceptId === undefined) {
    throw Object.assign(new Error("Este membro lidera mais de uma comunidade. Regularize o vínculo de Aliado BUILT."), { status: 409 });
  }
  const community = matches[0];
  return community ? { id: String(community.id), nome: community.nome ?? null } : null;
}

const PENDING_COMMUNITY_APPROVAL_STATUSES = new Set([
  "candidato",
  "aguardando_avaliacao_aura",
]);

export function isCommunityApprovalPending(status: unknown): boolean {
  return PENDING_COMMUNITY_APPROVAL_STATUSES.has(String(status || "").toLowerCase());
}

export function canSeeCommunityApproval(invite: { status?: string; invitador_membro_id?: string | null }, memberId?: string | null): boolean {
  return invite.status !== "aguardando_avaliacao_aura"
    || Boolean(memberId && String(invite.invitador_membro_id) === String(memberId));
}

export function shouldStartMembershipPaymentAfterApproval(inviteType: unknown): boolean {
  return !["onboarding_inicial", "vitrine", "capital"].includes(String(inviteType || ""));
}

export function statusAfterConnectorAura(inviteType: unknown, connectorId: string, communityLeaderId: string | null) {
  return inviteType === "onboarding_inicial" && connectorId && connectorId === communityLeaderId
    ? "acesso_inicial_ativo" : "candidato";
}
