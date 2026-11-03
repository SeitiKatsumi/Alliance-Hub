import test from 'node:test';
import assert from 'node:assert/strict';
import { BIA_TRACKING_FIELDS, parseTrackingValues, parseTrackingChanges, sameTrackingValues, type BiaThesis } from './bia-tracking';
import { STRATEGIC_CELL_BUSINESS_TYPES } from './strategic-cells';
import { biaCardIndicators } from './bia-card-indicators';

test('all theses accept their selectable stages and reject fields or options from another thesis', () => {
  assert.equal(Object.keys(BIA_TRACKING_FIELDS).length, 13);
  for (const [, code] of STRATEGIC_CELL_BUSINESS_TYPES) {
    assert.deepEqual(parseTrackingValues(code, {}), {});
    for (const field of BIA_TRACKING_FIELDS[code]) if (field.kind === 'select') {
      for (const value of field.options!) assert.equal(parseTrackingValues(code, { [field.key]: value })[field.key], value);
      assert.throws(() => parseTrackingValues(code, { [field.key]: 'Inventado' }));
    }
    assert.throws(() => parseTrackingValues(code, { secret: 'unexpected' }));
  }
  assert.throws(() => parseTrackingChanges({ Venda: {} }));
});

const card = (code: BiaThesis, values: any) => biaCardIndicators({ business_type_code: code, acompanhamento: { revision: 1, byThesis: { [code]: parseTrackingValues(code, values) } } });
test('PostgreSQL JSONB field order does not turn a lost-response retry into a conflict', () => {
  assert.equal(sameTrackingValues({period:'2026-11',occupiedNights:15,revenue:4500}, {revenue:4500,period:'2026-11',occupiedNights:15}), true);
  assert.equal(sameTrackingValues({occupiedNights:15}, {occupiedNights:20}), false);
  assert.equal(sameTrackingValues({occupiedNights:0}, {}), false);
});
test('occupied unit-nights calculate percentage for the stated month, zero is not missing', () => {
  for (const code of ['SHORT_STAY', 'HOSPITALITY_OPERATION'] as BiaThesis[]) {
    const result = card(code, { period: '2026-11', availableNights: 60, occupiedNights: 30, revenue: 5000 });
    assert.equal(result.metrics[0].value, 50); assert.equal(result.metrics[1].value, null); assert.equal(result.period, '2026-11');
    assert.equal(card(code, { period: '2026-11', availableNights: 0, occupiedNights: 0, revenue: 0 }).metrics[0].value, null);
    assert.equal(card(code, { period: '2026-11', availableNights: 60, occupiedNights: 0, revenue: 0 }).metrics[0].value, 0);
    assert.throws(() => card(code, { period: '2026-11', availableNights: 10, occupiedNights: 11 }));
    assert.throws(() => card(code, { revenue: 100 }));
    assert.throws(() => card(code, { period: '2026-13', revenue: 100 }));
  }
});
test('valuation can decrease; zero baseline never fabricates a percentage and estimate has a date', () => {
  assert.equal(card('APPRECIATION_HOLD', { currentValue: 900, referenceValue: 1000, valuationDate: '2026-11-03' }).metrics[1].value, null);
  assert.equal(card('APPRECIATION_HOLD', { currentValue: 900, referenceValue: 0, valuationDate: '2026-11-03' }).metrics[1].value, null);
  assert.throws(() => card('APPRECIATION_HOLD', { currentValue: 900 }));
  assert.throws(() => card('APPRECIATION_HOLD', { currentValue: 900, valuationDate: '2026-02-30' }));
});
test('rental units preserve totals, money remains numeric and losses remain signed', () => {
  assert.equal(card('BUILD_TO_RENT', { stage: 'Concluída', rentedUnits: 4, totalUnits: 10 }).metrics[1].value, '4 de 10');
  assert.throws(() => card('BUILD_TO_RENT', { rentedUnits: 11, totalUnits: 10 }));
  assert.throws(() => card('BUILD_TO_RENT', { rentedUnits: 1.2 }));
  assert.equal(card('OPERATION_RESTRUCTURING', { period: '2026-11', operatingResult: -100.25 }).metrics[1].value, null);
  for (const invalid of [-1, Infinity, NaN, true, '123']) assert.throws(() => card('BUY_AND_HOLD', { monthlyRent: invalid }));
  assert.equal(card('BUY_AND_HOLD', { rentalStatus: 'Alugado', monthlyRent: 0 }).metrics[1].value, null);
});
test('thesis switching uses only its own data; sales retain the existing financial source', () => {
  const bia = { business_type_code: 'FLIPPING', valor_realizado_venda: 123.45, acompanhamento: { revision: 2, byThesis: { FLIPPING: { stage: 'Concluída' }, SHORT_STAY: { period: '2026-11', availableNights: 30, occupiedNights: 15, revenue: 900 } } } };
  assert.deepEqual(biaCardIndicators(bia).metrics.map(m => m.value), ['Concluída', null]);
  assert.deepEqual(biaCardIndicators({ ...bia, business_type_code: 'SHORT_STAY' }).metrics.map(m => m.value), [50, null]);
  assert.deepEqual(biaCardIndicators({ ...bia, business_type_code: 'BUY_AND_HOLD' }).metrics.map(m => m.value), [null, null]);
});
