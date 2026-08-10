const PROTECTED_STATUSES = new Set([
  "pago",
  "paga",
  "parcial",
  "cancelado",
  "cancelada",
  "confirmado",
  "confirmada",
  "concluido",
  "concluida",
  "recebido",
  "recebida",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function relationId(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(relationId).filter(Boolean).sort().join(",");
  }
  if (!value || typeof value !== "object") return String(value ?? "");

  const relation = value as Record<string, unknown>;
  if (relation.id != null) return String(relation.id);

  for (const key of ["cadastro_geral_id", "categorias_id", "tipos_cpp_id", "directus_files_id"]) {
    if (relation[key] != null) return relationId(relation[key]);
  }
  return "";
}

function hasItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

export function isProtectedValorOrigemEntry(entry: Record<string, any>): boolean {
  const status = normalizeText(entry.status);
  const paymentStatus = normalizeText(entry.pagamento_status);

  return PROTECTED_STATUSES.has(status)
    || PROTECTED_STATUSES.has(paymentStatus)
    || hasItems(entry.data_pagamento)
    || hasItems(entry.Anexos)
    || hasItems(entry.anexos)
    || hasItems(entry.pagamento_provider)
    || hasItems(entry.pagamento_id)
    || hasItems(entry.pagamento_url)
    || hasItems(entry.pagamento_gerado_em);
}

export function valorOrigemEntryKey(entry: Record<string, any>): string {
  const beneficiary = relationId(entry.favorecido_id ?? entry.Favorecido);
  const category = relationId(entry.Categoria);
  return [normalizeText(entry.descricao), normalizeText(entry.tipo), beneficiary, category].join("|");
}

export function reconcileValorOrigemEntries(
  existing: Record<string, any>[],
  desired: Record<string, any>[],
) {
  const preserved = existing.filter(isProtectedValorOrigemEntry);
  const replaceable = existing.filter((entry) => !isProtectedValorOrigemEntry(entry));
  const preservedCounts = new Map<string, number>();

  for (const entry of preserved) {
    const key = valorOrigemEntryKey(entry);
    preservedCounts.set(key, (preservedCounts.get(key) || 0) + 1);
  }

  const toCreate = desired.filter((entry) => {
    const key = valorOrigemEntryKey(entry);
    const remaining = preservedCounts.get(key) || 0;
    if (remaining <= 0) return true;
    preservedCounts.set(key, remaining - 1);
    return false;
  });

  return { preserved, replaceable, toCreate };
}
