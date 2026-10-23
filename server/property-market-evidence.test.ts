import test from "node:test";
import assert from "node:assert/strict";
import { groundedMarketComparables, propertyMarketFingerprint, confirmedMarketEvidence, marketRetryDelay, researchIndicativePropertyValue, INDICATIVE_MARKET_METHOD } from "./property-market-evidence";
import { PROPERTY_MARKET_VERSION, calculateIndicativeMarketValue, reusableMarketAnalysis } from "./property-market-evidence";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
test("anúncio gerado sem fonte não entra; citação e fonte exatas entram sem aceitar outro caminho", () => {
  const rows = [{ url: "https://site.example/a?utm=1" }, { url: "https://site.example/inventado" }];
  assert.deepEqual(groundedMarketComparables({ output: [] }, rows), []);
  assert.equal(groundedMarketComparables({ output: [{ type: "web_search_call", action: { sources: [{ url: "https://site.example/a" }] } }] }, rows).length, 1);
  assert.equal(groundedMarketComparables({ output: [{ type: "message", content: [{ annotations: [{ type: "url_citation", url: "https://site.example/a" }] }] }] }, rows).length, 1);
});
test("características e localização invalidam pesquisa; revisão monetária não altera comparáveis", () => {
  const base = { tipo: "Apartamento", area_m2: 100, quartos: 0, vagas: 0, endereco: "Rua A" };
  assert.notEqual(propertyMarketFingerprint(base), propertyMarketFingerprint({ ...base, quartos: null }));
  assert.notEqual(propertyMarketFingerprint(base), propertyMarketFingerprint({ ...base, area_m2: 110 }));
  assert.notEqual(propertyMarketFingerprint(base), propertyMarketFingerprint({ ...base, endereco: "Rua B" }));
  assert.equal(propertyMarketFingerprint(base), propertyMarketFingerprint({ ...base, valor_atual: 999 }));
});

test("consulta SQL real limita imóveis autorizados e cache antigo/alterado não vira faixa nova", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("CREATE TABLE carteira_analises(imovel_id text, tipo text, versao_regra text, entrada jsonb, resultado jsonb, criado_em timestamptz DEFAULT now())");
    const property = { id: "mine", area_m2: 100, valor_atual: 999 };
    const db = drizzle(pg), fingerprint = propertyMarketFingerprint(property);
    for (const id of ["mine", "foreign"]) await pg.query("INSERT INTO carteira_analises(imovel_id,tipo,versao_regra,entrada,resultado) VALUES($1,'avaliacao_mercado_sugerida',$2,$3,$4)", [id, PROPERTY_MARKET_VERSION, JSON.stringify({ fingerprint }), JSON.stringify({ status: "atualizada", valor_estimado: 1400, valor_minimo: 1200, valor_maximo: 1600 })]);
    const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const begin = source.indexOf("  const MARKET_ESTIMATE_MAX_AGE_MS");
    const code = source.slice(begin, source.indexOf("  const propertyInviteHash", begin));
    const scope = { db, sql, PROPERTY_MARKET_VERSION, propertyMarketFingerprint, confirmedMarketEvidence, marketRetryDelay, INDICATIVE_MARKET_METHOD, reusableMarketAnalysis, parseMarketValueServer: Number, MARKET_RADIUS_KM: 10 };
    const functions = new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code + "; return {loadPortfolioMarketAnalyses,portfolioMarketEstimate};")(...Object.values(scope));
    assert.equal((await functions.loadPortfolioMarketAnalyses([])).size, 0);
    const states = await functions.loadPortfolioMarketAnalyses(["mine"]); assert.equal(states.size, 1); assert.equal(states.has("foreign"), false);
    assert.equal(functions.portfolioMarketEstimate(property, states.get("mine")).valor_minimo, 1200);
    await pg.query("INSERT INTO carteira_analises(imovel_id,tipo,versao_regra,entrada,resultado,criado_em) VALUES('mine','avaliacao_mercado_sugerida','estimativas-imoveis-v4',$1,$2,now() + interval '2 seconds')", [JSON.stringify({ fingerprint }), JSON.stringify({ status: "atualizada", metodo: INDICATIVE_MARKET_METHOD, valor_estimado: 15000000, valor_minimo: 10000000, valor_maximo: 20000000 })]);
    assert.equal(functions.portfolioMarketEstimate(property, (await functions.loadPortfolioMarketAnalyses(["mine"])).get("mine")).valor_minimo, 1200);
    await pg.query("INSERT INTO carteira_analises(imovel_id,tipo,versao_regra,entrada,resultado,criado_em) VALUES('mine','avaliacao_mercado_sugerida',$1,$2,$3,now() + interval '1 second')", [PROPERTY_MARKET_VERSION, JSON.stringify({ fingerprint }), JSON.stringify({ status: "sem_amostra" })]);
    const withFailure = await functions.loadPortfolioMarketAnalyses(["mine"]);
    assert.equal(functions.portfolioMarketEstimate(property, withFailure.get("mine")).valor_minimo, 1200);
    assert.equal(functions.portfolioMarketEstimate(property, withFailure.get("mine")).precisa_atualizar, false);
    assert.equal(functions.portfolioMarketEstimate({ ...property, quartos: 3 }, states.get("mine")).valor_minimo, null);
    await pg.exec("UPDATE carteira_analises SET criado_em = now() - interval '31 days'");
    const stale = await functions.loadPortfolioMarketAnalyses(["mine"]);
    assert.equal(functions.portfolioMarketEstimate(property, stale.get("mine")).valor_minimo, null);
    assert.equal(functions.portfolioMarketEstimate(property, stale.get("mine")).valor, 999);
  } finally { await pg.close(); }
});

