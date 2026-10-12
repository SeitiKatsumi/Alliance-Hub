import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {sql} from "drizzle-orm";
import {registerBiaInviteCancel} from "./bia-invite-cancel";

test("cancelamento usa BIA autorizada, só altera pendentes e preserva histórico", async()=>{
  const pg = new PGlite();
  const db = drizzle(pg);
  try {
    await pg.exec(`CREATE TABLE bia_socio_solicitacoes (id text primary key, bia_id text, status text, respondido_em timestamp);
      CREATE TABLE bia_diretor_solicitacoes (LIKE bia_socio_solicitacoes INCLUDING ALL);
      INSERT INTO bia_socio_solicitacoes VALUES ('pending','bia','pendente',null),('other','outra','pendente',null),('accepted','bia','aceito',null);
      INSERT INTO bia_diretor_solicitacoes VALUES ('director','bia','pendente',null);`);
    const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
    const block=source.slice(source.indexOf("  registerBiaInviteCancel(app,"),source.indexOf('  app.patch("/api/bia-diretor-solicitacoes/:id/aceitar"'));
    let handler:any, allowed=true, calls=0;
    const scope={app:{post:(_path:string,fn:any)=>handler=fn},registerBiaInviteCancel,db,sql,
      withBiaInviteLock:(_type:string,fn:any)=>fn,
      requireBiaModuleAccess:async(_req:any,res:any,id:string,key:string,level:string)=>{
        calls++; assert.equal(id,"PUBLIC");assert.equal(key,"configuracao_bia");assert.equal(level,"edit");
        if(!allowed){res.status(403).json({error:"denied"});return null;}
        return {bia:{id:"bia"}};
      }};
    new Function(...Object.keys(scope),transformSync(block,{loader:"ts"}).code)(...Object.values(scope));
    const call=async(id:string,type="socio")=>{let status=200,body:any;const res={status:(v:number)=>{status=v;return res;},json:(v:any)=>body=v};await handler({params:{id:"PUBLIC",conviteId:id,tipo:type}},res);return {status,body};};
    allowed=false; assert.equal((await call("pending")).status,403); allowed=true;
    assert.equal((await call("pending","invalid")).status,400);
    for(const id of ["missing","other","accepted"])assert.equal((await call(id)).status,409);
    assert.equal((await call("pending")).status,200);
    assert.equal((await call("pending")).status,409);
    assert.equal((await call("director","diretor")).status,200);
    const rows=(await pg.query<any>("SELECT * FROM bia_socio_solicitacoes ORDER BY id")).rows;
    assert.equal(rows.length,3);assert.equal(rows[0].status,"aceito");assert.equal(rows[1].status,"pendente");
    assert.equal(rows[2].status,"cancelado");assert.ok(rows[2].respondido_em);
    assert.ok(calls>0);
    assert.doesNotMatch(block,/directusUpdate|enviar|DELETE FROM/);
  }finally{await pg.close();}
});

test("aceite/recusa e cancelamento usam a mesma exclusão mútua",async()=>{
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const block=source.slice(source.indexOf("  const withBiaInviteLock ="),source.indexOf("  registerBiaInviteCancel(app,"));
  let locked=false, release!:()=>void, key:any;
  const db={transaction:async(fn:any)=>{let acquired=false;try{return await fn({execute:async(statement:any)=>{key=statement; if(locked)return {rows:[{locked:false}]}; locked=true;acquired=true;return {rows:[{locked:true}]};}});}finally{if(acquired)locked=false;}}};
  const lock=new Function("db","sql",transformSync(block,{loader:"ts"}).code+";return withBiaInviteLock;")(db,sql);
  const res=()=>{const value:any={code:200,status:(code:number)=>{value.code=code;return value;},json:()=>{}};return value;};
  const first=lock("socio",async()=>new Promise<void>(resolve=>release=resolve))({session:{directusUserId:"u"},params:{id:"i"}},res());
  await new Promise(resolve=>setImmediate(resolve));
  const denied=res();let called=false;
  await lock("param",async()=>{called=true;})({session:{directusUserId:"u"},params:{tipo:"socio",conviteId:"i"}},denied);
  assert.equal(denied.code,409);assert.equal(called,false);assert.ok(key);
  release();await first;assert.equal(locked,false);
  for(const type of ["socio","diretor"])for(const action of ["aceitar","recusar"])
    assert.ok(source.includes(`app.patch("/api/bia-${type}-solicitacoes/:id/${action}", withBiaInviteLock("${type}"`));
  const editor=readFileSync(new URL("../client/src/pages/bias.tsx",import.meta.url),"utf8");
  assert.match(editor,/<BiaPartnersStatus biaId=\{bia.id\}/);
});

test("convite cancelado não pode mais ser aceito nem recusado",async()=>{
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  for(const type of ["socio","diretor"])for(const action of ["aceitar","recusar"]){
    const start=source.indexOf(`  app.patch("/api/bia-${type}-solicitacoes/:id/${action}"`);
    const end=source.indexOf("\n  }));",start)+8;
    let handler:any,code=200;
    const scope={app:{patch:(_path:string,fn:any)=>handler=fn},withBiaInviteLock:(_type:string,fn:any)=>fn,
      storage:{getBiaSocioSolicitacaoById:async()=>({status:"cancelado"}),getBiaDiretorSolicitacaoById:async()=>({status:"cancelado"})}};
    new Function(...Object.keys(scope),transformSync(source.slice(start,end),{loader:"ts"}).code)(...Object.values(scope));
    const res={status:(value:number)=>{code=value;return res;},json:()=>{}};
    await handler({session:{directusUserId:"u",membroId:"m"},params:{id:"i"}},res);
    assert.equal(code,400);
  }
});
