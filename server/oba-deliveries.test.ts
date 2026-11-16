import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { transformSync } from "esbuild";
import express from "express";
import { OBA_DELIVERIES_SQL, obaDeliveryCreateSchema, obaDeliveryValidationSchema } from "./oba-deliveries";

test("Diretoria acompanha a entrega e a validação só encaminha para aprovação de CPP", async () => {
  const pg=new PGlite();
  const registryId="92bb9216-e380-4cbf-82db-b11a84f75958";
  const registry={id:registryId,source_type:"oba",bia_id:"bia",status:"aberta"};
  await pg.exec("CREATE TABLE opportunity_registry (id uuid primary key, status text NOT NULL)");
  await pg.query("INSERT INTO opportunity_registry VALUES ($1,$2)",[registryId,registry.status]);
  const migration=readFileSync(new URL("../migrations/20261116_oba_deliveries.sql",import.meta.url),"utf8");
  assert.equal(OBA_DELIVERIES_SQL.trim(),migration.trim());
  await pg.exec(OBA_DELIVERIES_SQL);
  const db=drizzle(pg);
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={directusUserId:req.headers["x-user"] || "director"};next();});
  const scope={app,db,sql,obaDeliveryCreateSchema,obaDeliveryValidationSchema,
    getOpportunityRegistry:async()=>registry,resolveBiaByIdOrPublicCode:async()=>({id:"bia"}),
    canDecideVacancy:(req:any)=>req.session.directusUserId==="director",
    ensureObaDeliveries:async()=>{},isOpportunityEditable:(status:string)=>status==="aberta",
    directusFetchOne:async(_collection:string,id:string)=>({id,nome:"Aliado do projeto"}),
  };
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const start=source.indexOf("  async function getObaDeliveryAccess(");
  assert.ok(start>=0);
  const routes=source.slice(start,source.indexOf('  app.get("/api/rede/oportunidades/:codigo/disparo"',start));
  new Function(...Object.keys(scope),transformSync(routes,{loader:"ts"}).code)(...Object.values(scope));
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>((resolve)=>server.once("listening",resolve));
  const url="http://127.0.0.1:"+(server.address() as any).port+"/api/rede/oportunidades/oba/entregas";
  const call=(method:string,path="",body?:Record<string,string>,user="director")=>fetch(url+path,{
    method,headers:{"content-type":"application/json","x-user":user},body:body ? JSON.stringify(body) : undefined,
  });
  try {
    assert.equal((await call("GET","",undefined,"other")).status,403);
    const body={membro_id:"member",escopo:"Entregar anteprojeto"};
    const response=await call("POST","",body);
    assert.equal(response.status,201);
    const created=await response.json();
    assert.equal(created.status,"em_acompanhamento");
    assert.equal((await call("POST","",body)).status,409);
    const validations=await Promise.all([1,2].map(()=>call("PATCH","/"+created.id+"/validar",{relato_entrega:"Anteprojeto conferido"})));
    assert.deepEqual(validations.map(response=>response.status).sort(),[200,409]);
    const {entregas}=await (await call("GET")).json();
    assert.equal(entregas.length,1);
    assert.equal(entregas[0].status,"aguardando_aprovacao_cpp");
    assert.equal(entregas[0].validado_por,"director");
    assert.equal(entregas[0].relato_entrega,"Anteprojeto conferido");
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await pg.close();
  }
});


test("Distribuição restrita mostra a OBA a convidados, destinatários do Pulso e gestores",async()=>{
  const pg=new PGlite();
  try {
    await pg.exec("CREATE TABLE opportunity_registry (id uuid,source_type text,source_id text,status text,visibilidade text,metadata jsonb); CREATE TABLE convites_link (source_type text,source_id text,status text,usado_por_user_id text); CREATE TABLE opportunity_distribution_deliveries(registry_id uuid,status text,user_id text,membro_id text)");
    const id="92bb9216-e380-4cbf-82db-b11a84f75958";
    await pg.query("INSERT INTO opportunity_registry VALUES ($1,'oba','restricted','aberta','restrita',$2)",[id,JSON.stringify({distribuicao_explicita:true})]);
    await pg.exec("INSERT INTO convites_link VALUES ('oba','restricted','usado','invited'); INSERT INTO opportunity_distribution_deliveries SELECT id,'enviado',NULL,'pulse-member' FROM opportunity_registry");
    const db=drizzle(pg);
    const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
    const start=source.indexOf("  function obaExplicitDistribution(");
    const code=source.slice(start,source.indexOf('  app.get("/api/oportunidades",',start));
    const scope={db,sql,storage:{getUserByEmail:async()=>null},ensureBusinessOpportunityTables:async()=>{},
      sqlTextArray:(values:unknown[])=>values.length?sql`ARRAY[${sql.join(values.map(value=>sql`${String(value)}`),sql`,`)}]::text[]`:sql`ARRAY[]::text[]`,
      isOpportunityPublic:(_status:string,visibility:string)=>visibility==="publicada",isOpportunityEditable:()=>true,
      canManageOpa:async(req:any)=>req.session.membroId==="director",
    };
    const filter=new Function(...Object.keys(scope),transformSync(code,{loader:"ts"}).code+";return filterObasByAudience;")(...Object.values(scope));
    const records=[{id:"legacy"},{id:"restricted"}];
    assert.deepEqual(await filter({session:{}},records),[{id:"legacy"}]);
    assert.deepEqual(await filter({session:{directusUserId:"different",membroId:"other"}},records),[{id:"legacy"}]);
    assert.deepEqual(await filter({session:{directusUserId:"invited"}},records),records);
    assert.deepEqual(await filter({session:{directusUserId:"pulse-account",membroId:"pulse-member"}},records),records);
    assert.deepEqual(await filter({session:{directusUserId:"manager",membroId:"director"}},records),records);
  } finally {
    await pg.close();
  }
});
