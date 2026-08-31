import assert from "node:assert/strict";
import test from "node:test";
import { buildComparableMarketAnalysis, marketDistanceKm, marketLocationCandidates, MARKET_RADIUS_KM } from "./market-comparables";

const target = {
  tipo: "Apartamento",
  bairro: "Centro",
  cidade: "Campinas",
  areaM2: 120,
  precoM2: 6_000,
  moeda: "BRL",
};

function comparable(index: number, areaM2: number, precoTotal: number, overrides: Record<string, unknown> = {}) {
  return {
    titulo: `Apartamento comparável ${index}`,
    url: `https://imoveis.example/anuncio-${index}`,
    tipo: "Apartamento",
    bairro: "Centro",
    cidade: "Campinas",
    localizacao: "Centro, Campinas",
    area_m2: areaM2,
    preco_total: precoTotal,
    moeda: "BRL",
    ...overrides,
  };
}

test("usa faixa proporcional de área e calcula a mediana no servidor", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 96, 480_000),
    comparable(2, 120, 720_000),
    comparable(3, 144, 1_008_000),
  ], target);

  assert.equal(result.amostra_suficiente, true);
  assert.equal(result.quantidade_comparaveis, 3);
  assert.equal(result.area_min, 96);
  assert.equal(result.area_max, 144);
  assert.equal(result.referencia_m2_min, 5_000);
  assert.equal(result.referencia_m2_max, 7_000);
  assert.equal(result.referencia_m2_media, 6_000);
  assert.equal(result.classificacao, "media");
});

test("descarta área fora da faixa, outro tipo e outra região", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 95, 475_000),
    comparable(2, 145, 725_000),
    comparable(3, 120, 720_000, { tipo: "Casa" }),
    comparable(4, 120, 720_000, { bairro: "Cambuí", localizacao: "Cambuí, Campinas" }),
    comparable(5, 120, 720_000),
  ], target);

  assert.equal(result.quantidade_comparaveis, 1);
  assert.equal(result.amostra_suficiente, false);
  assert.equal("referencia_m2_media" in result, false);
  assert.equal("classificacao" in result, false);
});

test("remove URLs duplicadas antes de avaliar o tamanho da amostra", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 100, 600_000),
    comparable(1, 100, 600_000, { url: "https://imoveis.example/anuncio-1?utm_source=busca" }),
    comparable(2, 120, 720_000),
  ], target);

  assert.equal(result.quantidade_comparaveis, 2);
  assert.equal(result.amostra_suficiente, false);
});

test("classifica acima e abaixo somente depois de ultrapassar 10%", () => {
  const rows = [
    comparable(1, 100, 500_000),
    comparable(2, 120, 600_000),
    comparable(3, 140, 700_000),
  ];

  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 5_500 }).classificacao, "media");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 5_501 }).classificacao, "acima");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 4_500 }).classificacao, "media");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 4_499 }).classificacao, "abaixo");
});

test("aplica o raio padrão inclusivo de 20 km quando a distância foi verificada", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 100, 500_000, { distancia_km: 0 }),
    comparable(2, 120, 600_000, { bairro: "Município vizinho", cidade: "Valinhos", localizacao: "Valinhos", distancia_km: 20 }),
    comparable(3, 130, 650_000, { distancia_km: 20.01 }),
    comparable(4, 140, 700_000),
  ], { ...target, exigirDistancia: true });
  assert.equal(MARKET_RADIUS_KM, 20);
  assert.equal(result.quantidade_comparaveis, 2);
  assert.equal(result.amostra_suficiente, false);
});

test("descarta incompatibilidades conhecidas de padrão, idade e configuração", () => {
  const characteristics = {
    padrao: "alto",
    ano_construcao: 2018,
    estado_conservacao: "bom",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
  };
  const result = buildComparableMarketAnalysis([
    comparable(1, 120, 720_000, characteristics),
    comparable(2, 120, 720_000, { ...characteristics, padrao: "medio" }),
    comparable(3, 120, 720_000, { ...characteristics, ano_construcao: 2000 }),
    comparable(4, 120, 720_000, { ...characteristics, quartos: 1 }),
    comparable(5, 120, 720_000, characteristics),
  ], {
    ...target,
    padrao: "alto",
    anoConstrucao: 2018,
    estadoConservacao: "bom",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
  });

  assert.equal(result.quantidade_comparaveis, 2);
  assert.deepEqual(result.comparaveis.map((item) => item.url), [
    "https://imoveis.example/anuncio-1",
    "https://imoveis.example/anuncio-5",
  ]);
});

test("usa o menor raio viável e remove anúncio muito fora da mediana", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 100, 500_000, { distancia_km: 2 }),
    comparable(2, 100, 550_000, { distancia_km: 3 }),
    comparable(3, 100, 600_000, { distancia_km: 4 }),
    comparable(4, 100, 1_500_000, { distancia_km: 5 }),
    comparable(5, 100, 650_000, { distancia_km: 12 }),
  ], { ...target, areaM2: 100, exigirDistancia: true });

  assert.equal(result.raio_aplicado_km, 5);
  assert.equal(result.quantidade_comparaveis, 3);
  assert.equal(result.referencia_m2_media, 5_500);
  assert.equal(result.metodo, "mediana");
});

test("só declara confiança alta quando as características estão cobertas", () => {
  const characteristics = {
    padrao: "alto",
    ano_construcao: 2018,
    estado_conservacao: "bom",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
  };
  const rows = [1, 2, 3, 4, 5].map((index) => comparable(
    index,
    100,
    (5_000 + index * 100) * 100,
    { ...characteristics, distancia_km: index },
  ));
  const detailed = buildComparableMarketAnalysis(rows, {
    ...target,
    areaM2: 100,
    exigirDistancia: true,
    padrao: "alto",
    anoConstrucao: 2018,
    estadoConservacao: "bom",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
  });
  const incomplete = buildComparableMarketAnalysis(rows, { ...target, areaM2: 100, exigirDistancia: true });

  assert.equal(detailed.confianca, "alta");
  assert.equal(detailed.cobertura_caracteristicas_percentual, 100);
  assert.equal(incomplete.confianca, "baixa");
});

test("calcula distância geográfica em quilômetros", () => {
  assert.ok(Math.abs(marketDistanceKm(
    { latitude: -23.55052, longitude: -46.633308 },
    { latitude: -23.55052, longitude: -46.533308 },
  ) - 10.22) < 0.1);
});

test("tenta bairro e cidade quando o endereço completo não é reconhecido", () => {
  assert.deepEqual(marketLocationCandidates({
    endereco: "Rua sem cobertura no geocodificador",
    bairro: "Vale dos Sonhos",
    cidade: "Lagoa Santa",
    estado: "MG",
    pais: "Brasil",
    cep: "33400-000",
  }), [
    "Rua sem cobertura no geocodificador, Vale dos Sonhos, Lagoa Santa, MG, Brasil, CEP 33400-000",
    "Vale dos Sonhos, Lagoa Santa, MG, Brasil",
    "Lagoa Santa, MG, Brasil",
    "CEP 33400-000, Brasil",
  ]);
});
