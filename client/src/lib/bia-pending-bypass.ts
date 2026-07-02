const PENDING_BYPASS_BIA_CODES = new Set(["RHCF8KKLKC"]);

export function isBiaPendingBypassed(bia?: { codigo_publico?: string | null; id?: string | null } | null) {
  const publicCode = String(bia?.codigo_publico || "").toUpperCase();
  const fallbackId = String(bia?.id || "").toUpperCase();
  return PENDING_BYPASS_BIA_CODES.has(publicCode) || PENDING_BYPASS_BIA_CODES.has(fallbackId);
}