test("pesquisa real exige administração, cache não repete provedor e revisão concorrente não grava", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8"), begin = source.indexOf('  app.post("/api/carteira/imoveis/:id/avaliacao/pesquisar"');
  const code = source.slice(begin, source.indexOf('  app.post("/api/carteira/imoveis/:id/avaliacao/confirmar"', begin));
  let handler: any, allowed = false, cached = true, changed = false, legacy = false, checks = 0, providers = 0, persisted = 0, status = 200;
  const property = { area_m2: 100 };
  const scope = { app: { post: (_path: string, fn: any) => { handler = fn; } }, marketResearchLimit: (fn: any) => fn(), sql, PROPERTY_MARKET_VERSION, propertyMarketFingerprint, reusableMarketAnalysis, MARKET_RADIUS_KM: 10,
    requireCarteiraActor: () => ({ userId: "owner" }), requireCarteiraAccess: async (_id: string, _actor: any, level: string) => { assert.equal(level, "administracao"); if (!allowed) throw Object.assign(new Error("negado"), { status: 403 }); checks++; return { imovel: changed && checks > 2 ? { ...property, quartos: 3 } : property }; },
    db: { transaction: (fn: any) => fn({ execute: async () => ({ rows: cached ? [{ versao_regra: legacy ? "estimativas-imoveis-v4" : PROPERTY_MARKET_VERSION, resultado: { status: "atualizada", ...(legacy ? { metodo: INDICATIVE_MARKET_METHOD, indicativa_avaliada: true } : {}) } }] : [] }) }) },
    loadPortfolioMarketAnalyses: async () => new Map(), portfolioMarketEstimate: () => ({ status: "sem_dados" }),
    researchPropertyMarketValue: async () => { providers++; return {}; }, persistCarteiraAnalysis: async () => { persisted++; return {}; } };
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code)(...Object.values(scope));
  const res: any = { status: (value: number) => { status = value; return res; }, json: () => {} }, req = { params: { id: "mine" } };
  await handler(req, res); assert.equal(status, 403); assert.equal(providers, 0);
  allowed = true; await handler(req, res); assert.equal(providers, 0); assert.equal(persisted, 0);
  cached = false; changed = true; checks = 0; await handler(req, res); assert.equal(status, 409); assert.equal(providers, 1); assert.equal(persisted, 0);
  changed = false; checks = 0; await handler(req, res); assert.equal(persisted, 1);
  cached = true; legacy = true; checks = 0; await handler(req, res); assert.equal(persisted, 2); assert.equal(providers, 3);
});

