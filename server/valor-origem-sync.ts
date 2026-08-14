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

export function isCancelledValorOrigemEntry(entry: Record<string, any>): boolean {
  const status = normalizeText(entry.status);
  const paymentStatus = normalizeText(entry.pagamento_status);
  return status === "cancelado"
    || status === "cancelada"
    || paymentStatus === "cancelado"
    || paymentStatus === "cancelada";
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

function comparableNumber(value: unknown): string {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

export function valorOrigemScheduleKey(entry: Record<string, any>): string {
  return [
    valorOrigemEntryKey(entry),
    comparableNumber(entry.valor),
    String(entry.data_vencimento ?? ""),
    relationId(entry.membro_responsavel),
    relationId(entry.tipo_de_cpp),
  ].join("|");
}

function protectedEntryFingerprint(entry: Record<string, any>): string {
  return JSON.stringify({
    id: String(entry.id ?? ""),
    status: normalizeText(entry.status),
    pagamento_status: normalizeText(entry.pagamento_status),
    valor: comparableNumber(entry.valor),
    data_pagamento: String(entry.data_pagamento ?? ""),
    pagamento_provider: String(entry.pagamento_provider ?? ""),
    pagamento_id: String(entry.pagamento_id ?? ""),
    pagamento_url: String(entry.pagamento_url ?? ""),
    pagamento_gerado_em: String(entry.pagamento_gerado_em ?? ""),
    anexos: relationId(entry.Anexos ?? entry.anexos),
  });
}

export function protectedValorOrigemSnapshot(entries: Record<string, any>[]): Map<string, string> {
  return new Map(
    entries
      .filter(isProtectedValorOrigemEntry)
      .filter((entry) => entry.id != null)
      .map((entry) => [String(entry.id), protectedEntryFingerprint(entry)]),
  );
}

export function assertProtectedValorOrigemEntriesUnchanged(
  before: Map<string, string>,
  after: Record<string, any>[],
): void {
  const afterById = new Map(after.map((entry) => [String(entry.id), entry]));
  before.forEach((fingerprint, id) => {
    const current = afterById.get(id);
    if (!current) {
      throw new Error(`Lancamento financeiro protegido removido durante a sincronizacao: ${id}`);
    }
    if (protectedEntryFingerprint(current) !== fingerprint) {
      throw new Error(`Lancamento financeiro protegido alterado durante a sincronizacao: ${id}`);
    }
  });
}

export function reconcileValorOrigemEntries(
  existing: Record<string, any>[],
  desired: Record<string, any>[],
) {
  const archived = existing.filter(isCancelledValorOrigemEntry);
  const active = existing.filter((entry) => !isCancelledValorOrigemEntry(entry));
  const preserved = active.filter(isProtectedValorOrigemEntry);
  const pending = active.filter((entry) => !isProtectedValorOrigemEntry(entry));
  const remainingDesired = [...desired];

  // A paid/validated entry owns its logical installment even if the schedule changes later.
  for (const entry of preserved) {
    const key = valorOrigemEntryKey(entry);
    const desiredIndex = remainingDesired.findIndex((candidate) => valorOrigemEntryKey(candidate) === key);
    if (desiredIndex >= 0) remainingDesired.splice(desiredIndex, 1);
  }

  const retained: Record<string, any>[] = [];
  const replaceable: Record<string, any>[] = [];
  for (const entry of pending) {
    const key = valorOrigemScheduleKey(entry);
    const desiredIndex = remainingDesired.findIndex((candidate) => valorOrigemScheduleKey(candidate) === key);
    if (desiredIndex >= 0) {
      retained.push(entry);
      remainingDesired.splice(desiredIndex, 1);
    } else {
      replaceable.push(entry);
    }
  }

  return { archived, preserved, retained, replaceable, toCreate: remainingDesired };
}
