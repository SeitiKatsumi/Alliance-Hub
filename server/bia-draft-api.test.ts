import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import ts from "typescript";
import { transformSync } from "esbuild";
import { BIA_WORKFLOW_SQL,validateBiaDraft } from "./bia-workflow";
import { assertMapRevision,mapContentHash } from "./bia-map-history";

test("capa e nome do rascunho sincronizam na criação, edição e repetição após falha sem efeitos financeiros",async()=>{
 const pg=new PGlite();await pg.exec(BIA_WORKFLOW_SQL);const db=drizzle(pg);
 const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
 const ast=ts.createSourceFile("routes.ts",source,ts.ScriptTarget.Latest,true);let functions="";
 function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&["createBiaHandler","requireBiaDraftAccess","syncBiaDraftPresentation"].includes(n.name?.text || ""))functions+=n.getText(ast)+"\n";ts.forEachChild(n,visit);}visit(ast);
 const start=source.indexOf('  app.get("/api/bias/:id/rascunho"');
 const routes=source.slice(start,source.indexOf('  app.patch("/api/bias/:id"',start));
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.session={directusUserId:req.headers["x-user"] || "autor",membroId:"membro",role:"admin"};next();});
 let official:any=null,fail=false;const writes:any[]=[];
 const scope={app,db,sql,validateBiaDraft,assertMapRevision,mapContentHash,ensureBiaMapInicialSnapshotsTable:async()=>{},
 withMapLock:(_id:string,work:any)=>db.transaction(tx=>work(tx)),requireBiaModuleAccess:async(_req:any,res:any)=>{res.status(403).json({error:"Negado"});return false;},
 directusFetchOne:async()=>official,createUniqueBiaPublicCode:async()=>"TESTE",
 directusCreate:async(_col:string,data:any)=>{if(fail)throw new Error("Falha simulada");official={...data};writes.push(data);return official;},
 directusUpdate:async(_col:string,_id:string,data:any)=>{if(fail)throw new Error("Falha simulada");official={...official,...data};writes.push(data);return official;}};
 new Function(...Object.keys(scope),transformSync(functions+routes+'\napp.post("/api/bias",createBiaHandler);',{loader:"ts",target:"es2022"}).code)(...Object.values(scope));
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 const root=`http://127.0.0.1:${(server.address() as any).port}/api/bias`,id="12345678-1234-4234-8234-123456789abc";
 const call=(method:string,path:string,body?:any,user="autor")=>fetch(root+path,{method,headers:{"content-type":"application/json","x-user":user},body:body?JSON.stringify(body):undefined});
 const data={nome_bia:"BIA com capa",moeda:"BRL",imagem_directus_id:"capa-1",map_inicial:{modeloCalculo:5,participantes:[]}};
 try {
  const created=await call("POST","",{...data,_rascunho:true,chaveCriacao:id});assert.equal(created.status,200);
  assert.equal(official.imagem_directus_id,"capa-1");assert.equal(official.situacao,"em_estruturacao");assert.equal(official.map_inicial,undefined);
  const edited={...data,nome_bia:"BIA V2",imagem_directus_id:"capa-2",revisaoEsperada:1};
  assert.equal((await call("PUT",`/${id}/rascunho`,edited,"outro")).status,403);
  assert.equal((await call("PUT",`/${id}/rascunho`,{...edited,revisaoEsperada:0})).status,409);
  fail=true;
  const pending=await (await call("PUT",`/${id}/rascunho`,edited)).json();
  assert.equal(pending.apresentacao_pendente,true);assert.equal(pending.revisao,2);assert.equal(pending.dados.imagem_directus_id,"capa-2");
  const stored=await (await call("GET",`/${id}/rascunho`)).json();assert.equal(stored.dados.imagem_directus_id,"capa-2");
  fail=false;
  const retried=await (await call("PUT",`/${id}/rascunho`,{...edited,revisaoEsperada:2})).json();
  assert.equal(retried.apresentacao_pendente,undefined);assert.equal(retried.revisao,2);
  assert.deepEqual(writes.at(-1),{nome_bia:"BIA V2",imagem_directus_id:"capa-2"});
  assert.equal((await call("PUT",`/${id}/rascunho`,{...edited,imagem_directus_id:"",revisaoEsperada:2})).status,200);assert.equal(official.imagem_directus_id,null);
  const count=writes.length;await pg.exec(`UPDATE bia_estruturacao_rascunhos SET conclusao_iniciada=true WHERE bia_id='${id}'`);
  assert.equal((await call("PUT",`/${id}/rascunho`,{...edited,imagem_directus_id:"",revisaoEsperada:3})).status,200);assert.equal(writes.length,count);
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_fase_eventos")).rows[0].n,0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pg.close();}
});

