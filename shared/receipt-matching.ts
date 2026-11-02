export type ReceiptFacts = {
  valor: number | null; moeda: string | null; data_pagamento: string | null;
  data_vencimento: string | null; pagador: string; recebedor: string; descricao: string;
  situacao: "realizado" | "agendado" | "desconhecido"; multiplas_transacoes: boolean;
};
export const receiptText = (v: unknown) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const text = (v: unknown) => typeof v === "string" ? v.trim().slice(0, 300) : "";
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : null;
export function normalizeReceiptFacts(raw: any): ReceiptFacts {
  return { valor: typeof raw?.valor === "number" && Number.isFinite(raw.valor) && raw.valor > 0 ? Math.round(raw.valor * 100) / 100 : null,
    moeda: raw?.moeda === "BRL" ? "BRL" : null, data_pagamento: date(raw?.data_pagamento), data_vencimento: date(raw?.data_vencimento),
    pagador: text(raw?.pagador), recebedor: text(raw?.recebedor), descricao: text(raw?.descricao),
    situacao: ["realizado", "agendado"].includes(raw?.situacao) ? raw.situacao : "desconhecido",
    multiplas_transacoes: raw?.multiplas_transacoes !== false };
}
export type ReceiptCandidate = { id: string; descricao: string; valor: number; tipo: string; status: string;
  data: string | null; pessoa: string; motivos: string[]; avisos?: string[]; automatico: boolean; fingerprint: string };
export function receiptFlowFingerprint(row: any): string {
  const rel = (v: any) => String(v?.id || v || "");
  return JSON.stringify([rel(row.bia), row.tipo, Number(row.valor), row.descricao || "", row.status || "",
    row.data_pagamento || "", row.data_vencimento || "", row.natureza || "caixa", rel(row.favorecido_id),
    row.favorecido_id?.nome || row.favorecido_id?.Nome_de_usuario || row.favorecido_id?.razao_social || ""]);
}

function receiptNameMatch(party: string, person: string) {
  const words = (value: string) => receiptText(value).split(" ").filter(word => word && !["de", "da", "do", "das", "dos", "e", "ltda", "limitada", "eireli", "sa", "me", "epp"].includes(word));
  const a = words(party), b = words(person);
  if (!a.length || !b.length) return 0;
  const fullMatches = a.filter(word => word.length > 1 && b.includes(word)).length;
  if (a.length >= 2 && a.join(" ") === b.join(" ")) return 3;
  const shorter = a.length <= b.length ? a : b, longer = a.length <= b.length ? b : a;
  const partial = shorter.every(word => longer.some(other => word === other
    || (word.length === 1 && other.startsWith(word)) || (other.length === 1 && word.startsWith(other))));
  if (shorter.length >= 2 && fullMatches > 0 && partial) return 2;
  return fullMatches > 0 ? 1 : 0;
}

