import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerLiveAccountAccess} from './live-account-access';

async function fixture(run:(test:any)=>Promise<void>) {
  const records=new Map<string,any>([['u',{id:'u',role:'admin',ativo:true,email:'same@example.test',membro_directus_id:'m',permissions:{admin:'edit'}}]]);
  const sessions=new Map<string,any>([['u',{directusUserId:'u',role:'admin',permissions:{admin:'edit'},email:'same@example.test',membroId:'m'}]]);
  let employee:any=null; let unavailable=false;
  const app=express();
  app.use((req:any,_res,next)=>{req.session=sessions.get(req.header('x-test-user')||'u');next();});
  registerLiveAccountAccess(app,{
    getUser:async id=>{if(unavailable) throw new Error('offline');return records.get(id);},
    getUsersByEmail:async email=>Array.from(records.values()).filter(u=>u.email===email),
    getEmployee:async()=>employee,applyEmployee:(req,account)=>{req.session.role='employee';req.session.companyEmployeeId=account.id;req.session.permissions={admin:'none'};},
    bootstrap:email=>email==='recovery@example.test',adminPermissions:{admin:'edit'},
  });
  app.get('/api/me',(req:any,res)=>res.json({role:req.session.role,permissions:req.session.permissions,member:req.session.membroId}));
  app.all('/api/carteira/imoveis',(_req,res)=>res.sendStatus(200));
  app.get('/api/admin-test',(req:any,res)=>res.status(req.session.role==='admin'?200:403).json({role:req.session.role}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}`;
  try {await run({records,sessions,get:(path='/api/me',id='u',method='GET')=>fetch(url+path,{method,headers:{'x-test-user':id}}),employee:(value:any)=>employee=value,offline:()=>unavailable=true});}
  finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}

test('perfil salvo vale na próxima ação da mesma sessão, inclusive revogação e permissões vazias',async()=>{
  await fixture(async({records,sessions,get}:any)=>{
    assert.equal((await get('/api/admin-test')).status,200);
    records.get('u').role='user';records.get('u').permissions={};
    // Does not require polling /me or a new login before authorization changes.
    assert.equal((await get('/api/admin-test')).status,403);
    assert.deepEqual(sessions.get('u').permissions,{});
    records.get('u').role='manager';assert.equal((await (await get()).json()).role,'manager');
    records.get('u').role='admin';assert.equal((await get('/api/admin-test')).status,200);
    records.get('u').ativo=false;assert.equal((await get()).status,401);
  });
});

test('exceção pessoal prevalece sobre perfil alto e a restauração vale na mesma sessão', async()=>{
  await fixture(async({records,get}:any)=>{
    const user = records.get('u');
    for (const role of ['user','membro','aliado','manager','admin']) {
      user.role = role;
      user.permissions = {area_carteira:'none'};
      for (const method of ['GET','POST']) {
        const res = await get('/api/carteira/imoveis','u',method);
        assert.equal(res.status,403);
        assert.equal((await res.json()).code,'ACCOUNT_AREA_DENIED');
      }
      assert.equal((await (await get()).json()).permissions.area_carteira,'none');
      user.permissions = {};
      assert.equal((await get('/api/carteira/imoveis')).status,200);
    }
  });
});

test('revalidação usa identidade exata e não mistura contas com o mesmo e-mail',async()=>{
  await fixture(async({records,sessions,get}:any)=>{
    records.set('other',{...records.get('u'),id:'other',role:'user',membro_directus_id:'other-member'});
    sessions.set('other',{directusUserId:'other',role:'admin',email:'same@example.test',membroId:'other-member'});
    assert.equal((await get('/api/admin-test','other')).status,403);
    assert.equal((await get('/api/admin-test')).status,200);
    sessions.set('directus',{directusUserId:'directus-id',role:'user',email:'same@example.test',membroId:'m'});
    assert.equal((await get('/api/admin-test','directus')).status,200);
    records.delete('u');assert.equal((await get('/api/me','directus')).status,401);
  });
});

test('funcionário não herda privilégio global e recuperação continua explícita',async()=>{
  await fixture(async({records,sessions,get,employee,offline}:any)=>{
    employee({id:'employee-link',status:'ativo',employee_ativo:true});
    assert.equal((await get('/api/admin-test')).status,403);
    employee(null);records.get('u').role='user';records.get('u').email='recovery@example.test';
    assert.equal((await get('/api/admin-test')).status,200);
    assert.equal(sessions.get('u').companyEmployeeId,undefined);
    records.get('u').email='same@example.test';records.get('u').role='superadmin';
    assert.equal((await get('/api/admin-test')).status,200);
    offline();assert.equal((await get('/api/admin-test')).status,503);
  });
});
