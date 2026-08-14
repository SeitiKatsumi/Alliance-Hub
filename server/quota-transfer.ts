export type UpdateQuotaTransfer = (
  id: string,
  patch: { status: "aceita" },
) => Promise<unknown>;

export async function acceptQuotaTransfer(
  id: string,
  updateTransfer: UpdateQuotaTransfer,
) {
  // Quota transfers affect only the allocation map. Financial entries are intentionally
  // absent from this service's dependencies, preventing accidental ledger mutations.
  return updateTransfer(id, { status: "aceita" });
}
