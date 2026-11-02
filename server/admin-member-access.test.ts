import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerAdminMemberAccess} from './admin-member-access';
test('access report and account mutations revalidate administration, activity and employment',async()=>{
 const app=express();app.use(express.json());let actor:any=null;let reads=0;let writes=0;let professional:any=null;
 registerAdminMemberAccess(app,{actor:async()=>actor,summary:async id=>{reads++;return id==='missing'?null:{userId:id};},professional:async(id,enabled)=>{professional={id,enabled};return true;}});
 app.patch('/api/users/:id',(_q,r)=>{writes++;r.json({ok:true});});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${(server.address() as any).port}`;
 try {
   for(const [who,code] of [[null,401],[{role:'user',active:true},403],[{role:'admin',active:false},403],[{role:'admin',active:true,employee:true},403]] as any[]){
     actor=who;assert.equal((await fetch(url+'/api/admin/member-access/u')).status,code);
     assert.equal((await fetch(url+'/api/users/u',{method:'PATCH'})).status,code);
     assert.equal((await fetch(url+'/api/admin/member-access/u/professional',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})})).status,code);
   }
   assert.equal(reads,0);assert.equal(writes,0);
   actor={role:'admin',active:true,employee:false};
   const result=await fetch(url+'/api/admin/member-access/u');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
   assert.equal((await fetch(url+'/api/admin/member-access/missing')).status,404);
   assert.equal((await fetch(url+'/api/users/u',{method:'PATCH'})).status,200);
   assert.equal((await fetch(url+'/api/admin/member-access/u/professional',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:'yes'})})).status,400);
   assert.equal(professional,null);
   assert.equal((await fetch(url+'/api/admin/member-access/u/professional',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})})).status,200);
   assert.deepEqual(professional,{id:'u',enabled:true});
   actor={role:'user',active:true};
   assert.equal((await fetch(url+'/api/users/u',{method:'PATCH'})).status,403);assert.equal(writes,1);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
