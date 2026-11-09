import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { sql } from "drizzle-orm";
import { BUILT_VALUATION_VERSION, sanitizeValuationAreas, valuationObservationReason } from "../shared/property-valuation";
import { normalizePropertyCib } from '../shared/property-cib';
test("relatório autoriza leitura antes de consultar histórico e não expõe atores ou dados privados da entrada", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const a = source.indexOf('  app.get("/api/carteira/imoveis/:id/avaliacao"');
  const code = source.slice(a, source.indexOf('  app.post("/api/carteira/imoveis/:id/avaliacao/pesquisar"', a));
  let handler: any, allowed = false, reads = 0, response: any, status = 200;
  const scope = { app: { get: (_path: string, h: any) => handler = h }, sql, BUILT_VALUATION_VERSION, valuationObservationReason,
    requireCarteiraActor: () => ({ userId: "reader" }), requireCarteiraAccess: async (id: string, _actor: any, level: string) => {
      assert.equal(id, "own"); assert.equal(level, "leitura"); if (!allowed) throw Object.assign(new Error("negado"), { status: 403 }); return { imovel: { id } };
    }, loadPortfolioMarketAnalyses: async (ids: string[]) => { assert.deepEqual(ids, ["own"]); return new Map(); },
    portfolioMarketEstimate: () => ({ status: "sem_amostra", moeda: "BRL" }),
    db: { execute: async () => { reads++; return { rows: [{ criado_em: "2026-10-01", versao_regra: "old", entrada: { email: "private", fingerprint: "old" }, resultado: { valor_estimado: 123, moeda: "BRL" }, criado_por_user_id: "private" }] }; } } };
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code)(...Object.values(scope));
  const res = { status: (s: number) => { status = s; return res; }, json: (body: any) => response = body };
  await handler({ params: { id: "own" } }, res); assert.equal(status, 403); assert.equal(reads, 0);
  allowed = true; await handler({ params: { id: "own" } }, res); assert.equal(reads, 1); assert.equal(response.historico[0].valor, 123);
  assert.doesNotMatch(JSON.stringify(response), /private|email|criado_por/);
});
test("sanitizador usado por criação, edição e assistente mantém medidas distintas em JSON", () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const a = source.indexOf("  function sanitizeInventarioImovel(");
  const code = source.slice(a, source.indexOf("  function sanitizeInventarioLancamento", a));
  const run = new Function("sanitizeValuationAreas", "validatePropertyGoal", "normalizePropertyCib", transformSync(code, { loader: "ts" }).code + ";return sanitizeInventarioImovel;")(sanitizeValuationAreas, (s: string) => s, normalizePropertyCib);
  const old = run({ area_m2: 900 }, {}, "a"); assert.equal(old.area_m2, 900); assert.equal(old.area_construida_m2, null);
  const saved = run({ ...old, area_construida_m2: "120,5", area_terreno_m2: 900, area_avaliacao_tipo: "construida" }, {}, "a");
  assert.equal(Object.hasOwn(saved, "areas_fonte"), false);
  assert.equal(run({ ...saved, areas_fonte: "Planta antiga" }, {}, "a").areas_fonte, "Planta antiga");
  assert.equal(saved.area_construida_m2, 120.5); assert.equal(saved.area_terreno_m2, 900); assert.equal(saved.area_m2, 900);
  assert.equal(run(saved, {}, "a").area_construida_m2, 120.5);
});
