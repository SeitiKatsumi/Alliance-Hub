import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHmac} from 'node:crypto';
import Stripe from 'stripe';
import {MigrationInbox,maintenanceApp} from './migration-inbox';

const env={BUILT_MIGRATION_INBOX_KEY:'ab'.repeat(32),ASAAS_SANDBOX_WEBHOOK_TOKEN:'test-only-token',STRIPE_WEBHOOK_SECRET:'test-only-signature'};
const body=Buffer.from(JSON.stringify({id:'fixture-event',event:'PAYMENT_RECEIVED',payment:{id:'fixture-payment'}}));
async function fixture(){
  const root=await mkdtemp(path.join(os.tmpdir(),'built-inbox-'));
  return {root,inbox:new MigrationInbox(root,env),cleanup:async()=>{for(const name of await readdir(root))await unlink(path.join(root,name));await rmdir(root);}};
}
test('maintenance: rejeita evento sem autenticação e persiste conteúdo cifrado antes de confirmar',async()=>{
  const f=await fixture();try{
    assert.equal((await f.inbox.accept('/api/webhooks/asaas/sandbox',body,{})).status,401);
    assert.equal((await f.inbox.accept('/api/webhooks/asaas/sandbox',Buffer.alloc(102401),{})).status,413);
    assert.equal((await readdir(f.root)).length,0);
    const headers={'asaas-access-token':env.ASAAS_SANDBOX_WEBHOOK_TOKEN};
    assert.equal((await f.inbox.accept('/api/webhooks/asaas/sandbox',body,headers)).status,200);
    assert.equal((await f.inbox.accept('/api/webhooks/asaas/sandbox',body,headers)).status,200);
    const files=(await readdir(f.root)).filter(f=>f.endsWith('.json'));assert.equal(files.length,1);
    const encrypted=await readFile(path.join(f.root,files[0]),'utf8');
    assert.ok(!encrypted.includes('fixture-payment'));assert.ok(!encrypted.includes('test-only-token'));
    const restored=new MigrationInbox(f.root,env);
    assert.equal((await restored.read(files[0].slice(0,-5))).body,body.toString());
    const tampered=JSON.parse(encrypted);tampered.tag='00'.repeat(16);
    await writeFile(path.join(f.root,files[0]),JSON.stringify(tampered));
    await assert.rejects(restored.read(files[0].slice(0,-5)));
    await assert.rejects(restored.read('../bad'));
  }finally{await f.cleanup();}
});
test('maintenance: reprocessa pelo handler, preserva falha e não confirma segunda fila como destino',async()=>{
  const f=await fixture();try{
    await f.inbox.accept('/api/webhooks/asaas/sandbox',body,{'asaas-access-token':env.ASAAS_SANDBOX_WEBHOOK_TOKEN});
    await assert.rejects(f.inbox.replay('https://outside.example'),/local/);
    await assert.rejects(f.inbox.replay('http://127.0.0.1:3018',async()=>new Response('{}',{status:503})),/recusou/);
    await assert.rejects(f.inbox.replay('http://127.0.0.1:3018',async()=>Response.json({received:true,queued:true})),/processamento/);
    let calls=0;
    const send:typeof fetch=async(url,init)=>{calls++;assert.equal(String(url),'http://127.0.0.1:3018/api/webhooks/asaas/sandbox');assert.equal(init?.body,body.toString());assert.equal(new Headers(init?.headers).get('asaas-access-token'),env.ASAAS_SANDBOX_WEBHOOK_TOKEN);return Response.json({received:true});};
    assert.deepEqual(await f.inbox.replay('http://127.0.0.1:3018',send),{delivered:1,alreadyDelivered:0});
    assert.deepEqual(await f.inbox.replay('http://127.0.0.1:3018',send),{delivered:0,alreadyDelivered:1});
    assert.equal(calls,1);assert.equal((await readdir(f.root)).filter(n=>n.endsWith('.json')).length,1);
  }finally{await f.cleanup();}
});
test('maintenance: Stripe é validado na chegada e reenviado autenticado sem mudar o evento',async()=>{
  const f=await fixture();try{
    const timestamp=Math.floor(Date.now()/1000),secret=env.STRIPE_WEBHOOK_SECRET;
    const raw=JSON.stringify({id:'evt_fixture',type:'invoice.paid',data:{object:{id:'in_fixture'}}});
    const signature=`t=${timestamp},v1=${createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex')}`;
    assert.equal((await f.inbox.accept('/api/stripe/webhook',Buffer.from(raw),{'stripe-signature':'invalid'})).status,401);
    assert.equal((await f.inbox.accept('/api/stripe/webhook',Buffer.from(raw),{'stripe-signature':signature})).status,200);
    await f.inbox.replay('http://127.0.0.1:3018',async(_url,init)=>{
      const event=new Stripe('offline-test').webhooks.constructEvent(init?.body as string,new Headers(init?.headers).get('stripe-signature')!,secret);
      assert.equal(event.id,'evt_fixture');return Response.json({received:true});
    });
  }finally{await f.cleanup();}
});
test('maintenance: receptor independente bloqueia telas/escritas e não depende de banco',async()=>{
  const f=await fixture();const server=maintenanceApp(f.inbox).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+(server.address() as any).port;
  try{
    assert.equal((await fetch(origin+'/health')).status,200);
    assert.equal((await fetch(origin+'/api/membros',{method:'PATCH',body:'{}'})).status,503);
    const r=await fetch(origin+'/api/webhooks/asaas/sandbox',{method:'POST',headers:{'content-type':'application/json','asaas-access-token':env.ASAAS_SANDBOX_WEBHOOK_TOKEN},body});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{received:true,queued:true});
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await f.cleanup();}
});