export function matchReceipt(facts: ReceiptFacts, rows: any[], biaId: string) {
  const ranked: Array<{ candidate: ReceiptCandidate; score: number; valueMatches: boolean }> = [];
  for (const row of rows) {
    if (String(row.bia?.id || row.bia || "") !== biaId || !["entrada", "saida"].includes(row.tipo)
      || row.status === "cancelado" || (row.natureza && row.natureza !== "caixa") || row.descricao === "Valor de Origem da BIA") continue;
    const amount = Number(row.valor);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const receiptCents = facts.moeda === "BRL" && facts.valor !== null && Number.isFinite(facts.valor) && facts.valor > 0 ? Math.round(facts.valor * 100) : null;
    const differenceCents = receiptCents === null ? null : Math.abs(Math.round(amount * 100) - receiptCents);
    // A few reais may be fees/rounding, but a small payment must not match a much larger one.
    const valueMatches = differenceCents !== null && differenceCents <= Math.min(500, Math.floor(receiptCents! * 0.02));
    const exactValue = differenceCents === 0;
    const person = row.favorecido_id?.nome || row.favorecido_id?.Nome_de_usuario || row.favorecido_id?.razao_social || "";
    const party = row.tipo === "entrada" ? facts.pagador : facts.recebedor;
    const nameMatch = receiptNameMatch(party, person);
    const personMatches = nameMatch >= 2;
    // Payment day and due day have different meanings. Do not compare a payment to a due date.
    const dateDistances = (["data_pagamento", "data_vencimento"] as const).flatMap(field => {
      const documentDate = date(facts[field]), entryDate = date(String(row[field] || "").slice(0, 10));
      return documentDate && entryDate ? [Math.abs(Date.parse(documentDate) - Date.parse(entryDate)) / 86_400_000] : [];
    });
    const dateDistance = Math.min(...dateDistances);
    const dateMatches = dateDistance <= 3;
    const description = receiptText(row.descricao);
    const words = [...new Set(receiptText(facts.descricao).split(" ").filter(w => w.length >= 4 && !["pagamento", "comprovante", "transferencia", "realizado", "banco", "pix", "boleto"].includes(w)))];
    const descriptionMatches = words.length >= 2 && words.filter(w => description.split(" ").includes(w)).length >= 2;
    // A possible match may rely on value OR a partial name; weak evidence requires the user's choice.
    if (!valueMatches && nameMatch === 0 && !descriptionMatches) continue;
    const motivos = [valueMatches && (exactValue ? "Mesmo valor" : `Valor próximo (diferença de ${(differenceCents! / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`),
      nameMatch > 0 && (nameMatch === 3 ? "Mesmo pagador/recebedor" : nameMatch === 2 ? "Nome parcial/abreviado compatível" : "Parte do nome coincide"),
      dateMatches && (dateDistance === 0 ? "Mesma data" : `Data próxima (${dateDistance} dia${dateDistance === 1 ? "" : "s"} de diferença)`),
      descriptionMatches && "Descrição compatível"].filter(Boolean) as string[];
    const score = (exactValue ? 4 : valueMatches ? 3 : 0) + nameMatch + (dateDistance === 0 ? 2 : dateMatches ? 1 : 0) + (descriptionMatches ? 2 : 0);
    const support = Number(personMatches) + Number(dateMatches) + Number(descriptionMatches);
    // Missing fields can be compensated; explicit conflicts cannot be cleared by other matches.
    const conflictingPerson = !!receiptText(party) && !!receiptText(person) && !personMatches;
    const conflictingDate = dateDistances.length > 0 && !dateMatches;
    const avisos = [
      facts.valor === null && "Valor do comprovante não identificado.",
      differenceCents !== null && !valueMatches && `Valor diferente (diferença de ${(differenceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
      !receiptText(party) && `${row.tipo === "entrada" ? "Pagador" : "Recebedor"} não identificado no comprovante.`,
      !receiptText(person) && "Favorecido não informado no lançamento.",
      conflictingPerson && (nameMatch === 0 ? "Nome do comprovante diferente do favorecido cadastrado." : "Nome incompleto ou apenas parcialmente compatível."),
      conflictingDate && `Datas com ${dateDistance} dias de diferença.`,
    ].filter(Boolean) as string[];
    const candidate: ReceiptCandidate = { id: String(row.id), descricao: row.descricao || "Lançamento", valor: amount, tipo: row.tipo,
      status: row.status || "pendente", data: row.data_pagamento || row.data_vencimento || null, pessoa: person,
      motivos, avisos, automatico: valueMatches && support >= 2 && score >= 8 && !conflictingPerson && !conflictingDate
        && !facts.multiplas_transacoes && facts.situacao === "realizado",
      fingerprint: receiptFlowFingerprint(row) };
    ranked.push({ candidate, score, valueMatches });
  }
  ranked.sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  const candidates = ranked.map(item => item.candidate);
  // Repeated or nearby amounts still require review, even if one description looks better.
  const sameAmount = ranked.filter(item => item.valueMatches);
  const automatic = candidates.filter(c => c.automatico);
  return { candidates: candidates.slice(0, 20), automaticId: automatic.length === 1 && sameAmount.length === 1 ? automatic[0].id : null };
}
