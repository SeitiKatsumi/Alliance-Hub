export interface EditablePropertyLaunch {
  id: string;
  tipo: string;
  categoria: string;
  valor: number;
  data: string;
  status?: string;
  descricao: string;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  observacao?: string;
}

export function propertyLaunchForm(item?: EditablePropertyLaunch | null) {
  return {
    tipo: item?.tipo ?? "despesa",
    categoria: item?.categoria ?? "Manutenção",
    // Never interpret a persisted decimal point as a thousands separator.
    valor: item ? String(item.valor).replace(".", ",") : "",
    data: item?.data ?? new Date().toISOString().slice(0, 10),
    status: item?.status ?? "pago",
    descricao: item?.descricao ?? "",
    data_vencimento: item?.data_vencimento ?? "",
    data_pagamento: item?.data_pagamento ?? "",
    observacao: item?.observacao ?? "",
  };
}

export function propertyLaunchRequest(form: ReturnType<typeof propertyLaunchForm>, imovelId: string, launchId?: string) {
  const raw = form.valor.trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  const valor = /^[\d.,]+$/.test(raw) ? Number(normalized) : NaN;
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor maior que zero.");
  if (!form.descricao.trim() || !form.data) throw new Error("Preencha a descrição e a data.");
  const fields = { ...form, valor, descricao: form.descricao.trim(), data_vencimento: form.data_vencimento || null, data_pagamento: form.data_pagamento || null };
  return launchId
    ? { method: "PATCH", url: `/api/carteira/lancamentos/${encodeURIComponent(launchId)}`, body: fields }
    : { method: "POST", url: "/api/carteira/lancamentos", body: { ...fields, imovel_id: imovelId, origem: "declarada" } };
}
