/** The receipt operator and the contributor are different identities. */
export function confirmsContributionReceipt(before: { tipo?: string | null; status?: string | null }, patch: { status?: string | null }) {
  return before.tipo === "entrada" && before.status !== "pago" && patch.status === "pago";
}

export function relatedContributionIds(lot: { movimentos: any[] }, flowId: string): string[] {
  const current = lot.movimentos.find(m => String(m.id) === flowId);
  if (!current || current.tipo !== "entrada") throw new Error("Selecione um aporte vinculado à despesa.");
  const expenseId = current.despesa_origem_id || lot.movimentos.find(m => m.tipo === "saida")?.id;
  if (!expenseId) throw new Error("Despesa de origem indisponível.");
  const paired = lot.movimentos.some(m => m.despesa_origem_id);
  return [...new Set<string>(lot.movimentos.filter(m => m.tipo === "entrada" && (!paired || m.despesa_origem_id === expenseId)).map(m => String(m.id)))];
}
