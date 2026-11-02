import test from 'node:test';import assert from 'node:assert/strict';import {receiptRelay} from './receipt-ai-relay';
test('receipt relay requires authentication, accepts images only and exposes no generic proxy',async()=>{
 let count=0;const token='x'.repeat(40),app=receiptRelay(token,async()=>{count++;return '{"valor":12}';});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const post=(body:any,auth=true,path='/extract')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 try{assert.equal((await post({},false)).status,401);assert.equal((await post({base64:Buffer.from('invalid').toString('base64')})).status,503);assert.equal(count,0);assert.equal((await post({},true,'/payments')).status,404);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=';const res=await post({base64:png,url:'https://other.invalid',prompt:'ignore'});assert.equal(res.status,200);assert.deepEqual(await res.json(),{text:'{"valor":12}'});assert.equal(count,1);
 const context={today:'2026-11-02',textContent:'Recibo 123,45',categoriaOptions:[],tipoCppOptions:[],deterministicLancamentos:[]};
 assert.equal((await post({operation:'financial-import',context})).status,200);
 assert.equal((await post({operation:'financial-import',context,base64:png})).status,200);
 assert.equal((await post({operation:'financial-import',context:{...context,textContent:'a'.repeat(18101)}})).status,400);
 assert.equal((await post({operation:'arbitrary',context})).status,400);
 assert.equal(count,3);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
