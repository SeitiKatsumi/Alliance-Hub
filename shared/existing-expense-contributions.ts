import { inheritedExpenseSplit, splitExpense, type ExpenseSplit } from './expense-contributions';
import { isCashEntry } from './initial-contributions';

export type ExistingExpenseMode = 'manual' | 'map';
export type ExistingExpenseUnit = 'valor' | 'percentual';
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
    throw new Error('Use todos os participantes com percentual positivo no MAP atual ou escolha a divisão manual.');
  return splitExpense(amount, 'map', participants, eligible);
}
