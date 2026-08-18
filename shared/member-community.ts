export type MemberCommunityLink = {
  id?: unknown;
  papel?: string | null;
  is_mae?: boolean;
};

export type MemberCommunityInvitation = {
  comunidade_id?: unknown;
  criado_em?: unknown;
};

function normalizedCommunityId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    const relationId = (value as { id?: unknown }).id;
    return relationId === null || relationId === undefined || relationId === ""
      ? null
      : String(relationId);
  }
  return String(value);
}

function invitationTime(value: unknown): number {
  const parsed = value ? new Date(String(value)).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function selectMemberCommunityOrigin<TInvitation extends MemberCommunityInvitation>(
  invitations: TInvitation[],
  links: MemberCommunityLink[],
): {
  communityId: string;
  source: "convite" | "legacy_first_link";
  invitation?: TInvitation;
} | null {
  const invitation = invitations
    .map((item, index) => ({ item, index, communityId: normalizedCommunityId(item.comunidade_id) }))
    .filter((entry): entry is { item: TInvitation; index: number; communityId: string } => Boolean(entry.communityId))
    .sort((a, b) => invitationTime(a.item.criado_em) - invitationTime(b.item.criado_em) || a.index - b.index)[0];

  if (invitation) {
    return {
      communityId: invitation.communityId,
      source: "convite",
      invitation: invitation.item,
    };
  }

  const memberLink = links.find((link) => link.papel === "membro" || link.papel === "ambos") || links[0];
  const communityId = normalizedCommunityId(memberLink?.id);
  return communityId ? { communityId, source: "legacy_first_link" } : null;
}

export function orderedAdesaoCommunityIds(
  communityMotherId: unknown,
  links: MemberCommunityLink[],
): string[] {
  const ordered = [
    normalizedCommunityId(communityMotherId),
    normalizedCommunityId(links.find((link) => link.is_mae)?.id),
    ...links.map((link) => normalizedCommunityId(link.id)),
  ].filter((id): id is string => Boolean(id));

  return Array.from(new Set(ordered));
}
