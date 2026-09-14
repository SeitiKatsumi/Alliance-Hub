export function fluxoDeleteNeedsConfirmation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  try {
    return message.startsWith("409:") && JSON.parse(message.replace(/^409:\s*/, "")).code === "FLUXO_DELETE_CONFIRMATION_REQUIRED";
  } catch { return false; }
}

export function fluxoDeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const body = JSON.parse(message.replace(/^\d{3}:\s*/, ""));
    if (typeof body.error === "string") return body.error;
  } catch {}
  return message;
}

export async function deleteFluxoBatch(
  ids: string[],
  remove: (id: string) => Promise<unknown>,
) {
  const uniqueIds = Array.from(new Set(ids));
  const results = await Promise.allSettled(uniqueIds.map(async (id) => remove(id)));
  const deleted: string[] = [];
  const failed: { id: string; message: string; confirmationRequired?: boolean }[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") deleted.push(uniqueIds[index]);
    else failed.push({ id: uniqueIds[index], message: fluxoDeleteError(result.reason), ...(fluxoDeleteNeedsConfirmation(result.reason) ? { confirmationRequired: true } : {}) });
  });
  return { deleted, failed };
}
