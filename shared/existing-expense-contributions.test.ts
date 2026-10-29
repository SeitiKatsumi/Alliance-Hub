import test from 'node:test';
import assert from 'node:assert/strict';
import { expensePercent, initialExpenseDistribution, existingExpenseProblem, previewExistingExpense } from './existing-expense-contributions';
import { reconcileValorOrigemEntries } from '../server/valor-origem-sync';

test('existing expense: manual amounts, percentages and MAP preserve cents and reject invalid splits', () => {
  const people = [{ memberId: 'a', value: 33.33 }, { memberId: 'b', value: 33.33 }, { memberId: 'c', value: 33.34 }];
  for (const unit of ['valor', 'percentual'] as const) assert.deepEqual(previewExistingExpense(100, 'manual', unit, people, []).map(p => p.amount), [33.33, 33.33, 33.34]);
  assert.deepEqual(previewExistingExpense(100, 'map', 'valor', people, people.map(p => ({ memberId: p.memberId, percent: 1 }))).map(p => p.amount), [33.34, 33.33, 33.33]);
  for (const invalid of [[], [{ memberId: 'a', value: 90 }], [{ memberId: 'a', value: 50 }, { memberId: 'a', value: 50 }], [{ memberId: 'a', value: NaN }]])
    assert.throws(() => previewExistingExpense(100, 'manual', 'valor', invalid, []));
  assert.throws(() => previewExistingExpense(100, 'map', 'valor', people.slice(0, 2), people.map(p => ({ memberId: p.memberId, percent: 1 }))));
  for (const status of ['pago', 'parcial', 'cancelado']) assert.ok(existingExpenseProblem({ tipo: 'saida', valor: 100, status }));
  for (const status of ['pendente', 'agendado', 'vencido']) assert.equal(existingExpenseProblem({ tipo: 'saida', valor: 100, status }), null);
});
test('origin resync preserves both original unpaid installment and its generated contributions', () => {
  const source = { id: 'out', tipo: 'saida', descricao: 'Valor de Origem da BIA - Parcela 1/1', status: 'agendado', valor: 100, aportes_vinculados: true };
  const contribution = { id: 'in', tipo: 'entrada', descricao: 'Aporte para: Valor de Origem da BIA - Parcela 1/1', status: 'agendado', valor: 100, aportes_vinculados: true };
  const result = reconcileValorOrigemEntries([source, contribution], [{ ...source, valor: 500 }]);
  assert.deepEqual(result.preserved.map(r => r.id), ['out', 'in']);
  assert.equal(result.replaceable.length, 0); assert.equal(result.toCreate.length, 0);
});

test('initial expense MAP uses the saved initial percentages or legacy origin, never current contributions', () => {
  const rows = initialExpenseDistribution({ participantes: [{ memberId: 'a', mapPercentual: 40 }, { memberId: 'b', mapPercentual: 60 }] });
  assert.deepEqual(rows.map(r => r.percent), [40, 60]);
  assert.deepEqual(previewExistingExpense(100, 'map_initial', 'percentual', rows, rows).map(r => r.amount), [40, 60]);
  assert.deepEqual(initialExpenseDistribution(null, [{ membro_id: 'a', nome: 'A', valor: 25 }, { membro_id: 'b', nome: 'B', valor: 75 }]).map(r => r.percent).sort((a,b) => a-b), [25, 75]);
  assert.deepEqual(initialExpenseDistribution(null), []);
  assert.throws(() => initialExpenseDistribution({ participantes: [{ memberId: 'a' }] }));
  assert.equal(expensePercent(10.00004), '10');
  assert.equal(expensePercent(9.9997), '10');
  assert.equal(expensePercent(33.333333), '33,33');
  const exact = previewExistingExpense(14597.84, 'map_initial', 'percentual', rows, rows);
  assert.equal(exact.reduce((n, r) => n + Math.round(r.amount * 100), 0), 1459784);
});
