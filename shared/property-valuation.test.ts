import test from "node:test";
import assert from "node:assert/strict";
import { propertyValuationReadiness, sanitizeValuationAreas, valuationObservationReason } from "./property-valuation";
import { portfolioDashboard, portfolioPropertyBreakdown, portfolioPropertyRegions } from "./portfolio-dashboard";
const home = { tipo: "Casa", endereco: "Rua A", cidade: "Vitória", estado: "ES", pais: "Brasil", area_avaliacao_tipo: "construida" as const, area_construida_m2: "120,5" };
test("histórico distingue método, cadastro e nova pesquisa sem presumir valorização", () => {
  const previous = { versao_regra: "v1", entrada: { fingerprint: "a" } };
  assert.equal(valuationObservationReason(previous, previous), "Nova pesquisa com o mesmo cadastro");
  assert.equal(valuationObservationReason({ ...previous, versao_regra: "v2" }, previous), "Mudança de método");
  assert.equal(valuationObservationReason({ ...previous, entrada: { fingerprint: "b" } }, previous), "Dados do imóvel alterados");
});
test("área total ou terreno nunca substituem construída/privativa e a avaliação dispensa a fonte das medidas", () => {
  assert.equal(propertyValuationReadiness(home).area, 120.5);
  assert.equal(propertyValuationReadiness(home).ready, true);
  assert.equal(propertyValuationReadiness({ ...home, area_construida_m2: "", area_total_m2: 999, area_terreno_m2: 1000 }).ready, false);
  assert.equal(propertyValuationReadiness({ ...home, area_avaliacao_tipo: "privativa" }).ready, false);
  assert.equal(propertyValuationReadiness({ ...home, areas_fonte: "" }).ready, true);
  assert.equal(propertyValuationReadiness({ ...home, areas_fonte: "Planta antiga" }).ready, true);
  assert.equal(propertyValuationReadiness({ ...home, tipo: "Terreno" }).ready, false);
  assert.equal(propertyValuationReadiness({ ...home, pais: "Portugal" }).ready, false);
});
test("cadastro valida medidas em pt-BR sem criar dados para o legado", () => {
  assert.equal(sanitizeValuationAreas({ area_construida_m2: "1.200,50" }).area_construida_m2, 1200.5);
  assert.equal(sanitizeValuationAreas({}).area_construida_m2, null);
  assert.equal(Object.hasOwn(sanitizeValuationAreas({}), "areas_fonte"), false);
  assert.equal(sanitizeValuationAreas({ areas_fonte: "Planta antiga" }).areas_fonte, "Planta antiga");
  for (const value of [-1, 0, Infinity, "abc", "-80", "1,2,3"]) assert.throws(() => sanitizeValuationAreas({ area_terreno_m2: value }), /número positivo/);
});
test("detalhamento fecha com total proporcional, exclui origem BIA/duplicados e não inventa avaliação ausente", () => {
  const properties = [{ id: "a", nome: "Casa", participacao_percentual: 25, valor_aquisicao_brl: 100.01, estimativa_dashboard: { min: 180, value: 200.03, max: 220 } },
    { id: "b", participacao_percentual: 50, valor_aquisicao_brl: 100 }, { id: "bia", consolidado_via_bia: true, valor_aquisicao_brl: 99999 }];
  const rows = portfolioPropertyBreakdown([...properties, properties[0]]);
  const metrics = portfolioDashboard([...properties, properties[0]], []);
  assert.equal(rows.length, 2); assert.equal(rows[0].estimate, 50.01); assert.equal(rows[1].estimate, null);
  assert.equal(metrics.acquisition.value, rows.reduce((sum, row) => sum + (row.acquisition || 0), 0));
  assert.equal(metrics.propertyEstimate.value, 50.01); assert.equal(metrics.propertyEstimate.partial, true);
  assert.deepEqual(portfolioPropertyRegions(properties), [{ region: "Localização não informada", assets: 2, value: null, partial: true }]);
  assert.equal(portfolioPropertyRegions([properties[0]])[0].value, metrics.propertyEstimate.value);
});
