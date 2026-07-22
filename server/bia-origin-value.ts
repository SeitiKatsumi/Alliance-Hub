export type BiaOriginPatch = {
  provided: boolean;
  shouldUpdate: boolean;
  value?: number;
  error?: string;
};

export function normalizeBiaOriginPatch(body: Record<string, any> | null | undefined): BiaOriginPatch {
  const provided = !!body && Object.prototype.hasOwnProperty.call(body, "valor_origem");
  if (!provided) return { provided: false, shouldUpdate: false };

  const incoming = body?.valor_origem;
  if (incoming === null || incoming === undefined) {
    return { provided: true, shouldUpdate: false };
  }

  const raw = String(incoming).trim();
  if (!raw) return { provided: true, shouldUpdate: false };

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return {
      provided: true,
      shouldUpdate: false,
      error: "Valor de origem invalido.",
    };
  }

  return { provided: true, shouldUpdate: true, value };
}
