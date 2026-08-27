import assert from "node:assert/strict";
import test from "node:test";
import { buildComparableMarketAnalysis, marketDistanceKm, marketLocationCandidates } from "./market-comparables";

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

test("aceita os limites inclusivos de 90 a 150 m² e calcula a média no servidor", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 90, 450_000),
    comparable(2, 120, 720_000),
    comparable(3, 150, 1_050_000),
  ], target);

  assert.equal(result.amostra_suficiente, true);
  assert.equal(result.quantidade_comparaveis, 3);
  assert.equal(result.area_min, 90);
  assert.equal(result.area_max, 150);
  assert.equal(result.referencia_m2_min, 5_000);
  assert.equal(result.referencia_m2_max, 7_000);
  assert.equal(result.referencia_m2_media, 6_000);
  assert.equal(result.classificacao, "media");
});

test("descarta área fora da faixa, outro tipo e outra região", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 89, 445_000),
    comparable(2, 151, 755_000),
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
    comparable(3, 150, 750_000),
  ];

  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 5_500 }).classificacao, "media");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 5_501 }).classificacao, "acima");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 4_500 }).classificacao, "media");
  assert.equal(buildComparableMarketAnalysis(rows, { ...target, precoM2: 4_499 }).classificacao, "abaixo");
});

test("aplica raio inclusivo de 10 km quando a distância foi verificada", () => {
  const result = buildComparableMarketAnalysis([
    comparable(1, 100, 500_000, { distancia_km: 0 }),
    comparable(2, 120, 600_000, { distancia_km: 10 }),
    comparable(3, 130, 650_000, { distancia_km: 10.01 }),
    comparable(4, 140, 700_000),
  ], { ...target, exigirDistancia: true, raioMaxKm: 10 });
  assert.equal(result.quantidade_comparaveis, 2);
  assert.equal(result.amostra_suficiente, false);
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
