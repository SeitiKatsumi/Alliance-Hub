import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { hasExplicitAreaEvidence, typedAreaSearchMessages, marketSearchModelOptions, MARKET_AREA_SEARCH_VERSION } from './market-area-search';
import { groundedMarketComparables, reusableMarketAnalysis, PROPERTY_MARKET_VERSION } from './property-market-evidence';
import { BUILT_VALUATION_VERSION } from '../shared/property-valuation';
import { buildComparableMarketAnalysis, marketAreaRange, MARKET_RADIUS_KM } from './market-comparables';

const row = (id: number, evidence = 'Área construída: 100 m²') => ({
  titulo: `Apartamento ${id}`, url: `https://example.org/imovel/${id}`, tipo: 'Apartamento',
  area_tipo: 'construida', area_m2: 100, preco_total: 500000 + id * 1000, moeda: 'BRL',
  trecho_area: evidence, distancia_km: id / 10,
});
test('a etiqueta da IA não converte área útil, privativa ou total em construída', () => {
  for (const quote of ['100 m² útil', 'Área privativa: 100 m²', 'Área total: 100 m²', 'Apartamento de 100 m²', '']) {
    assert.equal(hasExplicitAreaEvidence(row(1, quote), 'construida'), false);
  }
  assert.equal(hasExplicitAreaEvidence({ ...row(1), area_tipo: 'privativa' }, 'construida'), false);
});
test('a medida deve coincidir com o campo citado, mesmo se a ficha tiver outras áreas', () => {
  assert.equal(hasExplicitAreaEvidence(row(1), 'construida'), true);
  assert.equal(hasExplicitAreaEvidence({ ...row(1, '110 m² de área construída'), area_m2: 110 }, 'construida'), true);
  assert.equal(hasExplicitAreaEvidence({ ...row(1, 'Área Construída: 1.200,50 m²'), area_m2: 1200.5 }, 'construida'), true);
  assert.equal(hasExplicitAreaEvidence(row(1, 'Área privativa: 100 m²; Área construída: 120 m²'), 'construida'), false);
  assert.equal(hasExplicitAreaEvidence({ ...row(1, 'Área privativa: 100 m²; Área construída: 120 m²'), area_m2: 120 }, 'construida'), true);
  assert.equal(hasExplicitAreaEvidence({ ...row(1, 'Área privativa: 100 m²'), area_tipo: 'privativa' }, 'privativa'), true);
});

function extractedSearch(response: any) {
  const source = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
  const begin = source.indexOf('  async function analyzeM2WithWebSearch(');
  const code = source.slice(begin, source.indexOf('  app.post("/api/ai/preco-m2"', begin));
  let request: any;
  const scope = { marketAreaRange, MARKET_RADIUS_KM, typedAreaSearchMessages, marketSearchModelOptions,
    hasExplicitAreaEvidence, groundedMarketComparables, extractJsonObject: JSON.parse,
    getOpenAI: () => ({ responses: { create: async (input: any) => { request = input; return response; } } }) };
  const search = new Function(...Object.keys(scope), transformSync(code, { loader: 'ts' }).code + ';return analyzeM2WithWebSearch;')(...Object.values(scope));
  return { search, request: () => request };
}
const target = { tipo: 'Apartamento', areaM2: 100, areaTipo: 'construida', moeda: 'BRL', exigirDistancia: true };
test('pesquisa real preserva fontes e prova da área antes de calcular três referências', async () => {
  const valid = [row(1), row(2), row(3)];
  const rows = [...valid, row(4, '100 m² útil'), row(5)];
  const api = extractedSearch({ status: 'completed', output_text: JSON.stringify({ comparaveis: rows }),
    output: [{ type: 'web_search_call', action: { sources: rows.slice(0, 4).map(r => ({ url: r.url })) } }] });
  const result = await api.search({ ...target, origem: 'carteira', nome: 'Teste', location: 'Rua A, Cidade', bairro: 'Centro', cidade: 'Cidade' });
  assert.deepEqual(result.comparaveis.map((r: any) => r.url), valid.map(r => r.url));
  const analysis = buildComparableMarketAnalysis(result.comparaveis, target);
  assert.equal(analysis.amostra_suficiente, true);
  assert.equal(analysis.referencia_m2_media, 5020);
  assert.equal(analysis.comparaveis[0].trecho_area, 'Área construída: 100 m²');
  assert.match(JSON.stringify(api.request().input), /área construída/);
  assert.match(api.request().input[1].content, /"areaMin":80/);
});
test('resposta interrompida do provedor não se transforma em falta de anúncios', async () => {
  const api = extractedSearch({ status: 'incomplete', output_text: '{}' });
  await assert.rejects(api.search({ ...target, origem: 'carteira', location: 'Rua A', nome: 'Teste' }), { status: 503 });
});
test('opções do modelo respeitam configuração e pesquisa BIA sem área tipada', () => {
  assert.equal(marketSearchModelOptions(false).model, 'gpt-4.1-mini');
  assert.equal(marketSearchModelOptions(true).model, 'gpt-5');
  assert.equal('temperature' in marketSearchModelOptions(true), false);
  assert.equal(marketSearchModelOptions(true, 'gpt-4.1-mini').temperature, 0.1);
  assert.equal(hasExplicitAreaEvidence({ area_m2: 100 }, undefined), true);
});
test('busca regional não recebe preço de referência, endereço preciso ou campos extras', () => {
  const input = { tipo: 'Apartamento', areaTipo: 'construida', location: 'Rua privada 123', bairro: 'Centro', cidade: 'Cidade',
    areaMin: 80, areaMax: 120, moeda: 'BRL', valor: 987654, precoM2: 1234, owner_email: 'privado@example.test' };
  const messages = JSON.stringify(typedAreaSearchMessages(input));
  for (const privateValue of ['987654', '1234', 'Rua privada 123', 'privado@example.test']) assert.equal(messages.includes(privateValue), false);
  assert.match(messages, /Centro/);
});
test('falha antiga permite nova pesquisa; sucesso e espera da busca corrigida permanecem', () => {
  const base = { versao_regra: PROPERTY_MARKET_VERSION, resultado: { versao_metodo: BUILT_VALUATION_VERSION, status: 'sem_amostra' } };
  assert.equal(reusableMarketAnalysis({}, base), false);
  assert.equal(reusableMarketAnalysis({}, { ...base, resultado: { ...base.resultado, busca_area_versao: MARKET_AREA_SEARCH_VERSION } }), true);
  assert.equal(reusableMarketAnalysis({}, { ...base, resultado: { ...base.resultado, status: 'atualizada' } }), true);
});
