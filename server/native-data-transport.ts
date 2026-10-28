import pg from 'pg';
import {isolatedStage} from './isolated-stage';
import { randomUUID, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NativeDataStore, NativeDataError, loadNativeCatalog, parseNativeQuery, ident, NATIVE_COLLECTIONS, type Queryable, type Catalog } from './native-data-store';

export const nativeDataEnabled = () => process.env.BUILT_DATA_BACKEND === 'postgres';
const realFetch = globalThis.fetch;
let pool:pg.Pool|undefined;
let catalogPromise:Promise<Catalog>|undefined;
const loginTickets=new Map<string,{expires:number;user:any}>();
const response=(data:any,status=200)=>new Response(JSON.stringify({data}),{status,headers:{'content-type':'application/json'}});
const failure=(status:number,message:string,code='INVALID_PAYLOAD')=>new Response(JSON.stringify({errors:[{message,extensions:{code}}]}),{status,headers:{'content-type':'application/json'}});
const types:Record<string,string>={varchar:'string',text:'text',uuid:'uuid',int2:'integer',int4:'integer',int8:'bigInteger',numeric:'decimal',float4:'float',float8:'float',bool:'boolean',json:'json',jsonb:'json',timestamp:'timestamp',timestamptz:'timestamp',date:'date'};
function fieldInfo(catalog:Catalog,name:string) {
  const physical=catalog.columns.filter(c=>c.table_name===name);
  const aliases=catalog.fields.filter(f=>f.collection===name&&!physical.some(c=>c.column_name===f.field));
  return [...physical.map(c=>{
    const m=catalog.fields.find(f=>f.collection===name&&f.field===c.column_name);
    return {collection:name,field:c.column_name,type:types[c.udt_name]||c.udt_name,
      schema:{...c,name:c.column_name,is_nullable:c.is_nullable==='YES',max_length:c.character_maximum_length},
      meta:m?{...m,special:Array.isArray(m.special)?m.special:String(m.special||'').split(',').filter(Boolean)}:null};
  }),...aliases.map(f=>({collection:name,field:f.field,type:'alias',schema:null,meta:{...f,special:String(f.special||'').split(',')}}))];
}

