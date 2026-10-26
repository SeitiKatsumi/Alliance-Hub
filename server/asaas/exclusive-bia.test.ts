import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {AsaasStore} from './store';
import {AsaasAccountOperations} from './operations';
import {asaasConfig} from './config';
import {ContributionBilling} from '../contribution-billing';
import {encryptCredential} from './credentials';

const migration=(name:string)=>readFileSync(`migrations/${name}.sql`,'utf8');
const foundation=migration('20261014_asaas_foundation')+migration('20261020_asaas_sandbox_subaccounts');
const exclusive=migration('20261028_asaas_exclusive_bia');

test('duas BIAs consultam saldos e cobranças separados pela credencial da própria subconta',async()=>{
 const pg=new PGlite();try{
  await pg.exec(foundation+exclusive);const store=new AsaasStore(drizzle(pg),'sandbox');
  const key=Buffer.alloc(32,8).toString('base64');
  for(const bia of ['a','b']){
   const draft=await store.createAccountDraft('owner-'+bia,'BIA '+bia);
   await store.saveCreatedAccount({biaId:bia,accountId:draft.id,label:bia,externalAccountId:'external-'+bia,walletId:'wallet-'+bia,credential:encryptCredential('key-'+bia,key),state:'approved'});
  }
  const config=asaasConfig({ASAAS_BASE_ENABLED:'true',ASAAS_BAAS_ENABLED:'true',ASAAS_SANDBOX_CREDENTIAL_ENCRYPTION_KEY:key});
  const service=new AsaasAccountOperations(store,config,c=>({request:async path=>{
   const a=c.apiKey==='key-a';assert.ok(a||c.apiKey==='key-b');
   if(path==='/finance/balance')return{balance:a?123:456};
   if(path.startsWith('/payments'))return{data:[{id:a?'payment-a':'payment-b',status:'RECEIVED',value:a?10:20,dateCreated:'2026-10-01'}],hasMore:false,totalCount:1};
   return{data:[],hasMore:false,totalCount:0};
  }}));
  const a=await service.dashboard('a','all'),b=await service.dashboard('b','all');
  assert.equal(a.scope,'bia_account');assert.equal(a.balance,123);assert.equal(b.balance,456);
  assert.deepEqual(a.payments.items.map(p=>p.id),['payment-a']);assert.deepEqual(b.payments.items.map(p=>p.id),['payment-b']);
 }finally{await pg.close();}
});

test('exclusividade bloqueia concorrência e SQL direto nos dois ambientes sem alterar vínculos',async()=>{
 const pg=new PGlite();try{
  await pg.exec(foundation);await pg.exec(exclusive);await pg.exec(exclusive);
  for(const env of ['sandbox','production'] as const){
   const store=new AsaasStore(drizzle(pg),env),id=randomUUID();
   await pg.query(`INSERT INTO asaas_${env}.accounts(id,label,ownership,state) VALUES($1,'Teste','company','approved')`,[id]);
   const outcomes=await Promise.allSettled([store.linkAccount('bia-a',id),store.linkAccount('bia-b',id)]);
   assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
   await assert.rejects(()=>pg.query(`INSERT INTO asaas_${env}.bia_accounts(bia_id,account_id) VALUES('bia-c',$1)`,[id]));
   assert.equal((await pg.query(`SELECT count(*)::int AS n FROM asaas_${env}.bia_accounts`)).rows[0].n,1);
  }
 }finally{await pg.close();}
});

test('compartilhamento legado bloqueia saldo, transferências e cobrança antes de acessar o provedor',async()=>{
 const pg=new PGlite();try{
  await pg.exec(foundation);const id=randomUUID(),db=drizzle(pg),store=new AsaasStore(db,'sandbox');
  await pg.query("INSERT INTO asaas_sandbox.accounts(id,label,ownership,state,external_account_id) VALUES($1,'Legado','company','approved','external')",[id]);
  await pg.query("INSERT INTO asaas_sandbox.bia_accounts(bia_id,account_id) VALUES('bia-a',$1),('bia-b',$1)",[id]);
  const config=asaasConfig({ASAAS_BASE_ENABLED:'true',ASAAS_BAAS_ENABLED:'true'});
  let requests=0;
  const service=new AsaasAccountOperations(store,config,()=>({request:async()=>{requests++;return{};}}));
  for(const bia of ['bia-a','bia-b']){
   await assert.rejects(()=>store.accountForBia(bia),/compartilhada/);
   await assert.rejects(()=>service.dashboard(bia,'90'),/compartilhada/);
   await assert.rejects(()=>service.overview(bia),/compartilhada/);
  }
  const billing=new ContributionBilling({db} as any);
  await assert.rejects(()=>billing.account('bia-a'),/compartilhada/);
  assert.equal(requests,0);
  await assert.rejects(()=>pg.exec(exclusive));
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM asaas_sandbox.bia_accounts')).rows[0].n,2);
 }finally{await pg.close();}
});
