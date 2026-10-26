import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerContributionBilling } from './contribution-billing-routes';

test('API de aporte exige gestão e confirmação; consulta não emite',async()=>{
  let writes=0,reads=0;
  const app=express();app.use(express.json());
  registerContributionBilling(app,{requireReady:async()=>{},reminders:{read:async()=>({settings:{enabled:false}}),save:async()=>{writes++;return{settings:{enabled:true}};}},flowPayment:async(bia:string)=>{assert.equal(bia,'canonical');reads++;return{details:null};},enqueueFlow:async(bia:string,id:string)=>{assert.equal(bia,'canonical');assert.equal(id,'flow');writes++;return{id:'charge'};}} as any,async(req,res,write)=>{
    if(req.headers['x-access']!==(write?'edit':'view')){res.status(403).end();return null;}
    return{biaId:'canonical',manage:write,payerId:'payer',actorId:'user'};
  });
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}/api/bias/code/aportes-iniciais/cobrancas/lancamentos/flow`;
  try{
    assert.equal((await fetch(url+'/preparar',{method:'POST'})).status,403);
    assert.equal((await fetch(url+'/preparar',{method:'POST',headers:{'x-access':'edit'}})).status,400);
    assert.equal(writes,0);
    const read=await fetch(url+'/pagamento',{headers:{'x-access':'view'}});assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');assert.equal(reads,1);assert.equal(writes,0);
    assert.equal((await fetch(url+'/preparar',{method:'POST',headers:{'x-access':'edit','content-type':'application/json'},body:JSON.stringify({cashContribution:true})})).status,202);assert.equal(writes,1);
    assert.equal((await fetch(url+'/lembretes',{method:'PUT',headers:{'x-access':'view'}})).status,403);assert.equal(writes,1);
    assert.equal((await fetch(url+'/lembretes',{headers:{'x-access':'view'}})).status,200);assert.equal(writes,1);
    assert.equal((await fetch(url+'/lembretes',{method:'PUT',headers:{'x-access':'edit','content-type':'application/json'},body:JSON.stringify({enabled:true})})).status,200);assert.equal(writes,2);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
