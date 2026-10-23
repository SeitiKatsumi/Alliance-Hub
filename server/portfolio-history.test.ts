import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { portfolioHistory, portfolioHistoryScope } from "./portfolio-history";
import { portfolioDashboard } from "../shared/portfolio-dashboard";
import { transformSync } from "esbuild";

test("histórico SQL isola conta, membro e escopo, atualiza só o dia observado e GET não escreve", async () => {
  const pg = new PGlite(); const db = drizzle(pg);
  try {
    const actor = { userId: "owner", membroId: "member" };
    assert.equal((await portfolioHistory(db, actor, "scope", null)).available, false);
    await pg.exec(readFileSync(new URL("../migrations/20261022_portfolio_history.sql", import.meta.url), "utf8"));
    const metrics = portfolioDashboard([], []);
    assert.equal((await portfolioHistory(db, actor, "scope", null, metrics)).observations.length, 1);
    await portfolioHistory(db, actor, "scope", null, metrics);
    assert.equal((await pg.query<any>("SELECT count(*)::int AS n FROM carteira_patrimonio_observacoes")).rows[0].n, 1);
    const legacy = { ...metrics, propertyEstimate: { value: 15000000, min: 10000000, max: 20000000, included: 1, total: 1, partial: false, indicative: true } };
    await pg.query("UPDATE carteira_patrimonio_observacoes SET metrics=$1::jsonb", [JSON.stringify(legacy)]);
    const filtered = await portfolioHistory(db, actor, "scope", null);
    assert.equal(filtered.observations[0].metrics.propertyEstimate.value, null);
    assert.deepEqual(filtered.observations[0].metrics.acquisition, metrics.acquisition);
    assert.deepEqual(filtered.observations[0].metrics.cppEstimate, metrics.cppEstimate);
    assert.equal((await pg.query<any>("SELECT metrics FROM carteira_patrimonio_observacoes")).rows[0].metrics.propertyEstimate.value, 15000000); // read-only, original audit evidence retained.
    await portfolioHistory(db, actor, "scope", null, metrics);
    assert.deepEqual((await portfolioHistory(db, actor, "scope", null)).observations[0].metrics.propertyEstimate, metrics.propertyEstimate);
    for (const candidate of [{ userId: "other", membroId: "member" }, { userId: "owner", membroId: "other" }]) assert.equal((await portfolioHistory(db, candidate, "scope", null)).observations.length, 0);
    assert.equal((await portfolioHistory(db, actor, "revoked", null)).observations.length, 0);
    assert.equal((await portfolioHistory(db, actor, "scope", "2099-01-01")).observations.length, 0);
    await assert.rejects(portfolioHistory(db, { userId: null, membroId: null }, "scope", null));
    await pg.exec("DROP TABLE carteira_patrimonio_observacoes");
    assert.equal((await portfolioHistory(db, actor, "scope", null)).available, false);
  } finally { await pg.close(); }
});
test("mudança de vínculo, moeda ou fração não mostra agregado antigo; ordem não muda escopo", () => {
  const a = { id: "a", participacao_percentual: 50, access_level: "leitura", moeda: "BRL" }, b = { id: "b" };
  const scope = portfolioHistoryScope([a, b], []);
  assert.equal(scope, portfolioHistoryScope([b, a], []));
  assert.notEqual(scope, portfolioHistoryScope([{ ...a, participacao_percentual: 25 }, b], []));
  assert.notEqual(scope, portfolioHistoryScope([b], []));
});

test("rotas reais do histórico autorizam antes das fontes e ignoram valores enviados pelo cliente", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const start = source.indexOf("  async function carteiraEvolution(");
  const code = source.slice(start, source.indexOf('  app.get("/api/carteira/imoveis"', start));
  const handlers = new Map<string, any>(); let allowed = false, reads = 0, writes = 0, status = 200;
  const metrics = portfolioDashboard([], []);
  const scope = { app: { get: (_p: string, fn: any) => handlers.set("get", fn), post: (_p: string, fn: any) => handlers.set("post", fn) },
    requireCarteiraActor: () => { if (!allowed) throw Object.assign(new Error("não autenticado"), { status: 401 }); return { userId: "owner", membroId: "member" }; },
    buildCarteiraResumo: async () => { reads++; return { imoveis: [], aliancas: [], dashboard: metrics }; },
    portfolioHistoryScope, db: {}, portfolioHistory: async (_db: any, _actor: any, _scope: string, _since: any, recorded: any) => { if (recorded) { writes++; assert.deepEqual(recorded, metrics); } return { available: true, observations: [] }; } };
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code)(...Object.values(scope));
  const req = { query: {}, body: { metrics: { acquisition: 999999 } } }, res: any = { status: (value: number) => { status = value; return res; }, json: () => {} };
  await handlers.get("post")(req, res); assert.equal(status, 401); assert.equal(reads, 0); assert.equal(writes, 0);
  allowed = true; await handlers.get("get")(req, res); assert.equal(writes, 0);
  await handlers.get("post")(req, res); assert.equal(writes, 1);
});
