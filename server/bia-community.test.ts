import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBiaCommunitySync } from "./bia-community";
import { createDirectusBiaCommunitySync } from "./bia-community-directus";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { transformSync } from "esbuild";
import { STRATEGIC_CELL_TYPES } from "../shared/strategic-cells";

function harness() {
  const bias = new Map<string, any>([["bia-a", { id: "bia-a", autor_bia: { id: "author-a" } }], ["bia-b", { id: "bia-b", autor_bia: "author-b" }]]);
  const mothers = new Map<string, any>([["author-a", 5], ["author-b", "8"]]);
  const links = new Set<string>(["bia-a:extra"]);
  const queues = new Map<string, Promise<unknown>>();
  let writes = 0;
  let fail = false;
  let timeoutAfterCommit = false;
  const service = createBiaCommunitySync({
    lock: async (id, work) => {
      const pending = (queues.get(id) || Promise.resolve()).catch(() => {}).then(work);
      queues.set(id, pending); return pending;
    },
    bia: async id => bias.get(id) || null,
    mother: async id => mothers.get(id),
    communityExists: async id => ["5", "8", "12"].includes(id),
    linked: async (id, community) => links.has(`${id}:${community}`),
    append: async (id, community) => {
      writes++;
      if (fail) throw new Error("Unavailable");
      links.add(`${id}:${community}`);
      if (timeoutAfterCommit) throw new Error("Timeout");
    },
    list: async author => [...bias.values()].filter(b => !author || (typeof b.autor_bia === "object" ? b.autor_bia?.id : b.autor_bia) === author),
  });
  return { service, bias, mothers, links, writes: () => writes, fail: (v: boolean) => { fail = v; }, timeout: () => { timeoutAfterCommit = true; } };
}

test("BIAs de autores de comunidades diferentes recebem suas próprias mães, preservando vínculos extras", async () => {
  const h = harness();
  const result = await h.service.reconcile();
  assert.equal(result.linked, 2); assert.deepEqual(result.failed, []);
  assert.deepEqual([...h.links], ["bia-a:extra", "bia-a:5", "bia-b:8"]);
  await Promise.all(Array.from({ length: 12 }, () => h.service.sync("bia-a")));
  assert.equal(h.writes(), 2);
  assert.equal((await h.service.reconcile()).linked, 0);
});

test("troca da mãe/autor adiciona vínculo atual sem retirar origem ou adivinhar autor ausente", async () => {
  const h = harness();
  await h.service.reconcile();
  h.mothers.set("author-a", "12");
  assert.equal((await h.service.reconcile("author-a")).linked, 1);
  assert.ok(h.links.has("bia-a:5")); assert.ok(h.links.has("bia-a:12"));
  h.bias.set("bia-a", { id: "bia-a", autor_bia: "author-b" });
  assert.equal((await h.service.sync("bia-a")).communityId, "8");
  h.bias.set("bia-a", { id: "bia-a", autor_bia: null, aliado_built: "author-a", criador_id: "author-a" });
  assert.equal((await h.service.sync("bia-a")).status, "missing_author");
  h.mothers.delete("author-b");
  assert.equal((await h.service.sync("bia-b")).status, "missing_mother");
});

test("falha parcial é relatada e retomável; timeout após gravação não duplica vínculo", async () => {
  const h = harness(); h.fail(true);
  const failed = await h.service.reconcile();
  assert.deepEqual(failed.failed, ["bia-a", "bia-b"]); assert.equal(failed.linked, 0);
  h.fail(false); h.timeout();
  const retried = await h.service.reconcile();
  assert.equal(retried.linked, 2); assert.deepEqual(retried.failed, []);
  await h.service.reconcile(); assert.equal(h.writes(), 4);
  h.mothers.set("author-a", "invalid");
  await assert.rejects(h.service.sync("bia-a"), /indisponível/);
});