export async function nativeRequest(db:Queryable,catalog:Catalog,url:URL,init:RequestInit={},assetsRoot=process.env.BUILT_ASSETS_ROOT):Promise<Response> {
  const store=new NativeDataStore(db,catalog), method=(init.method||'GET').toUpperCase();
  const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [resource,name,id]=parts;
  const body=typeof init.body==='string'?JSON.parse(init.body):undefined;
  if(resource==='items') {
    if(parts.length>3)throw new NativeDataError(404,'Rota não encontrada.');
    store.collection(name);
    if(name==='directus_files')throw new NativeDataError(403,'Use o armazenamento de arquivos.');
    if(method==='GET') {
      const query=parseNativeQuery(url.searchParams);
      if(id)query.filter={_and:[query.filter,{[store.primary(name)]:{_eq:id}}]};
      const rows=await store.read(name,query);
      if(id&&!rows.length)throw new NativeDataError(404,'Registro não encontrado.','NOT_FOUND');
      return response(id?rows[0]:rows);
    }
    if(method==='POST') {
      const items=Array.isArray(body)?body:[body];const created=[];
      for(const item of items)created.push(await store.save(name,item));
      const projected=await store.project(name,created,url.searchParams.get('fields')||'*');
      return response(Array.isArray(body)?projected:projected[0]);
    }
    if(method==='PATCH') {
      const records=id?[{key:id,data:body}]:Array.isArray(body)?body.map(v=>({key:v[store.primary(name)],data:v})):Array.isArray(body?.keys)?body.keys.map((key:any)=>({key,data:body.data})):null;
      if(!records||records.some((r:any)=>r.key===undefined))throw new NativeDataError(400,'Identificadores obrigatórios.');
      const updated=[];for(const record of records)updated.push(await store.save(name,record.data,record.key));
      const projected=await store.project(name,updated,url.searchParams.get('fields')||'*');
      return response(id?projected[0]:projected);
    }
    if(method==='DELETE') {
      const ids=id?[id]:Array.isArray(body)?body:null;
      if(!ids)throw new NativeDataError(400,'Identificadores obrigatórios.');
      for(const key of ids)await store.remove(name,key);
      return new Response(null,{status:204});
    }
  }
  if(resource==='collections'&&method==='GET') {
    if(name)store.collection(name);
    const rows=[...NATIVE_COLLECTIONS].filter(c=>catalog.columns.some(f=>f.table_name===c)).map(collection=>({collection,schema:{name:collection},meta:{}}));
    return response(name?rows.find(r=>r.collection===name):rows);
  }
  if(resource==='fields'&&method==='GET') {
    store.collection(name);const fields=fieldInfo(catalog,name),selected=id?fields.find(f=>f.field===id):fields;
    if(!selected)throw new NativeDataError(404,'Campo não encontrado.','NOT_FOUND');
    return response(selected);
  }
  if(resource==='schema'&&name==='snapshot'&&method==='GET')return response({fields:[...NATIVE_COLLECTIONS].flatMap(c=>fieldInfo(catalog,c)),relations:catalog.relations});
  if(['fields','collections','relations','permissions'].includes(resource)&&method!=='GET') {
    // Schema is operator-managed in native mode. Existing boot probes can discover
    // duplicates, but never silently mutate the production database schema.
    if(resource==='fields'&&fieldInfo(catalog,name).some(f=>f.field===(id||body?.field)))return failure(409,'Campo já existe.','RECORD_NOT_UNIQUE');
    if(resource==='collections'&&catalog.columns.some(c=>c.table_name===body?.collection))return failure(409,'Coleção já existe.','RECORD_NOT_UNIQUE');
    if(resource==='relations'&&catalog.relations.some(r=>r.many_collection===body?.collection&&r.many_field===body?.field))return failure(409,'Relação já existe.','RECORD_NOT_UNIQUE');
    return failure(503,'Estrutura nativa pendente de preparação.','NATIVE_SCHEMA_REQUIRED');
  }
  if(resource==='permissions'&&method==='GET')return response([]); // Directus-only bootstrap, not platform authorization.
  if(resource==='relations'&&method==='GET')return response(catalog.relations);
  if(resource==='auth'&&name==='login'&&method==='POST') {
    if(typeof body?.email!=='string'||typeof body?.password!=='string'||body.password.length>1024)return failure(401,'Credenciais inválidas.');
    const users=(await db.query('SELECT id,email,first_name,last_name,role,password,status,tfa_secret FROM built_legacy.directus_users WHERE lower(email)=lower($1)',[body.email.trim()])).rows;
    const user=users.length===1?users[0]:null;
    // Do not bypass an imported MFA requirement or a suspended legacy identity.
    const {verify}=await import('argon2');
    const valid=user?.status==='active'&&!user.tfa_secret&&typeof user.password==='string'&&user.password.startsWith('$argon2')&&await verify(user.password,body.password).catch(()=>false);
    if(!valid)return failure(401,'Credenciais inválidas.');
    for(const [key,ticket] of loginTickets)if(ticket.expires<Date.now())loginTickets.delete(key);
    if(loginTickets.size>=1000)return failure(503,'Login temporariamente indisponível.');
    const token=randomBytes(32).toString('base64url');
    const {password:_,status:__,tfa_secret:___,...safe}=user;
    loginTickets.set(token,{user:safe,expires:Date.now()+60000});
    return response({access_token:token,expires:60000});
  }
  if(resource==='users'&&name==='me'&&method==='GET') {
    const token=new Headers(init.headers).get('authorization')?.replace(/^Bearer /,'')||'';
    const ticket=loginTickets.get(token);loginTickets.delete(token);
    return ticket&&ticket.expires>Date.now()?response(ticket.user):failure(401,'Sessão inválida.');
  }
  if(resource==='files'||resource==='assets') {
    if(method==='GET') {
      const file=(await db.query('SELECT * FROM built_legacy.directus_files WHERE id=$1',[name])).rows[0];
      if(!file)throw new NativeDataError(404,'Arquivo não encontrado.');
      if(resource==='files')return response(file);
      if(!assetsRoot||!path.isAbsolute(assetsRoot)||!file.filename_disk||path.basename(file.filename_disk)!==file.filename_disk)throw new NativeDataError(503,'Armazenamento indisponível.');
      const root=await fs.realpath(assetsRoot), filePath=await fs.realpath(path.join(root,file.filename_disk));
      if(path.dirname(filePath)!==root)throw new NativeDataError(403,'Arquivo inválido.');
      const bytes=await fs.readFile(filePath);
      const safeMime=/^(image\/(png|jpeg|gif|webp)|application\/pdf|audio\/[a-z0-9.+-]+)$/.test(file.type)?file.type:'application/octet-stream';
      return new Response(bytes,{headers:{'content-type':safeMime,'x-content-type-options':'nosniff','cache-control':'private, max-age=300'}});
    }
    if(resource==='files'&&method==='POST') {
      if(!assetsRoot||!path.isAbsolute(assetsRoot)||!(init.body instanceof FormData))throw new NativeDataError(503,'Armazenamento indisponível.');
      const file=init.body.get('file');if(!file||typeof file==='string'||file.size>50*1024*1024)throw new NativeDataError(400,'Arquivo inválido.');
      const bytes=Buffer.from(await file.arrayBuffer());
      const {fileTypeFromBuffer}=await import('file-type');
      const detected=await fileTypeFromBuffer(bytes);
      if(!detected||!['jpg','png','gif','webp','pdf','doc','docx','xls','xlsx','mp3','mp4','m4a','ogg','opus','wav','webm'].includes(detected.ext))throw new NativeDataError(400,'Formato de arquivo não permitido.');
      const fileId=randomUUID(),disk=fileId+'.'+detected.ext;
      const root=await fs.realpath(assetsRoot);
      await fs.writeFile(path.join(root,disk),bytes,{flag:'wx',mode:0o600});
      // Keep an unreferenced file if the transaction fails; never delete a backup.
      const row=await store.save('directus_files',{id:fileId,storage:'local',filename_disk:disk,filename_download:path.basename(file.name),title:path.basename(file.name),type:detected.mime,filesize:file.size,uploaded_on:new Date().toISOString()});
      return response(row);
    }
    if(resource==='files'&&method==='DELETE') {
      // Preserve bytes for recovery while removing only the authorized metadata link.
      await store.remove('directus_files',name);return new Response(null,{status:204});
    }
  }
  return failure(501,'Operação ainda não suportada pela base nativa.','NATIVE_OPERATION_UNSUPPORTED');
}

