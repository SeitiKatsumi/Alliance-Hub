import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { transformSync } from "esbuild";
import express from "express";
import { MAP_HISTORY_SQL, appendMapVersion, assertMapRevision, canCorrectMapBase, mapBaseContent, mapContentHash, mapRowsFromBase } from "./bia-map-history";
import { calculateInitialMap, calculateMap, MAP_DYNAMIC_FOOTER } from "../shared/member-portfolio";
import { INITIAL_CONTRIBUTIONS_SQL, assertInitialCommitmentsCompatible } from "./initial-contributions";
import { validateInitialClassifications } from "../shared/initial-contributions";

test("rotas reais: permissões, revisão, não alteração do caixa, aceites antigos e falha de fonte", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  const app = express(); app.use(express.json());
  const context = new AsyncLocalStorage<any>();
  // PGlite has one connection. Model the separately committed Directus outbox
  // in memory; revisions, locks, acceptances and rollback still use SQL.
  const durableEvents: any[] = [];
  const dialect = new PgDialect();
  const execute = (executor: any) => async (statement: any) => {
    const query = dialect.sqlToQuery(statement);
    if (query.sql.includes("bia_map_eventos")) {
      if (query.sql.includes("INSERT INTO")) {
        const [bia_id, motivo, autor, antes] = query.params;
        const event = {id:randomUUID(),bia_id,motivo,autor:JSON.parse(String(autor)),antes:JSON.parse(String(antes)),concluido_em:null};
        durableEvents.push(event); return {rows:[event]};
      }
      if (query.sql.includes("UPDATE")) { durableEvents.find(e=>e.id===query.params[0]).concluido_em = true; return {rows:[]}; }
      return {rows:durableEvents.filter(e=>!e.concluido_em && e.bia_id===query.params[0])};
    }
    return executor.execute(statement);
  };
  const testDb = {execute:execute(db), transaction:(work:any)=>db.transaction(tx=>work({execute:execute(tx)}))};
  app.use((req: any, _res, next) => {
    req.session = req.headers["x-member"] ? { directusUserId: "user", membroId: req.headers["x-member"], nome: "Responsável" } : {};
    context.run({ req }, next);
  });
  const input = { valorOrigem: 1000, moeda: "BRL", participantes: [{ memberId: "d", nome: "Diretor", cargos: ["Diretor"], tipo: "guardiao", indiceContribuicao: 0, pesoCapital: 100 }] };
  const calculation = calculateInitialMap(input.valorOrigem, input.participantes as any);
  const bia = { id: "bia", nome_bia: "BIA Teste", diretor_alianca: "d", aliado_built: "a", situacao: "ativa" };
  const notifications: number[] = [];
  let sourceFails = false;
  let failAfterWrite = false;
  let entries: any[] = [];
  const transfers: any[] = [];
  await pg.exec(`CREATE TABLE bia_map_inicial_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text UNIQUE, origem_id uuid,
    status text DEFAULT 'rascunho', valor_origem numeric, moeda text, divisor_multiplicador numeric, base_economica_inicial numeric,
    participantes jsonb, snapshot_hash text, criado_em timestamp DEFAULT now(), atualizado_em timestamp DEFAULT now(), bloqueado_em timestamp,
    bloqueado_por_user_id text, bloqueado_por_membro_id text);
    CREATE TABLE bia_mou_aceites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text, membro_id text, mou_versao text, mou_titulo text,
    dados_contratuais jsonb, aceite_localizacao jsonb, map_inicial_snapshot_id text, map_inicial_hash text, aceito_em timestamp DEFAULT now(), UNIQUE(bia_id,membro_id,mou_versao));
    CREATE TABLE fluxo_caixa (id text);`);
  await pg.exec(MAP_HISTORY_SQL);
  await pg.exec(INITIAL_CONTRIBUTIONS_SQL);
  await db.execute(sql`INSERT INTO bia_map_inicial_snapshots (bia_id, valor_origem, moeda, divisor_multiplicador, base_economica_inicial, participantes, revisao, ativado_em)
    VALUES ('bia',1000,'BRL',0,1000,${JSON.stringify(calculation.participantes)}::jsonb,1,now())`);
  const stored: any = (await db.execute(sql`SELECT * FROM bia_map_inicial_snapshots`)).rows[0];
  await db.transaction(tx => appendMapVersion(tx, { biaId: "bia", tipo: "zero", base: stored, rows: mapRowsFromBase(stored), eventId: "creation", reason: "Criação", actor: {}, biaName: bia.nome_bia, footer: "" }));
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const parsed = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
  const functions = new Map<string, string>();
  const visit = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(parsed)); ts.forEachChild(node, visit); };
  visit(parsed);
  const names = ["withMapLock", "mapActor", "mapIsActive", "archiveMapBase", "captureCurrentMap", "reconcilePendingMapEvents", "initialMapHash", "initialMapSnapshotView", "loadInitialMapSnapshot", "createMouAcceptanceWithInitialMap", "hasBiaMouAceito", "ensureMouAceitoOuRetornaPendencia"];
  names.push("calculateSubmittedInitialMap", "buildSimpleTextPdf", "normalizePdfText", "pdfHex", "wrapPdfLine", "splitPdfParagraphs", "emphasizeMouPdfText", "parsePdfInlineRuns", "formatPdfMoney", "formatPdfPercent");
  const start = source.indexOf('  app.put("/api/bias/:id/map-inicial"');
  const route = source.slice(start, source.indexOf('  app.get("/api/bias/:id/map"', start));
  const getMap = async (_bia: any, _id: string, options: any) => {
    if (sourceFails) throw new Error("Fonte indisponível");
    return calculateMap((options.entries || entries).map((e: any) => ({memberId: "d", value: e.valor, status: e.status})), transfers, mapRowsFromBase(options.base), true);
  };
  const scope: Record<string, any> = {
    app, db:testDb, sql, mapOperationContext: context, ensureBiaMapInicialSnapshotsTable: async () => {},
    appendMapVersion, assertMapRevision, canCorrectMapBase, mapBaseContent, mapContentHash, mapRowsFromBase,
    createHash, randomUUID, calculateInitialMap, MAP_DYNAMIC_FOOTER, assertInitialCommitmentsCompatible, validateInitialClassifications,
    directusFetchOne: async (collection: string, id: string) => collection === "fluxo_caixa" ? entries.find(e => e.id === id) : collection === "cadastro_geral" ? {id,nome:"Diretor"} : bia, resolveBiaByIdOrPublicCode: async () => bia,
    directusFetchScoped: async (collection:string) => collection==="Tipos_CPP" ? [{id:"capital",Nome:"CPP Capital"},{id:"lead",Nome:"CPP Liderança"}] : entries, directusRelationId: (v: any) => v?.id || v,
    canViewBia: (_bia: any, req: any) => !!req.session.membroId,
    loadMouLogoForPdf: () => null, loadMouAssetPngForPdf: () => null,
    biaFormalParticipantIds: () => ["d"],
    changeEntry: (id: string, data: any) => { entries = entries.filter(e => e.id !== id); if (data) entries.push({id, ...data, bia:"bia"}); if (failAfterWrite) sourceFails = true; return {ok:true}; },
    requireBiaModuleAccess: async (req: any, res: any) => { if (req.session.membroId !== "d") { res.status(403).json({ error: "Negado" }); return false; } return true; },
    getMembroResumo: async (id: string) => ({ id, nome: "Diretor" }),
    getBiaAllocationMap: getMap, notifyMapRevision: async (_tx: any, _bia: any, base: any) => notifications.push(base.revisao),
    directusUpdate: async () => ({}), ensureVitrineFields: async () => {}, pickBiaDadosContratuaisCadastro: () => ({}),
    BIA_MOU_VERSAO: "mou1", BIA_MOU_TITULO: "MOU", getCapturedAcceptanceLocation: (value: any) => value,
    validateBiaMouDadosContratuais: (value: any) => ({ ok: true, data: value }), ACCEPTANCE_LOCATION_REQUIRED_ERROR: "Localização obrigatória",
    getBiaMouTextoPersonalizado: async () => `MOU apresentado, revisão ${(await (context.getStore()?.tx || db).execute(sql`SELECT revisao FROM bia_map_inicial_snapshots WHERE bia_id='bia'`)).rows[0].revisao}`,
  };
  const activation = source.slice(source.indexOf("  mapBiaActivation = "), source.indexOf("  async function draftMapParticipants"));
  const financial = source.slice(source.indexOf("  mapFinancialWrite = async"), source.indexOf("  const initialContributions ="));
  const detailRoute = source.slice(source.indexOf('  app.get(["/api/bias/:id/map/versoes/'), source.indexOf("  function prepareBiaPayload"));
  const code = "let mapFinancialWrite, mapBiaActivation;\n" + names.map(n => functions.get(n)).join("\n") + "\n" + activation + financial + route + detailRoute + `
    app.post('/entry/:id', async(req,res)=>{try { res.json(await mapFinancialWrite('fluxo_caixa',req.params.id,req.body,async()=>changeEntry(req.params.id,req.body))); } catch(e) {res.status(500).json({error:e.message});} });
    app.post('/activate', async(_req,res)=>{try { res.json(await mapBiaActivation('bia',{situacao:'ativa'},async()=>({ok:true}))); }catch(e){res.status(e.statusCode || 500).json({error:e.message});} });
    app.post('/accept', async (req,res) => { try { const result = await ensureMouAceitoOuRetornaPendencia('bia', req.session.membroId, true, {nome:'Participante de teste'}, {evidence:'test'}, 'user'); res.status(result.ok ? 200 : result.statusCode || 409).json(result); } catch(e) {res.status(e.statusCode || 500).json({error:e.message});} });
    app.get('/accepted', async (_req,res) => res.json({accepted:await hasBiaMouAceito('bia','d')}));`;
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts", target: "es2022" }).code)(...Object.values(scope));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const save = (body: any, member = "d") => fetch(`${url}/api/bias/bia/map-inicial`, { method: "PUT", headers: { "content-type": "application/json", ...(member ? { "x-member": member } : {}) }, body: JSON.stringify(body) });
  const sign = (revision: number, member = "d") => fetch(`${url}/accept`, { method: "POST", headers: { "content-type": "application/json", "x-member": member }, body: JSON.stringify({ map_revisao: revision }) });
  const change = { ...input, participantes: [{ ...input.participantes[0], indiceContribuicao: 10 }], revisaoEsperada: 1, motivo: "Correção conferida" };
  try {
    assert.equal((await save(change, "")).status, 401);
    assert.equal((await save(change, "superadmin")).status, 403);
    assert.equal((await save({ ...change, motivo: "" })).status, 400);
    assert.equal((await save({ ...change, revisaoEsperada: 0 })).status, 409);
    sourceFails = true;
    assert.equal((await save(change)).status, 400);
    assert.equal((await pg.query<any>("SELECT revisao FROM bia_map_inicial_snapshots")).rows[0].revisao, 1);
    sourceFails = false;
    const success = await save(change); assert.equal(success.status, 200, await success.clone().text());
    assert.equal((await success.json()).revisao, 2);
    assert.equal((await save({ ...change, revisaoEsperada: 2 })).status, 200);
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_map_versoes")).rows[0].n, 3);
    assert.deepEqual(notifications, [2]);
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM fluxo_caixa")).rows[0].n, 0);
    const initialVersion = (await pg.query<any>("SELECT id FROM bia_map_versoes WHERE tipo='zero' ORDER BY numero LIMIT 1")).rows[0].id;
    const pdf = async () => { const response = await fetch(`${url}/api/bias/bia/map/versoes/${initialVersion}/pdf`, {headers:{"x-member":"d"}}); assert.equal(response.status,200, await response.clone().text()); return Buffer.from(await response.arrayBuffer()); };
    const originalPdf = await pdf();
    assert.equal(originalPdf.subarray(0,5).toString(), "%PDF-");
    assert.equal((await fetch(`${url}/api/bias/bia/map/versoes/${initialVersion}/pdf`)).status, 403);
    const entry = (status: string, valor = 100) => fetch(`${url}/entry/e`, {method:"POST",headers:{"content-type":"application/json","x-member":"d"},body:JSON.stringify({bia:"bia",status,valor})});
    const versionCount = async () => (await pg.query<any>("SELECT count(*)::int n FROM bia_map_versoes WHERE tipo='atual'")).rows[0].n;
    assert.equal((await entry("pendente")).status, 200);
    assert.equal(await versionCount(), 1);
    assert.equal((await entry("pago")).status, 200);
    assert.equal(await versionCount(), 2);
    assert.equal((await entry("pago")).status, 200);
    assert.equal(await versionCount(), 2);
    failAfterWrite = true;
    assert.equal((await entry("pago",200)).status, 500);
    assert.equal(await versionCount(), 2);
    assert.equal(durableEvents.filter(e=>!e.concluido_em).length, 1);
    failAfterWrite = false; sourceFails = false;
    assert.equal((await entry("pago",200)).status, 200);
    assert.equal(await versionCount(), 3);
    assert.equal(durableEvents.filter(e=>!e.concluido_em).length, 0);
    assert.equal((await entry("cancelado",200)).status, 200);
    assert.equal(await versionCount(), 4);
    bia.situacao = "em_formacao";
    await pg.exec("UPDATE bia_map_inicial_snapshots SET ativado_em=NULL");
    assert.equal((await sign(1)).status, 409);
    const signed = await sign(2); assert.equal(signed.status, 200, await signed.clone().text());
    assert.equal((await sign(2)).status, 200);
    const evidence: any = (await pg.query<any>("SELECT * FROM bia_mou_aceites")).rows[0];
    const next = await save({ ...change, valorOrigem: 2000, revisaoEsperada: 2 });
    assert.equal(next.status, 200, await next.clone().text());
    assert.equal((await (await fetch(`${url}/accepted`)).json()).accepted, false);
    assert.deepEqual((await pg.query<any>("SELECT * FROM bia_mou_aceites")).rows[0], evidence);
    assert.equal((await sign(2)).status, 409);
    assert.equal((await fetch(`${url}/activate`, {method:"POST"})).status, 409);
    assert.equal((await sign(3)).status, 200);
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_mou_aceites")).rows[0].n, 2);
    transfers.push({ fromMemberId: "d", toMemberId: "other", status: "aceita", value: 2100 });
    const impossible = await save({ ...change, revisaoEsperada: 3 });
    assert.equal(impossible.status, 400);
    assert.equal((await pg.query<any>("SELECT revisao FROM bia_map_inicial_snapshots")).rows[0].revisao, 3);
    transfers.length = 0;
    const concurrent = await Promise.all([save({...change,valorOrigem:2300,revisaoEsperada:3}),sign(3)]);
    assert.equal(concurrent[0].status, 200);
    assert.ok([200,409].includes(concurrent[1].status));
    assert.equal((await fetch(`${url}/activate`, {method:"POST"})).status, 409);
    assert.equal((await sign(4)).status, 200);
    assert.equal((await fetch(`${url}/activate`, {method:"POST"})).status, 200);
    assert.deepEqual(await pdf(), originalPdf);
    // New-model route, alongside the legacy fixture: exact capital and canonical CPP names.
    await pg.exec("UPDATE bia_map_inicial_snapshots SET modelo_calculo=3");
    const model3={...change,valorOrigem:2300,revisaoEsperada:4,participantes:[{...change.participantes[0],capitalComprometido:2300,naturezaCapital:"caixa",tipoCppCapital:{id:"capital",nome:"Nome manipulado"},tipoCppContribuicao:{id:"lead"}}]};
    const newModel=await save(model3);assert.equal(newModel.status,200,await newModel.clone().text());
    const newView=await newModel.json();assert.equal(newView.modeloCalculo,3);
    assert.equal(newView.participantes[0].tipoCppCapital.nome,"CPP Capital");
    assert.equal(newView.participantes[0].cppCapital,2300);
    assert.equal((await save({...model3,revisaoEsperada:5,participantes:[{...model3.participantes[0],capitalComprometido:""}]})).status,400);
    assert.equal((await sign(5)).status,200);
    assert.deepEqual(await pdf(),originalPdf,"PDF antigo imutável após nova classificação");
    // A second participant with zero DM still signs: neither zero value nor another person's acceptance bypasses the gate.
    await pg.exec("UPDATE bia_map_inicial_snapshots SET ativado_em=NULL");
    const twoParticipants = await save({...model3,revisaoEsperada:5,participantes:[...model3.participantes,
      {memberId:"m",nome:"Multiplicador",tipo:"multiplicador",indiceContribuicao:0,pesoCapital:0,capitalComprometido:0,naturezaCapital:"caixa"}]});
    assert.equal(twoParticipants.status,200,await twoParticipants.clone().text());
    assert.equal((await sign(6)).status,200);
    assert.equal((await fetch(`${url}/activate`,{method:"POST"})).status,409);
    assert.equal((await sign(5,"m")).status,409);
    assert.equal((await sign(6,"m")).status,200);
    assert.equal((await sign(6,"m")).status,200);
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM bia_mou_aceites WHERE membro_id='m' AND map_revisao=6")).rows[0].n,1);
    assert.equal((await fetch(`${url}/activate`,{method:"POST"})).status,200);
    assert.deepEqual(await pdf(),originalPdf);
    assert.equal((await pg.query<any>("SELECT count(*)::int n FROM fluxo_caixa")).rows[0].n,0);
  } finally { await new Promise<void>(r => server.close(() => r())); await pg.close(); }
});
