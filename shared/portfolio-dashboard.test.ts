import test from "node:test";
import assert from "node:assert/strict";
import { portfolioDashboard } from "./portfolio-dashboard";

test("separa aquisição, faixa de mercado e CPPs com frações e sem duplicar origem formal", () => {
  const property = { id: "a", participacao_percentual: 25, valor_aquisicao_brl: 1000, estimativa_dashboard: { min: 1200, max: 1600, value: 1400 } };
  const result = portfolioDashboard([property, property, { ...property, id: "origin", consolidado_via_bia: true }], [{ id: "bia", cpp_base_brl: 500, valor_participacao_brl: 300 }]);
  assert.equal(result.acquisition.value, 250); assert.equal(result.propertyEstimate.min, 300); assert.equal(result.propertyEstimate.max, 400);
  assert.equal(result.propertyEstimate.value, 350); assert.equal(result.cppBase.value, 500); assert.equal(result.cppEstimate.value, 300);
});
test("ausência, parcial, zero e perda não se confundem; sem usar valor cadastrado como IA", () => {
  const result = portfolioDashboard([{ id: "a", valor_aquisicao_brl: null }, { id: "b", participacao_percentual: 0, valor_aquisicao_brl: 9999 }], [{ id: "bia", cpp_base_brl: 100, valor_participacao_brl: -20, estimativa_patrimonial: { partial: true } }, { id: "foreign", cpp_base_brl: null, valor_participacao_brl: null }]);
  assert.equal(result.acquisition.value, null); assert.equal(result.acquisition.total, 1); assert.equal(result.propertyEstimate.min, null);
  assert.equal(result.cppEstimate.value, -20); assert.equal(result.cppEstimate.partial, true);
  assert.equal(portfolioDashboard([], []).cppEstimate.value, 0);
  assert.equal(portfolioDashboard([], [{ id: "zero", valor_participacao_brl: 0 }]).cppEstimate.value, 0);
});

test("estimativa indicativa entra proporcionalmente no total com sua origem, sem alterar a aquisição", () => {
  const result = portfolioDashboard([{ id: "a", participacao_percentual: 50, valor_aquisicao_brl: 300,
    estimativa_dashboard: { min: 800, value: 900, max: 1000, indicative: true } }], []);
  assert.equal(result.propertyEstimate.value, 450); assert.equal(result.propertyEstimate.min, 400);
  assert.equal(result.propertyEstimate.indicative, true); assert.equal(result.acquisition.value, 150);
});
