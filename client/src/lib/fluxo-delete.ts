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
  const uniqueIds = [...new Set(ids)];
  const results = await Promise.allSettled(uniqueIds.map(async (id) => remove(id)));
  const deleted: string[] = [];
  const failed: { id: string; message: string }[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") deleted.push(uniqueIds[index]);
    else failed.push({ id: uniqueIds[index], message: fluxoDeleteError(result.reason) });
  });
  return { deleted, failed };
}
