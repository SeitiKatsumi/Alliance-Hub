import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
import {sql} from 'drizzle-orm';
import {PgDialect} from 'drizzle-orm/pg-core';
import {normalizePropertyCib} from '../shared/property-cib';
import {sanitizeValuationAreas} from '../shared/property-valuation';
import {validatePropertyGoal} from '../shared/property-thesis';

test('CIB passa por criação, leitura e edição reais da Carteira em JSON, vazio continua permitido',async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const start=source.indexOf('  function sanitizeInventarioImovel(');
 const sanitize=source.slice(start,source.indexOf('  function sanitizeInventarioLancamento',start));
 const first=source.indexOf('  app.get("/api/carteira/imoveis/:id",');
 const routes=source.slice(first,source.indexOf('  app.get("/api/carteira/imoveis/:id/socios",',first));
 const storage=new PGlite();const dialect=new PgDialect();
 await storage.exec('CREATE TABLE inventario_imoveis(id text PRIMARY KEY,data jsonb NOT NULL,owner_user_id text,owner_membro_id text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())');
 const handlers=new Map<string,any>();
 const actor={userId:'owner',membroId:'member',isPlatformAdmin:false};
 const scope={sql,normalizePropertyCib,sanitizeValuationAreas,validatePropertyGoal,randomUUID:()=> 'dummy-id',
   app:Object.fromEntries(['get','post','patch'].map(method=>[method,(path:string,fn:any)=>handlers.set(`${method}:${path}`,fn)])),
   db:{execute:async(statement:any)=>{const query=dialect.sqlToQuery(statement);return storage.query(query.sql,query.params);}},
   requireCarteiraActor:(req:any)=>req.actor||actor,
   requireCarteiraAccess:async(id:string,current:any,level:string)=>{assert.ok(['leitura','administracao'].includes(level));const row:any=(await storage.query('SELECT * FROM inventario_imoveis WHERE id=$1',[id])).rows[0];if(!row||row.owner_user_id!==current.userId)throw Object.assign(new Error('Sem acesso'),{status:403});return {imovel:{...row.data,id:row.id,owner_user_id:row.owner_user_id,owner_membro_id:row.owner_membro_id},nivel:'proprietario',isOwner:true};},
   calculateCarteiraDiagnosis:async()=>({}),propertyOwnershipView:async()=>({}),canDeleteCarteiraAsset:()=>true,
   validatePropertyPartnersInput:()=>{},savePropertyPartners:async()=>[],loadPropertyPartners:async()=>[],recordCarteiraEvent:async()=>{},
   carteiraOwnerActor:(property:any)=>({userId:property.owner_user_id,membroId:property.owner_membro_id}),
 };
 new Function(...Object.keys(scope),transformSync(sanitize+'\n'+routes,{loader:'ts'}).code)(...Object.values(scope));
 async function invoke(method:string,path:string,body:any={},caller=actor){let status=200;let value:any;const res:any={status:(code:number)=>{status=code;return res;},json:(json:any)=>{value=json;return res;}};await handlers.get(`${method}:${path}`)({body,params:{id:'one'},actor:caller},res);return {status,value};}
 try{
   const created=await invoke('post','/api/carteira/imoveis',{id:'one',nome:'Casa fictícia',cib:' abc12345 '});assert.equal(created.status,201);assert.equal(created.value.cib,'ABC1234-5');
   assert.equal((await invoke('get','/api/carteira/imoveis/:id')).value.cib,'ABC1234-5');
   await invoke('patch','/api/carteira/imoveis/:id',{nome:'Outro nome'});assert.equal((await invoke('get','/api/carteira/imoveis/:id')).value.cib,'ABC1234-5');
   await invoke('patch','/api/carteira/imoveis/:id',{cib:'00123456'});assert.equal((await invoke('get','/api/carteira/imoveis/:id')).value.cib,'0012345-6');
   assert.equal((await invoke('patch','/api/carteira/imoveis/:id',{cib:'inválido'})).status,400);assert.equal((await invoke('get','/api/carteira/imoveis/:id')).value.cib,'0012345-6');
   assert.equal((await invoke('get','/api/carteira/imoveis/:id',{}, {...actor,userId:'other'})).status,403);
   await invoke('patch','/api/carteira/imoveis/:id',{cib:''});assert.equal((await invoke('get','/api/carteira/imoveis/:id')).value.cib,'');
   const blank=await invoke('post','/api/carteira/imoveis',{id:'blank',nome:'Sem CIB'});assert.equal(blank.status,201);assert.equal(blank.value.cib,'');
 }finally{await storage.close();}
});
