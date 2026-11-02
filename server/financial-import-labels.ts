type Category = { id: number | string; nome: string; tipo?: string | null; descricao?: string | null };
const normalized = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

/** Only accept catalog IDs or an unambiguous exact catalog label, never an invented category. */
export function financialImportLabels(item: any, categories: Category[]) {
  const byId = categories.find(c => String(c.id) === String(item.categoria_id));
  const byName = categories.filter(c => normalized(c.nome) === normalized(item.categoria_nome));
  const category = byId || (byName.length === 1 ? byName[0] : undefined);
  return {
    descricao: String(item.descricao ?? "").trim().slice(0, 180) || "Lançamento importado por IA",
    categoria_id: category?.id ?? null,
    categoria_nome: category?.nome ?? null,
  };
}

/** Retain the full schedule, enriching only uniquely matching rows without changing financial facts. */
export function financialImportRows(deterministic: any[], ai: any[]) {
  if (ai.length >= deterministic.length) return ai;
  const key = (item: any) => JSON.stringify([item.tipo, Number(item.valor).toFixed(2), item.data_vencimento || item.data]);
  return deterministic.map(item => {
    const matches = ai.filter(other => key(other) === key(item));
    if (matches.length !== 1 || deterministic.filter(other => key(other) === key(item)).length !== 1) return item;
    const suggestion = matches[0];
    // Keep the parser's installment identifier even when the model omits it.
    const installment = String(item.descricao || "").match(/Parcela\s+\d+(?:\s*\/\s*\d+)?/i)?.[0];
    const description = String(suggestion.descricao || item.descricao || "").trim();
    return { ...item, descricao: installment && !description.toLowerCase().includes(installment.toLowerCase()) ? `${installment} · ${description}` : description,
      categoria_id: suggestion.categoria_id, categoria_nome: suggestion.categoria_nome };
  });
}