test("evidência capturada no cadastro é reutilizada, não o preço manual; dados diferentes e raio inválido não entram", () => {
  const property = { tipo: "Apartamento", area_m2: "80", moeda: "BRL", endereco: "Rua A", cidade: "Rio", quartos: 2 };
  const keys = ["tipo", "area_m2", "moeda", "cep", "endereco", "numero", "bairro", "cidade", "estado", "pais", "padrao_imovel", "ano_construcao", "estado_conservacao", "quartos", "banheiros", "vagas"];
  const comparaveis = [1, 2, 3].map(i => ({ tipo: "Apartamento", area_m2: 80, moeda: "BRL", cidade: "Rio", quartos: 2, preco_total: 800000 + i * 10000, distancia_km: i, url: `https://example.com/${i}` }));
  const row = { tipo: "avaliacao_confirmada", versao_regra: "comparaveis-robustos-v2", resultado: { valor_atual: 1 }, entrada: { entrada_chave: JSON.stringify(keys.map(k => (property as any)[k])), amostra_suficiente: true, raio_aplicado_km: 5, comparaveis, fontes: comparaveis } };
  assert.ok(confirmedMarketEvidence(property, row)?.resultado.valor_estimado > 800000);
  assert.equal(confirmedMarketEvidence({ ...property, area_m2: "81" }, row), null);
  assert.equal(confirmedMarketEvidence(property, { ...row, entrada: { ...row.entrada, raio_aplicado_km: 20 } }), null);
  assert.equal(confirmedMarketEvidence(property, { ...row, entrada: { ...row.entrada, fontes: [] } }), null);
  assert.equal(confirmedMarketEvidence(property, { ...row, entrada: { valor_atual: 1 } }), null);
  assert.equal(marketRetryDelay({ status: "sem_amostra" }), 3600000);
  assert.equal(marketRetryDelay({ status: "atualizada" }), 30 * 86400000);
});

