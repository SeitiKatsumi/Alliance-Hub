export type ExpenseSplit = { memberId: string; value?: number };
export type ExpenseSplitMode = "equal" | "map" | "manual";

/** New contributions inherit payment state only at creation; persisted lots are immutable on retry. */
export function inheritedExpensePayment(expense: { status: string; data_pagamento: string | null }) {
  if (expense.status === "pago" && !expense.data_pagamento) throw new Error("Informe a data do pagamento da despesa.");
  return { status: expense.status, data_pagamento: expense.data_pagamento };
}

export function inheritedExpenseSplit(amount: number, mode: "percentual" | "valor", participants: ExpenseSplit[]) {
  if (mode === "valor") return splitExpense(amount, "manual", participants);
  const sum = participants.reduce((n, p) => n + Number(p.value), 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 100) > 0.011) throw new Error("O rateio da saída deve totalizar 100%.");
  return splitExpense(amount, "map", participants, participants.map(p => ({ memberId: p.memberId, percent: Number(p.value) })));
}

export function splitExpense(amount: number, mode: ExpenseSplitMode, participants: ExpenseSplit[], map: { memberId: string; percent: number }[] = []) {
  const total = Math.round(amount * 100);
  if (!Number.isSafeInteger(total) || total <= 0 || Math.abs(amount * 100 - total) > 0.00001) throw new Error("Informe um valor positivo com até duas casas decimais.");
  if (!participants.length || participants.length > 100 || participants.some(p => !p.memberId || p.memberId === "__none__")) throw new Error("Selecione de 1 a 100 participantes.");
  if (new Set(participants.map(p => p.memberId)).size !== participants.length) throw new Error("Não repita participantes.");
  const ordered = [...participants].sort((a, b) => a.memberId.localeCompare(b.memberId, "en"));
  let cents: number[];
  if (mode === "manual") {
    cents = ordered.map(p => {
      const value = Number(p.value), n = Math.round(value * 100);
      if (!Number.isSafeInteger(n) || n <= 0 || Math.abs(value * 100 - n) > 0.00001) throw new Error("Informe valores positivos com até duas casas decimais.");
      return n;
    });
    if (cents.reduce((a, b) => a + b, 0) !== total) throw new Error("A soma dos aportes deve ser igual à despesa.");
  } else {
    if (mode !== "equal" && mode !== "map") throw new Error("Rateio inválido.");
    const weights = ordered.map(p => mode === "equal" ? 1 : map.find(m => m.memberId === p.memberId)?.percent || 0);
    if (weights.some(w => !Number.isFinite(w) || w <= 0)) throw new Error("Participante sem percentual válido no MAP atual.");
    const weightTotal = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map(w => total * w / weightTotal);
    cents = exact.map(Math.floor);
    let remainder = total - cents.reduce((a, b) => a + b, 0);
    const priority = exact.map((n, i) => ({ i, fraction: n - cents[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const { i } of priority) { if (remainder-- <= 0) break; cents[i]++; }
    if (cents.some(n => n <= 0)) throw new Error("O valor não permite um aporte de pelo menos um centavo por participante.");
  }
  return ordered.map((p, i) => ({ memberId: p.memberId, amount: cents[i] / 100 }));
}
