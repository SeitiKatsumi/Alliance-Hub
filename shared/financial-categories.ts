export interface FinancialCategory {
  id: number;
  Nome_da_categoria: string;
  Tipo_de_categoria?: string | null;
  Descricao_das_categorias?: string;
  bia_id?: string | null;
}

/** Repair only reversible UTF-8 decoded as Latin1/Windows-1252. Never strip accents. */
export function categoryText(value?: string | null): string {
  let text = String(value || "").trim();
  const cp1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
  for (let pass = 0; pass < 3 && /[ÃÂâ]/.test(text); pass++) {
    const bytes = [...text].map(c => cp1252.includes(c) ? 128 + cp1252.indexOf(c) : c.charCodeAt(0));
    if (bytes.some(n => n > 255)) break;
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      if (decoded === text) break;
      text = decoded;
    } catch { break; }
  }
  return text.normalize("NFC").replace(/\s+/g, " ");
}

export function financialCategoryKey(c: FinancialCategory): string {
  // Codes, groups, directions and BIA scopes are meaningful; do not merge just by label.
  return JSON.stringify([c.Nome_da_categoria, c.Tipo_de_categoria, c.Descricao_das_categorias, c.bia_id]
    .map(value => categoryText(value).toLocaleLowerCase("pt-BR")));
}

export function financialCategoryOptions<T extends FinancialCategory>(items: T[], selected?: number | null): T[] {
  const groups = new Map<string, T>();
  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    const key = financialCategoryKey(item);
    if (!groups.has(key) || item.id === selected) groups.set(key, item);
  }
  return [...groups.values()];
}

export function matchingFinancialCategory(items: FinancialCategory[], left: number | string, right: number | string): boolean {
  if (String(left) === String(right)) return true;
  const a = items.find(c => String(c.id) === String(left)), b = items.find(c => String(c.id) === String(right));
  return !!a && !!b && financialCategoryKey(a) === financialCategoryKey(b);
}
