import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {sql} from 'drizzle-orm';
import {ContributionBilling} from './contribution-billing';
import {INITIAL_CONTRIBUTIONS_SQL} from './initial-contributions';
import {protectContributionFlow} from './contribution-flow-protection';

test('cancelamento libera lançamento somente após confirmação, preserva histórico e não reemite',async()=>{
 const pg=new PGlite(),db=drizzle(pg);let calls=0,remote:any=null;
 await pg.exec('CREATE TABLE bia_map_inicial_snapshots(bia_id text PRIMARY KEY);'+INITIAL_CONTRIBUTIONS_SQL);
 for(const file of ['20261019_contribution_billing.sql','20261027_contribution_flow_charges.sql'])await pg.exec(readFileSync('migrations/'+file,'utf8'));
 const entry:any={id:'flow',tipo:'entrada',valor:10,status:'agendado',favorecido_id:'payer',data_vencimento:'2031-01-10'};
 const provider:any={verifyAccount:async()=>{},read:async()=>({...remote}),findPayment:async()=>remote,cancel:async()=>{calls++;remote.deleted=true;}};
 const service=new ContributionBilling({db,lock:async(_id,fn)=>db.transaction(tx=>fn(tx,{})),entries:async()=>[entry],bia:async()=>({situacao:'em_execucao',moeda:'BRL'}),member:async()=>({id:'payer'}),updateFlow:async(_id,patch)=>Object.assign(entry,patch),enabled:()=>true,provider:()=>provider,userForMember:async()=>null,sendNotice:async()=>({ok:true})});
 (service as any).account=async()=>({id:'00000000-0000-4000-8000-000000000001',external_account_id:'account'});
 try{
  const first=await service.enqueueFlow('bia','flow');
  await protectContributionFlow(db,'flow',{...entry,descricao:'editada'},entry);
  await protectContributionFlow(db,'flow',{valor:10,bia:'bia',data_vencimento:'2031-01-10'},{...entry,valor:'10.00',bia:{id:'bia'},data_vencimento:'2031-01-10T00:00:00Z'});
  await assert.rejects(()=>protectContributionFlow(db,'flow',{valor:11},entry),/cobrança/);
  await service.cancelFlow('bia','flow','manager',first.id);assert.equal(calls,0);
  await protectContributionFlow(db,'flow',null);await protectContributionFlow(db,'flow',{valor:12},entry);
  await service.processCharge(first.id);assert.equal(calls,0);
  await service.cancelFlow('bia','flow','manager',first.id);
  const second=await service.enqueueFlow('bia','flow');assert.notEqual(second.id,first.id);
  const old=(await db.execute(sql`SELECT * FROM bia_contribution_charges WHERE id=${first.id}`)).rows[0];assert.equal(old.payment_state,'cancelled');assert.equal(old.details.cancelledBy,'manager');assert.equal(old.details.originalFlowId,'flow');
  await db.execute(sql`UPDATE bia_contribution_charges SET job_state='creating' WHERE id=${second.id}`);
  await assert.rejects(()=>service.cancelFlow('bia','flow','manager',second.id),/andamento/);
  await db.execute(sql`UPDATE bia_contribution_charges SET job_state='unknown',error_code='CREATE_UNKNOWN' WHERE id=${second.id}`);
  await assert.rejects(()=>service.cancelFlow('bia','flow','manager',second.id),/desconhecido/);
  remote={id:'remote',externalReference:`built:contribution:${service.environment}:${second.id}`,status:'RECEIVED',deleted:false};
  await assert.rejects(()=>service.cancelFlow('bia','flow','manager',second.id),/confirmou/);assert.equal(calls,0);
  remote.status='PENDING';
  await db.execute(sql`UPDATE bia_contribution_charges SET external_id='remote',payment_state='open' WHERE id=${second.id}`);
  entry.pagamento_id='remote';entry.pagamento_provider='asaas_contributions';
  let lost=true;provider.cancel=async()=>{calls++;remote.deleted=true;if(lost){lost=false;throw Error('response lost');}};
  await assert.rejects(()=>service.cancelFlow('bia','flow','manager',second.id),/response lost/);
  await assert.rejects(()=>protectContributionFlow(db,'flow',null),/cobrança/);
  await service.cancelFlow('bia','flow','manager',second.id);assert.equal(calls,1);assert.equal(entry.pagamento_id,null);
  await protectContributionFlow(db,'flow',null);
  await service.processCharge(second.id);assert.equal(calls,1);
  await assert.rejects(()=>service.cancelFlow('other','flow','manager',second.id),/alterada/);
 }finally{await pg.close();}
});