test("adaptador usa lock SQL e POST somente da linha M2M, confirma resposta desconhecida e pagina o lote", async () => {
  const calls: Array<{ path: string; body?: any }> = [];
  const rows: any[] = [];
  let locks = 0;
  const db = {
    transaction: async (work: any) => { locks++; return work({ execute: async () => ({ rows: [{ comunidade_id: "5" }] }) }); },
    execute: async () => { throw new Error("Must reuse transaction connection instead of exhausting the pool"); },
  };
  const transport = (async (url: any, options: any) => {
    const u = new URL(url); const body = options.body && JSON.parse(options.body);
    calls.push({ path: u.pathname + u.search, body });
    let data: any = [];
    if (u.pathname.endsWith("bias_projetos")) {
      if (u.searchParams.has("filter[id][_eq]")) data = [{ id: "bia", autor_bia: { id: "author" } }];
      else if (u.searchParams.get("offset") === "0") data = Array.from({ length: 200 }, (_, i) => ({ id: String(i) }));
      else data = [];
    } else if (u.pathname.endsWith("Comunidade")) data = [{ id: 5 }];
    else if (body) { rows.push(body); throw new Error("lost response"); }
    else data = rows;
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof fetch;
  const service = createDirectusBiaCommunitySync(db, { url: "https://directus.test", token: "test", communityCollection: async () => "Comunidade", fetch: transport });
  assert.equal((await service.sync("bia")).status, "linked");
  assert.equal(locks, 1);
  assert.deepEqual(calls.filter(c => c.body).map(c => c.body), [{ comunidade_id: "5", bias_projetos_id: "bia" }]);
  assert.ok(calls.every(c => !c.body || c.path === "/items/comunidade_bias"));
  // Pagination is exercised without an external service or real data.
  await service.reconcile("author");
  assert.ok(calls.some(c => c.path.includes("offset=200")));
  assert.ok(calls.some(c => c.path.includes("filter%5Bautor_bia%5D%5B_eq%5D=author")));
});

test("remoção autorizada e rollback limpam somente vínculos da BIA sob o mesmo lock da conciliação", async () => {
  const calls: string[] = [];
  let locked = false;
  const service = createDirectusBiaCommunitySync({
    transaction: async (work: any) => { locked = true; try { return await work({ execute: async () => {} }); } finally { locked = false; } },
  }, {
    url: "https://directus.test", token: "test", communityCollection: async () => "Comunidade",
    fetch: (async (url: any, options: any) => {
      assert.ok(locked);
      const u = new URL(url);
      calls.push(`${options.method} ${u.pathname}`);
      if (options.method === "DELETE") return new Response(null, { status: 204 });
      assert.equal(u.searchParams.get("filter[bias_projetos_id][_eq]"), "bia-delete");
      return new Response(JSON.stringify({ data: [{ id: 7 }, { id: 8 }] }));
    }) as typeof fetch,
  });
  await service.remove("bia-delete");
  assert.deepEqual(calls, ["GET /items/comunidade_bias", "DELETE /items/comunidade_bias/7", "DELETE /items/comunidade_bias/8", "DELETE /items/bias_projetos/bia-delete"]);
});

test("integração cobre todos os criadores, troca de autor/mãe, células e validação de demanda sem ampliar acesso", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  assert.match(routes, /collection === "bias_projetos" && json\.data\?\.id\) \{\s*if \(await syncBiaMotherAfterWrite/);
  assert.match(routes, /Object\.hasOwn\(data, "autor_bia"\)\s*\? await syncBiaMotherAfterWrite/);
  assert.match(routes, /biaCommunitySync\?\.reconcile\(membroId\)/);
  assert.match(routes, /collection === "bias_projetos" && biaCommunitySync\) return biaCommunitySync.remove\(id\)/);
  const helper = routes.slice(routes.indexOf("async function communityIdsForBia"), routes.indexOf("async function recordStrategicCellEvent"));
  assert.match(helper, /await biaCommunitySync\?\.sync\(biaId\)/);
  assert.match(helper, /communityIdsForBia\(biaId\)/);
  assert.doesNotMatch(helper, /catch\(\(\) => \[\]\)/);
  const endpoint = routes.slice(routes.indexOf('app.get("/api/bias/:id/celulas-disponiveis"'), routes.indexOf('app.get("/api/comunidades/:id/celulas"'));
  assert.match(endpoint, /requireBiaModuleAccess\(req, res, req.params.id, "configuracao_bia", "view"\)/);
  assert.match(endpoint, /communityIdsForBia\(String\(authorization.bia.id\)\)/);
  assert.match(endpoint, /AND \(t.status = 'ACTIVE' OR t.code = 'INVESTMENT_CAPITAL'\)/);
  const component = readFileSync(new URL("../client/src/components/bia-demandas.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /response\.ok \? response\.json\(\) : \[\]/);
  assert.match(component, /cellsQuery.isError/);
});

test("consulta real de Células inclui Investimento e Capital ativo, sem liberar outra comunidade ou tipos retirados", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  try {
    await pg.exec(`CREATE TABLE strategic_cell_types(id text,code text,status text,public_name text,short_description text,display_order int);
      CREATE TABLE strategic_cells(id text,community_id text,name text,description text,status text,strategic_cell_type_id text);
      CREATE TABLE strategic_cell_markets(strategic_cell_type_id text,code text,status text,public_name text,display_order int);`);
    for (const [order, type] of [...STRATEGIC_CELL_TYPES, {code:"INVESTMENT_CAPITAL",publicName:"Investimento e Capital"}].entries()) {
      await db.execute(sql`INSERT INTO strategic_cell_types VALUES (${type.code},${type.code},${type.code === "INVESTMENT_CAPITAL" ? "ARCHIVED" : "ACTIVE"},${type.publicName},'',${order})`);
      await db.execute(sql`INSERT INTO strategic_cells VALUES (${type.code},'5',${type.publicName},'','ACTIVE',${type.code})`);
    }
    await pg.exec(`INSERT INTO strategic_cell_types VALUES('retired','OTHER_RETIRED','ARCHIVED','Retirada','',7);
      INSERT INTO strategic_cells VALUES('retired','5','Retirada','','ACTIVE','retired'),('foreign','99','Outra comunidade','','ACTIVE','INVESTMENT_CAPITAL'),('inactive','5','Inativa','','SUSPENDED','INVESTMENT_CAPITAL');`);
    const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const route = source.slice(source.indexOf('app.get("/api/bias/:id/celulas-disponiveis"'), source.indexOf('app.get("/api/comunidades/:id/celulas"'));
    let handler: any, authorized = true, communityReads = 0;
    const scope = {
      app: { get: (_: string, fn: any) => { handler = fn; } }, db, sql,
      requireBiaModuleAccess: async (_req: any, res: any) => {
        if (!authorized) { res.status(403).json({error:"Sem acesso"}); return null; }
        return {bia:{id:"canonical-bia"}};
      },
      ensureStrategicCellTables: async () => {}, ensureCommunityStrategicCells: async () => {},
      communityIdsForBia: async (id: string) => { assert.equal(id,"canonical-bia"); communityReads++; return ["5"]; },
      sqlTextArray: (ids: string[]) => sql`ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::text[]`,
    };
    new Function(...Object.keys(scope), transformSync(route,{loader:"ts"}).code)(...Object.values(scope));
    const call = async () => {
      let status = 200, body: any;
      const res = {status:(value:number)=>{status=value;return res;},json:(value:any)=>{body=value;return res;}};
      await handler({params:{id:"PUBLICCODE"}},res); return {status,body};
    };
    const result = await call();
    assert.equal(result.status,200); assert.equal(result.body.length,6);
    assert.ok(result.body.some((cell:any)=>cell.type_code === "INVESTMENT_CAPITAL"));
    assert.ok(result.body.every((cell:any)=>cell.community_id === "5" && cell.id !== "retired" && cell.id !== "inactive"));
    authorized = false; assert.equal((await call()).status,403); assert.equal(communityReads,1);
  } finally { await pg.close(); }
});
