import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { ContributionBilling } from './contribution-billing';
import { INITIAL_CONTRIBUTIONS_SQL } from './initial-contributions';
import { protectContributionFlow } from './contribution-flow-protection';
import { cashContributionProblem } from '../shared/contribution-billing';
import { ContributionProvider } from './contribution-billing-provider';

test('aporte avulso: migração idempotente, vínculo único, autorização, duas opções e uma baixa',async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  await pg.exec('CREATE TABLE bia_map_inicial_snapshots(bia_id text PRIMARY KEY);'+INITIAL_CONTRIBUTIONS_SQL);
  await pg.exec(readFileSync('migrations/20261019_contribution_billing.sql','utf8'));
  const entry:any={id:'flow',bia:'bia',tipo:'entrada',valor:10,status:'pendente',favorecido_id:'payer',data_vencimento:'2031-01-10'};
  let creates=0,paid=false,fail=false;
  const provider:any={verifyAccount:async()=>{},findCustomer:async()=>({id:'customer'}),muteCustomer:async()=>{},findPayment:async()=>creates?{id:'payment'}:null,
    create:async(_c:any,_r:any,_a:any,_d:any,type:any)=>{assert.equal(type,'BOLETO');creates++;if(fail){fail=false;throw new Error('response lost');}return{id:'payment'};},read:async()=>({id:'payment'}),
    snapshot:async()=>({externalId:'payment',amount:1000,state:paid?'received':'open',dueDate:'2031-01-10',paidAt:paid?'2031-01-10':null,details:paid?{}:{pix:'pix-test',qrImage:'aGVsbG8=',barcode:'12345',bankSlipUrl:'https://sandbox.asaas.com/b/test'}})};
  const service=new ContributionBilling({db,lock:async(_id,fn)=>db.transaction(tx=>fn(tx,{})),enabled:()=>true,entries:async id=>id==='bia'?[entry]:[],bia:async()=>({situacao:'em_execucao',moeda:'BRL'}),member:async id=>({id,nome:'Teste',cpf:'12345678901'}),updateFlow:async(_id,patch)=>Object.assign(entry,patch),userForMember:async()=>null,sendNotice:async()=>({ok:true}),provider:()=>provider});
  (service as any).account=async()=>({id:'00000000-0000-4000-8000-000000000001',external_account_id:'account'});
  try{
    await assert.rejects(()=>service.enqueueFlow('bia','flow'),/migração/);
    const migration=readFileSync('migrations/20261027_contribution_flow_charges.sql','utf8');await pg.exec(migration);await pg.exec(migration);
    await pg.exec('CREATE TABLE agenda_tarefas(status text, atualizado_em timestamp, contexto_tipo text, origem_tarefa_id text);');
    await assert.rejects(()=>service.enqueueFlow('other','flow'),/não encontrado/);
    const first=await service.enqueueFlow('bia','flow');assert.equal((await service.enqueueFlow('bia','flow')).id,first.id);
    assert.equal((await db.execute(sql`SELECT count(*)::int n FROM bia_contribution_charges`)).rows[0].n,1);
    await assert.rejects(()=>service.flowPayment('bia','flow',false,'other'),/restrito/);
    await db.execute(sql`UPDATE bia_contribution_charges SET job_state='blocked',error_code='PAYER_PENDING' WHERE id=${first.id}`);
    const originalMember=service.deps.member;
    service.deps.member=async()=>({nome:'Teste',cpf:'1'});
    assert.equal((await service.flowPayment('bia','flow',false,'payer')).correction?.href,'/meu-perfil?campo=cpf');
    assert.equal((await service.flowPayment('bia','flow',true,'manager')).correction,null);
    assert.match((await service.flowPayment('bia','flow',true,'admin',{canEditPayers:true})).correction!.href,/editar=payer/);
    service.deps.member=originalMember;
    await assert.rejects(()=>protectContributionFlow(db,'flow',null),/cobrança/);
    await assert.rejects(()=>protectContributionFlow(db,'flow',{valor:20}),/cobrança/);
    await protectContributionFlow(db,'flow',{descricao:'nota'});
    fail=true;await service.processCharge(first.id);assert.equal(creates,1);
    await service.processCharge(first.id);assert.equal(creates,1);
    const view=await service.flowPayment('bia','flow',false,'payer');assert.equal(view.details.pix,'pix-test');assert.equal(view.details.barcode,'12345');assert.equal(view.paymentState,'open');
    paid=true;await service.webhook({payment:{id:'payment'},account:{id:'account'}});await service.processCharge(first.id);
    assert.equal(entry.status,'pago');assert.equal(entry.pagamento_id,'payment');assert.equal(creates,1);
    assert.equal((await service.flowPayment('bia','flow',false,'payer')).details,null);
  }finally{await pg.close();}
});

test('elegibilidade exclui saídas, não caixa, pagos, parciais e valores inválidos',()=>{
  const row={tipo:'entrada',status:'pendente',valor:10,favorecido_id:'payer',data_vencimento:'2031-01-10'};
  assert.equal(cashContributionProblem(row),null);
  for(const patch of [{tipo:'saida'},{natureza:'nao_caixa'},{conciliacao_pendente:true},{status:'pago'},{status:'parcial'},{valor:0},{valor:NaN},{favorecido_id:null},{data_vencimento:'2031-02-31'},{pagamento_id:'external'}])assert.ok(cashContributionProblem({...row,...patch}));
});

test('provedor recupera boleto e Pix do mesmo ID e explicita Pix ausente',async()=>{
  let unavailable=false;const paths:string[]=[];
  const provider=new ContributionProvider({request:async(path:string)=>{paths.push(path);if(path.endsWith('identificationField'))return{identificationField:'12345'};if(unavailable)throw Error('Pix unavailable');return{payload:'pix',encodedImage:'aGVsbG8='};}} as any);
  const p={id:'pay1',billingType:'BOLETO',externalReference:'same',value:10,status:'PENDING',dueDate:'2031-01-10'};
  const result=await provider.snapshot(p,'same');assert.equal(result.details.pix,'pix');assert.equal(result.details.barcode,'12345');
  assert.deepEqual(paths,['/payments/pay1/identificationField','/payments/pay1/pixQrCode']);
  unavailable=true;assert.equal((await provider.snapshot(p,'same')).details.pixUnavailable,true);
});
