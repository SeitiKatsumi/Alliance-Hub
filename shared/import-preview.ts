export interface ImportPreviewItem {
  tipo: "entrada" | "saida";
  valor: number;
  data: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: "pendente" | "agendado" | "pago" | "parcial" | "vencido" | "cancelado";
  descricao: string;
  categoria_id: number | null;
  categoria_nome?: string | null;
  tipo_cpp_id: number | null;
  tipo_cpp_nome?: string | null;
  observacao?: string | null;
}

export function importPreviewError(items: ImportPreviewItem[]): string | null {
  if (!items.length) return "Adicione pelo menos um lançamento.";
  for (const [index, item] of items.entries()) {
    const prefix = `Lançamento ${index + 1}: `;
    if (!Number.isFinite(item.valor) || item.valor <= 0 || !Number.isSafeInteger(Math.round(item.valor * 100))) return prefix + "informe um valor válido maior que zero.";
    if (Math.abs(item.valor * 100 - Math.round(item.valor * 100)) > 0.000001) return prefix + "use no máximo duas casas decimais no valor.";
    if (!item.descricao.trim()) return prefix + "informe a descrição.";
    for (const date of [item.data, item.data_vencimento, item.data_pagamento]) {
      if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return prefix + "informe uma data válida.";
    }
  }
  return null;
}

export function mergeImportPreview(items: ImportPreviewItem[], selected: number[]): ImportPreviewItem[] {
  const indices = [...new Set(selected)].sort((a, b) => a - b);
  if (indices.length < 2 || indices.some(i => !Number.isInteger(i) || !items[i])) throw new Error("Selecione pelo menos dois lançamentos.");
  const chosen = indices.map(i => items[i]);
  const error = importPreviewError(chosen);
  if (error) throw new Error(error);
  const first = chosen[0];
  for (const key of ["tipo", "status", "data", "data_vencimento", "data_pagamento"] as const) {
    if (chosen.some(item => item[key] !== first[key])) throw new Error("Para juntar, ajuste os itens para o mesmo tipo, status e datas.");
  }
  const merged: ImportPreviewItem = {
    ...first,
    valor: chosen.reduce((sum, item) => sum + Math.round(item.valor * 100), 0) / 100,
    descricao: chosen.map(item => item.descricao.trim()).join("; ").slice(0, 180),
    observacao: chosen.map(item => item.observacao).filter(Boolean).join("; ") || null,
  };
  if (chosen.some(item => item.categoria_id !== first.categoria_id)) { merged.categoria_id = null; merged.categoria_nome = null; }
  if (chosen.some(item => item.tipo_cpp_id !== first.tipo_cpp_id)) { merged.tipo_cpp_id = null; merged.tipo_cpp_nome = null; }
  const result = items.flatMap((item, i) => i === indices[0] ? [merged] : indices.includes(i) ? [] : [item]);
  const resultError = importPreviewError(result);
  if (resultError) throw new Error(resultError);
  return result;
}
