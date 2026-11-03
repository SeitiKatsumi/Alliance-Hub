import test from 'node:test';
import assert from 'node:assert/strict';
import {paidMemberCapital,type DashboardCapitalEntry} from './dashboard-capital';
import {calculateMap} from './member-portfolio';
import {buildBiaThesisAllocation} from './bia-business-type';

const entry=(patch:Partial<DashboardCapitalEntry>={}):DashboardCapitalEntry=>({bia:'b',favorecido_id:'me',tipo:'entrada',status:'pago',valor:100,...patch});

test('capital alocado e seu percentual usam somente aportes pagos, sem compromissos em aberto',()=>{
 const rows=[entry({id:'own'}),entry({id:'other',favorecido_id:{id:'other'},valor:300}),
   ...['agendado','pendente','vencido','cancelado','',undefined].map((status,index)=>entry({id:`open-${index}`,status,valor:1000})),
   entry({id:'other-open',favorecido_id:'other',status:'pendente',valor:2000})];
 assert.deepEqual(paidMemberCapital(rows,'me',['b']).get('b'),{invested:100,received:0,sharePercent:25});
 const pending=entry({id:'new',status:'pendente',valor:200});
 assert.equal(paidMemberCapital([...rows,pending],'me',['b']).get('b')?.invested,100);
 pending.status='pago';assert.equal(paidMemberCapital([...rows,pending],'me',['b']).get('b')?.invested,300);
 pending.status='cancelado';assert.equal(paidMemberCapital([...rows,pending],'me',['b']).get('b')?.invested,100);
});

test('capital financeiro não presume caixa para direitos iniciais, origem agregada ou conciliação pendente',()=>{
 const rows=[entry({finalidade:'integralizacao_inicial',natureza:'caixa'} as any),
   entry({natureza:'nao_caixa',valor:900}),entry({conciliacao_pendente:true,valor:900}),
   entry({parcela_vigente:false,valor:900}),entry({descricao:'Valor de Origem da BIA',valor:900})];
 assert.equal(paidMemberCapital(rows,'me',['b']).get('b')?.invested,100);
 const map=calculateMap([{memberId:'me',value:100,status:'pago'}],[],[{memberId:'me',value:80}]);
 assert.equal(map[0].value,180); // Participation rights need not equal the nominal cash paid.
});

test('recebimentos do comparativo também exigem pago e não são descontados do capital bruto aportado',()=>{
 const rows=[entry(),entry({tipo:'saida',valor:20}),entry({tipo:'saída',valor:5}),
   entry({tipo:'saida',status:'agendado',valor:900}),entry({tipo:'saida',favorecido_id:'other',valor:300})];
 assert.deepEqual(paidMemberCapital(rows,'me',['b']).get('b'),{invested:100,received:25,sharePercent:100});
});

test('base paga preserva centavos, não duplica IDs nem mistura membros ou BIAs fora do escopo',()=>{
 const rows=[entry({id:'a',bia:{id:'b'},valor:'0.10'}),entry({id:'c',valor:'0.20'}),entry({id:'a',valor:'0.10'}),
   entry({bia:'other-bia',valor:999}),entry({favorecido_id:null,valor:999}),
   ...[null,NaN,Infinity,-1,'inválido'].map(valor=>entry({valor}))];
 assert.deepEqual(paidMemberCapital(rows,'me',['b']).get('b'),{invested:0.3,received:0,sharePercent:100});
 assert.equal(paidMemberCapital(rows,'me',[]).size,0);
 assert.equal(paidMemberCapital([entry({status:'agendado'})],'me',['b']).size,0);
});

test('distribuição por tese usa o mesmo capital pago e não a CPP ou os valores ainda prometidos',()=>{
 const capital=paidMemberCapital([entry(),entry({bia:'second',valor:300}),entry({bia:'second',status:'pendente',valor:5000})],'me',['b','second']);
 const distribution=buildBiaThesisAllocation([{business_type_code:'SHORT_STAY',invested:capital.get('b')!.invested},{business_type_code:'BUY_AND_HOLD',invested:capital.get('second')!.invested}]);
 assert.equal(distribution.reduce((sum,row)=>sum+row.value,0),400);
 assert.deepEqual(distribution.map(row=>row.percent),[75,25]);
});
