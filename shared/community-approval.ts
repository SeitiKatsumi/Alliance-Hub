const PENDING_COMMUNITY_APPROVAL_STATUSES = new Set([
  "candidato",
  "aguardando_avaliacao_aura",
]);

export function isCommunityApprovalPending(status: unknown): boolean {
  return PENDING_COMMUNITY_APPROVAL_STATUSES.has(String(status || "").toLowerCase());
}

export function shouldStartMembershipPaymentAfterApproval(inviteType: unknown): boolean {
  return !["onboarding_inicial", "vitrine", "capital"].includes(String(inviteType || ""));
}