/** Compatibility boundary for internal callers; other services still use normal fetch. */
export const platformDataFetch:typeof fetch = async (input,init={}) => {
  const raw=input instanceof Request?input.url:String(input);
  const origin=new URL(process.env.DIRECTUS_URL||'https://databases.builtalliances.com');
  let url:URL;try{url=new URL(raw);}catch{return realFetch(input,init);}
  if(!nativeDataEnabled()||url.origin!==origin.origin) {
    if(isolatedStage())throw new NativeDataError(503,'Integrações externas desativadas na homologação.');
    return realFetch(input,init);
  }
  if(input instanceof Request)throw new NativeDataError(500,'Use parâmetros explícitos no transporte interno.');
  pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:12});
  const client=await pool.connect();
  try {
    catalogPromise??=loadNativeCatalog(client).catch(e=>{catalogPromise=undefined;throw e;});
    const catalog=await catalogPromise;
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='15000ms'");
    const result=await nativeRequest(client,catalog,url,init);
    if(result.ok)await client.query('COMMIT');else await client.query('ROLLBACK');
    return result;
  } catch(error:any) {
    await client.query('ROLLBACK').catch(()=>{});
    if(error instanceof NativeDataError)return failure(error.status,error.message,error.code);
    // SQL errors can contain row values or credentials. Do not expose/log them.
    return failure(500,'Não foi possível concluir a operação na base da plataforma.','NATIVE_DATA_ERROR');
  } finally {client.release();}
};
