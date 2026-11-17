import assert from 'node:assert/strict';
import test from 'node:test';
import { guestDashboard } from './oba-guest-dashboard';

const payment = { id:'1', descricao:'Aporte', valor:10.01, status:'pago', pagoEm:'2026-10-02', vencimento:null, pagamentoUrl:null, arquivos:[] };
test('Painel separa cotas iniciais, aportes registrados e histórico por data efetiva', () => {
  const view = guestDashboard([payment, {...payment,id:'2',valor:0.02},
    {...payment,id:'3',valor:5,pagoEm:'2026-11-01'},
    {...payment,id:'4',valor:2,pagoEm:null,vencimento:'2026-09-01'},
    {...payment,id:'5',valor:4,status:'agendado',pagoEm:null,vencimento:null},
    {...payment,id:'6',valor:8,status:'agendado',pagoEm:null,vencimento:'2026-12-01'}], 2, 10);
  assert.deepEqual(view.monthly,[{month:'2026-10',value:10.03},{month:'2026-11',value:5}]);
  assert.equal(view.pago,17.03); assert.equal(view.aPagar,12); assert.equal(view.total,29.03);
  assert.equal(view.undatedPaid,1); assert.equal(view.next?.id,'6'); assert.equal(view.quotaPercent,20);
  assert.ok(Math.abs(view.paidPercent! - 17.03/29.03*100)<0.00001);
});
test('Ausência de dados não inventa percentuais, cronograma ou progresso', () => {
  const empty = guestDashboard([],0,0);
  assert.equal(empty.paidPercent,null); assert.equal(empty.quotaPercent,null); assert.equal(empty.next,null);
  assert.deepEqual(empty.monthly,[]);
  const invalid = guestDashboard([{...payment,pagoEm:'2026-02-31'}],11,10);
  assert.equal(invalid.undatedPaid,1); assert.deepEqual(invalid.monthly,[]); assert.equal(invalid.quotaPercent,null);
});