test("rascunho: acesso, revisão, congelamento, falha externa e retomada idempotente",async()=>{
 const pg=new PGlite();await pg.exec(BIA_WORKFLOW_SQL);const db=drizzle(pg);
 const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.session={directusUserId:req.headers["x-user"]};next();});
 const dados={nome_bia:"Teste isolado",moeda:"BRL",destinacao:"Rural",objetivo_alianca:"Renda",localizacao:"São Paulo",observacoes:"Teste",map_inicial:{modeloCalculo:4,valorOrigem:1000,participantes:[]}};
 await db.execute(sql`INSERT INTO bia_estruturacao_rascunhos (bia_id,autor_id,dados) VALUES ('teste','autor',${JSON.stringify(dados)}::jsonb)`);
 let invalid=true,fail=true,conclusions=0;const invitations=new Set<string>();
 const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
 const ast=ts.createSourceFile("routes.ts",source,ts.ScriptTarget.Latest,true);let access="";
 function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&["requireBiaDraftAccess","syncBiaDraftPresentation"].includes(n.name?.text || ""))access+=n.getText(ast)+"\n";ts.forEachChild(n,visit);}visit(ast);
 const start=source.indexOf('  app.get("/api/bias/:id/rascunho"');
 const routes=source.slice(start,source.indexOf('  app.patch("/api/bias/:id"',start));
 const scope={app,db,sql,validateBiaDraft,assertMapRevision,mapContentHash,ensureBiaMapInicialSnapshotsTable:async()=>{},
 requireBiaModuleAccess:async(_req:any,res:any)=>{res.status(403).json({error:"Negado"});return false;},
 withMapLock:(_id:string,work:any)=>db.transaction(tx=>work(tx)),directusFetchOne:async()=>({situacao:"em_estruturacao"}),directusUpdate:async()=>{},
 calculateSubmittedInitialMap:async()=>({participantes:[]}),biaTeamFromMapParticipants:()=>({autor_bia:"a",aliado_built:"a",diretor_alianca:"a"}),mapActor:()=>({id:"autor"}),
 createBiaHandler:async(req:any,res:any)=>{if(req.biaDraftValidateOnly)return invalid?res.status(400).json({error:"Aliado inválido"}):res.json({valid:true});conclusions++;invitations.add(req.biaDraftId);if(fail)return res.status(503).json({error:"Directus indisponível"});return res.json({id:req.biaDraftId});}};
 new Function(...Object.keys(scope),transformSync(access+"\n"+routes,{loader:"ts",target:"es2022"}).code)(...Object.values(scope));
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 const root=`http://127.0.0.1:${(server.address() as any).port}/api/bias/teste`;
 const call=(path:string,method="GET",body?:any,user="autor")=>fetch(root+path,{method,headers:{"content-type":"application/json","x-user":user},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await call("/rascunho","GET",undefined,"outro")).status,403);
  assert.equal((await call("/rascunho")).status,200);
  assert.equal((await call("/rascunho","PUT",{...dados,revisaoEsperada:0})).status,409);
  assert.equal((await call("/rascunho","PUT",{...dados,revisaoEsperada:1})).status,200);
  assert.equal((await call("/concluir-estruturacao","POST",{revisaoEsperada:1})).status,400);
  assert.equal((await (await call("/rascunho")).json()).conclusao_iniciada,false);
  assert.equal(invitations.size,0);
  invalid=false;
  assert.equal((await call("/concluir-estruturacao","POST",{revisaoEsperada:1})).status,503);
  const pending=await (await call("/rascunho")).json();assert.equal(pending.conclusao_iniciada,true);assert.equal(pending.concluido,false);
  assert.equal((await call("/rascunho","PUT",{...dados,nome_bia:"Outro",revisaoEsperada:1})).status,409);
  fail=false;assert.equal((await call("/concluir-estruturacao","POST",{revisaoEsperada:1})).status,200);
  // Completed drafts require effective configuration permission, not ownership alone.
  assert.equal(invitations.size,1);assert.equal(conclusions,2);
  assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_fase_eventos")).rows[0].n,1);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pg.close();}
});
