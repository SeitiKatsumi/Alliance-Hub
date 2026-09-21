import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import ts from "typescript";
import { transformSync } from "esbuild";
import express from "express";
import { MAP_HISTORY_SQL, appendMapVersion, assertMapRevision, canCorrectMapBase, canReviewLegacyMapBase, mapBaseContent, mapContentHash, mapRowsFromBase } from "./bia-map-history";
import { calculateInitialMap } from "../shared/member-portfolio";
import { validateInitialClassifications } from "../shared/initial-contributions";

test("MAP Zero legado: rotas reais, revisão explícita, permissões, idempotência e preservação financeira", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.session = req.headers["x-member"] ? { directusUserId: "user", membroId: req.headers["x-member"], role: req.headers["x-member"] === "root" ? "superadmin" : "admin" } : {}; next(); });
  await pg.exec(`CREATE TABLE bia_map_inicial_snapshots (bia_id text PRIMARY KEY);
    CREATE TABLE bia_mou_aceites (bia_id text, membro_id text, mou_versao text, documento text,
      UNIQUE(bia_id,membro_id,mou_versao));
    INSERT INTO bia_mou_aceites VALUES ('bia','d','v1','Documento original');
    CREATE TABLE fluxo_caixa (id int, valor numeric, status text);
    INSERT INTO fluxo_caixa VALUES (1, 500, 'pago');
    CREATE TABLE transferencias_cotas (id int, valor numeric, status text);
    INSERT INTO transferencias_cotas VALUES (1, 100, 'aceita');`);
  await pg.exec(MAP_HISTORY_SQL);
  const bia = { id: "bia", valor_origem: 1000, moeda: "BRL", nome_bia: "Legada", diretor_alianca: "d", aliado_built: "a", situacao: "ativa" };
  let current: any = null;
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
  const functions: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && ["legacyZeroView", "calculateSubmittedInitialMap"].includes(n.name?.text || "")) functions.push(n.getText(ast));
    else ts.forEachChild(n, visit);
  }; visit(ast);
  const routes = source.slice(source.indexOf('  app.get("/api/bias/:id/map-zero-legado"'), source.indexOf('  app.get("/api/bias/:id/map-inicial"'));
  assert.ok(routes.length > 0);
  const scope = { app, db, sql, randomUUID, appendMapVersion, assertMapRevision, canCorrectMapBase, canReviewLegacyMapBase, mapBaseContent, mapContentHash, mapRowsFromBase,
    calculateInitialMap, validateInitialClassifications,
    resolveBiaByIdOrPublicCode: async () => bia, canViewBia: () => true,
    loadInitialMapSnapshot: async () => current,
    mapIsActive: (b: any) => b.situacao === "ativa",
    resolveBiaAccessForRequest: async () => ({ permissions: {} }), hasBiaAccess: () => false,
    requireBiaModuleAccess: async (_req: any, res: any) => { res.status(403).json({error:"Sem permissão"}); return false; },
    draftMapParticipants: async () => [{ memberId: "d", nome: "Diretor", tipo: "guardiao", cargos: ["Diretor"], indiceContribuicao: null, pesoCapital: null }],
    directusFetchOne: async (collection: string, id: string) => collection === "bias_projetos" ? bia : { id, nome: "Diretor" },
    directusFetchScoped: async (collection: string) => { assert.equal(collection, "Tipos_CPP"); return [{id:"capital",Nome:"Capital"},{id:"origem",Nome:"Origem"}]; },
    getMembroResumo: async () => ({ nome: "Diretor" }),
    withMapLock: (_id: string, work: any) => db.transaction(tx => work(tx, current)),
    mapActor: () => ({ memberId: "d", name: "Responsável" }),
  };
  new Function(...Object.keys(scope), transformSync(functions.join("\n") + routes, { loader: "ts" }).code)(...Object.values(scope));
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/bias/bia/map-zero-legado`;
  const input = { valorOrigem: 1000, moeda: "BRL", revisaoEsperada: 0, confirmarRevisao: true, motivo: "Conferido no MOU original",
    participantes: [{ memberId:"d", cargos:["Diretor","Guardião"], tipo:"guardiao", indiceContribuicao:0, capitalComprometido:1000, naturezaCapital:"caixa", tipoCppCapital:{id:"capital"} }] };
  const save = (body = input, member = "d") => fetch(url, {method:"PUT", headers:{"content-type":"application/json",...(member?{"x-member":member}:{})},body:JSON.stringify(body)});
  const before = await pg.query("SELECT * FROM bia_mou_aceites");
  try {
    const draft = await (await fetch(url,{headers:{"x-member":"d"}})).json();
    assert.equal(draft.revisao,0); assert.equal(draft.participantes[0].indiceContribuicao,null);
    assert.equal(draft.participantes[0].capitalComprometido,null);
    assert.equal((await save(input,"")).status,401);
    assert.equal((await save(input,"admin")).status,403);
    assert.equal((await (await fetch(url,{headers:{"x-member":"root"}})).json()).canEdit,true);
    assert.equal((await (await fetch(url,{headers:{"x-member":"admin"}})).json()).canEdit,false);
    assert.equal((await save({...input,confirmarRevisao:false})).status,400);
    assert.equal((await save({...input,motivo:""})).status,400);
    assert.equal((await save({...input,participantes:[...input.participantes,...input.participantes]})).status,400);
    assert.equal((await save({...input,participantes:[{...input.participantes[0],indiceContribuicao:null as any}]})).status,400);
    const firstResponse = await save(input, "root"); const first = await firstResponse.json();
    assert.equal(firstResponse.status,200, JSON.stringify(first));
    assert.equal(first.revisao,1); assert.equal(first.historicoLegado,true);
    assert.equal((await (await save()).json()).id,first.id);
    const changed = {...input, participantes:[{...input.participantes[0],indiceContribuicao:1,tipoCppContribuicao:{id:"origem"}}]};
    assert.equal((await save(changed)).status,409);
    assert.equal((await (await save({...changed,revisaoEsperada:1},"a")).json()).revisao,2);
    assert.equal((await pg.query("SELECT * FROM bia_map_versoes")).rows.length,2);
    assert.equal((await pg.query("SELECT * FROM bia_map_inicial_snapshots")).rows.length,0);
    assert.deepEqual((await pg.query("SELECT * FROM bia_mou_aceites")).rows,before.rows);
    assert.equal((await pg.query<any>("SELECT * FROM fluxo_caixa")).rows[0].status,"pago");
    assert.equal((await pg.query<any>("SELECT * FROM transferencias_cotas")).rows[0].status,"aceita");
    assert.equal((await pg.query<any>("SELECT snapshot FROM bia_map_versoes WHERE id=$1",[first.id])).rows[0].snapshot.base.participantes[0].indiceContribuicao,0);
    current={id:"new-model"};
    assert.equal((await save()).status,409);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); await pg.close(); }
});
