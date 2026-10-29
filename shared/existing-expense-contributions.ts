import { inheritedExpenseSplit, splitExpense, type ExpenseSplit } from './expense-contributions';
import { isCashEntry } from './initial-contributions';
import { calculateMap } from './member-portfolio';

export type ExistingExpenseMode = 'manual' | 'map' | 'map_initial';
export type ExistingExpenseUnit = 'valor' | 'percentual';
export const expensePercent = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export function initialExpenseDistribution(snapshot: any, legacy: { membro_id: string; nome: string; valor: number }[] = []) {
  const rows = snapshot
    ? (snapshot.participantes || []).map((p: any) => ({ memberId: String(p.memberId || p.participantId || ''), percent: Number(p.mapPercentual) }))
    : calculateMap([], [], legacy.map(p => ({ memberId: p.membro_id, name: p.nome, value: Number(p.valor) })), true).map(p => ({ memberId: p.memberId, percent: p.percent }));
  if (rows.some((p: any) => !p.memberId || !Number.isFinite(p.percent) || p.percent < 0) || new Set(rows.map((p: any) => p.memberId)).size !== rows.length)
    throw new Error('MAP inicial inválido. Confira a composição inicial da BIA.');
  return rows.filter((p: any) => p.percent > 0) as { memberId: string; percent: number }[];
}
export function existingExpenseProblem(entry: any): string | null {
  if (entry.tipo !== 'saida') return 'Somente saídas podem gerar aportes para uma despesa existente.';
  if (!isCashEntry(entry)) return 'Esta despesa não representa uma saída em dinheiro.';
  if (!['pendente', 'agendado', 'vencido'].includes(entry.status) || entry.data_pagamento)
    return 'Gerar aportes está disponível para despesas pendentes, agendadas ou vencidas, sem pagamento registrado.';
  if (!Number.isFinite(Number(entry.valor)) || Number(entry.valor) <= 0) return 'Informe um valor positivo para a despesa.';
  return null;
}
export function previewExistingExpense(amount: number, mode: ExistingExpenseMode, unit: ExistingExpenseUnit,
  participants: ExpenseSplit[], map: { memberId: string; percent: number }[]) {
  if (mode === 'manual') return inheritedExpenseSplit(amount, unit, participants);
  const eligible = map.filter(row => row.percent > 0);
  if (!eligible.length || eligible.length !== participants.length || eligible.some(row => !participants.some(p => p.memberId === row.memberId)))
    throw new Error(`Use todos os participantes com percentual positivo no MAP ${mode === 'map_initial' ? 'inicial' : 'atual'} ou escolha a divisão manual.`);
  return splitExpense(amount, 'map', participants, eligible);
}
