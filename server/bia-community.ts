/** The author relation and the stored mother community are authoritative.
 * Only append the missing M2M row; never replace a community's BIA array.
 */
export function biaCommunityId(value: unknown): string {
  if (value && typeof value === "object") return biaCommunityId((value as any).id);
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export interface BiaCommunityDependencies {
  lock<T>(biaId: string, work: () => Promise<T>): Promise<T>;
  bia(id: string): Promise<{ id: unknown; autor_bia?: unknown } | null>;
  mother(authorId: string): Promise<unknown>;
  communityExists(id: string): Promise<boolean>;
  linked(biaId: string, communityId: string): Promise<boolean>;
  append(biaId: string, communityId: string): Promise<void>;
  list(authorId?: string): Promise<Array<{ id: unknown }>>;
}

export function createBiaCommunitySync(deps: BiaCommunityDependencies) {
  async function sync(id: string) {
    return deps.lock(id, async () => {
      // Read again inside the lock: neither caller payload nor logged-in user is the author.
      const bia = await deps.bia(id);
      if (!bia) return { status: "missing_bia" as const };
      const authorId = biaCommunityId(bia.autor_bia);
      if (!authorId) return { status: "missing_author" as const };
      const communityId = biaCommunityId(await deps.mother(authorId));
      if (!communityId) return { status: "missing_mother" as const };
      if (!await deps.communityExists(communityId)) throw new Error("Comunidade Mãe do autor indisponível.");
      if (await deps.linked(id, communityId)) return { status: "existing" as const, communityId };
      try {
        await deps.append(id, communityId);
      } catch (error) {
        // Unknown response is reconciled by reading, not by blindly issuing a second POST.
        if (!await deps.linked(id, communityId)) throw error;
      }
      if (!await deps.linked(id, communityId)) throw new Error("Vínculo da BIA não confirmado.");
      return { status: "linked" as const, communityId };
    });
  }

  async function reconcile(authorId?: string) {
    const result = { total: 0, linked: 0, existing: 0, missing_author: 0, missing_mother: 0, missing_bia: 0, failed: [] as string[] };
    for (const bia of await deps.list(authorId)) {
      const id = biaCommunityId(bia.id);
      if (!id) continue;
      result.total++;
      try { result[(await sync(id)).status]++; }
      catch { result.failed.push(id); }
    }
    return result;
  }
  return { sync, reconcile };
}