test("painel pesquisa automaticamente sem botão nem linhas individuais de resultado", () => {
  const source = readFileSync(new URL("../client/src/pages/carteira.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Atualizar estimativas por IA|researchResults|Fontes das estimativas/);
  assert.match(source, /property\.estimativa_mercado\?\.precisa_atualizar/);
  assert.match(source, /researchAttempts\.current\.set\(key, Number\.POSITIVE_INFINITY\)/);
  assert.match(source, /Date\.now\(\) \+ 5 \* 60 \* 1000/);
});

const regionalReference = { natureza: "indice_venda_m2", url: "https://market.example/casas", titulo: "Venda de casas", trecho: "Faixa de venda/m²: 10.000 a 12.000 reais.", tipo_imovel: "Apartamento", cidade: "São Paulo", estado: "SP", moeda: "BRL", area_m2: null, preco_minimo: 10000, preco_maximo: 12000 };
test("faixa indicativa aceita referência regional sem três anúncios; servidor calcula e nunca recebe preço declarado ou contatos", async () => {
  let calls = 0;
  const property = { tipo: "Apartamento", area_m2: 80, cidade: "São Paulo", estado: "SP", moeda: "BRL", valor_atual: 1, valor_pago: 1, nome: "Pessoa privada", email: "private@example.com", endereco: "Endereço privado", bairro: "Bairro" };
  const client = { responses: { create: async (request: any) => {
    calls++;
    assert.equal(request.text.format.type, "json_schema"); assert.equal(request.text.format.strict, true);
    const input = JSON.parse(request.input[1].content);
    assert.equal(input.area_m2, 80);
    assert.equal(input.valor_atual, undefined); assert.equal(input.valor_pago, undefined);
    assert.equal(input.email, undefined); assert.equal(input.nome, undefined);
    assert.equal(input.endereco, undefined); assert.equal(input.bairro, undefined);
    return { output_text: JSON.stringify({ referencias: [regionalReference], justificativa: "Referência regional, não laudo." }), output: [{ type: "web_search_call", action: { sources: [{ url: regionalReference.url }] } }] };
  } } };
  const outcome = await researchIndicativePropertyValue(client, property);
  assert.equal(outcome?.metodo, INDICATIVE_MARKET_METHOD);
  assert.equal(outcome?.confianca, "baixa"); assert.equal(outcome?.amostra_suficiente, false);
  assert.equal(outcome?.quantidade_comparaveis, 0); assert.equal(outcome?.raio_km, null);
  assert.deepEqual(outcome?.fontes, []); assert.equal(outcome?.valor_minimo, 600000);
  assert.equal(outcome?.valor_estimado, 880000); assert.equal(outcome?.valor_maximo, 1200000);
  assert.equal(outcome?.calculo.area_m2, 80);
  assert.equal(await researchIndicativePropertyValue(client, { ...property, cidade: "" }), null);
  assert.equal(calls, 1);
  for (const invalid of [{ valor_minimo: -1, valor_estimado: 20, valor_maximo: 30 }, { valor_minimo: 0.001, valor_estimado: 0.002, valor_maximo: 0.003 }, { valor_minimo: 20, valor_estimado: 20, valor_maximo: 20 }, { valor_minimo: 30, valor_estimado: 20, valor_maximo: 10 }, { valor_minimo: "10", valor_estimado: 20, valor_maximo: 30 }, {}]) {
    assert.equal(await researchIndicativePropertyValue({ responses: { create: async () => ({ output_text: JSON.stringify(invalid) }) } }, property), null);
  }
});

test("Casa 447m²: custo de construção não vira venda e nenhum adicional de milhões é aceito", async () => {
  const property = { tipo: "Casa", area_m2: 447, cidade: "Santa Leopoldina", estado: "ES", moeda: "BRL" };
  const construction = { ...regionalReference, tipo_imovel: "Casa", cidade: property.cidade, estado: "ES", titulo: "Custo médio de construção", trecho: "Custo de construção R$1.976,37/m²", preco_minimo: 1976.37, preco_maximo: 1976.37 };
  assert.equal(calculateIndicativeMarketValue(property, [construction], [construction]), null);
  const reference = { ...construction, natureza: "anuncio_venda", titulo: "Casa à venda", trecho: "Casa de 300m² à venda por R$450.000", area_m2: 300, preco_minimo: 450000, preco_maximo: 450000 };
  const calculation = calculateIndicativeMarketValue(property, [reference], [reference]);
  assert.equal(calculation?.valor_estimado, 670500); // 450000 / 300 * 447; no fabricated land addition.
  assert.equal(calculation?.valor_minimo, 502875); assert.equal(calculation?.valor_maximo, 838125);
  const row = { versao_regra: PROPERTY_MARKET_VERSION, resultado: { status: "atualizada", metodo: INDICATIVE_MARKET_METHOD, fontes_contextuais: [reference], ...calculation } };
  assert.equal(reusableMarketAnalysis(property, row), true);
  for (const key of ["valor_minimo", "valor_estimado", "valor_maximo"]) assert.equal(reusableMarketAnalysis(property, { ...row, resultado: { ...row.resultado, [key]: 15000000 } }), false);
  assert.equal(reusableMarketAnalysis({ ...property, area_m2: 500 }, row), false);
  assert.equal(reusableMarketAnalysis(property, { ...row, versao_regra: "estimativas-imoveis-v4" }), false);
  assert.equal(reusableMarketAnalysis(property, { ...row, resultado: { ...row.resultado, calculo: undefined } }), false);
  const response = (references: any[], sources = references, status = "completed") => ({ responses: { create: async () => ({ status, output_text: JSON.stringify({ referencias: references }), output: [{ type: "web_search_call", action: { sources } }] }) } });
  assert.equal(await researchIndicativePropertyValue(response([construction]), property), null);
  assert.equal(await researchIndicativePropertyValue(response([reference], []), property), null);
  assert.equal(await researchIndicativePropertyValue(response([reference], [reference], "incomplete"), property), null);
  assert.equal((await researchIndicativePropertyValue(response([reference]), property))?.valor_estimado, 670500);
  for (const change of [{ tipo_imovel: "Fazenda" }, { titulo: "Chácara com casa" }, { cidade: "Vitória" }, { estado: "SP" }, { moeda: "USD" }, { natureza: "custo_construcao" }, { area_m2: 45000 }, { area_m2: 0 }, { preco_minimo: "450000" }, { preco_maximo: -1 }, { trecho: "" }, { url: "https://invented.example/" }]) {
    assert.equal(calculateIndicativeMarketValue(property, [{ ...reference, ...change }], [reference]), null);
  }
  assert.deepEqual(calculateIndicativeMarketValue(property, [reference, reference], [reference]), calculation);
});

test("fluxo real preserva comparáveis suficientes e usa IA indicativa para tentativa antiga sem amostra", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const begin = source.indexOf("  async function researchPropertyMarketValue(");
  const code = source.slice(begin, source.indexOf("  async function buildCarteiraResumo", begin));
  let strictCalls = 0, indicativeCalls = 0, sufficient = true;
  const scope = { researchComparablePropertyMarketValue: async () => { strictCalls++; return { status: sufficient ? "atualizada" : "sem_amostra" }; },
    researchIndicativePropertyValue: async () => { indicativeCalls++; return { status: "atualizada", metodo: INDICATIVE_MARKET_METHOD }; },
    getOpenAI: () => ({}), parseAreaM2Server: Number };
  const run = new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code + "; return researchPropertyMarketValue;")(...Object.values(scope));
  await run({ area_m2: 80 }); assert.equal(strictCalls, 1); assert.equal(indicativeCalls, 0);
  sufficient = false;
  assert.equal((await run({ area_m2: 80 })).metodo, INDICATIVE_MARKET_METHOD);
  assert.equal(indicativeCalls, 1);
  await run({ area_m2: 80 }, { status: "sem_amostra" });
  assert.equal(strictCalls, 2); assert.equal(indicativeCalls, 2);
});
