import test from "node:test";
import assert from "node:assert/strict";
import { dashboardAcquisitionValue, portfolioDashboard, portfolioDashboardFromApi } from "./portfolio-dashboard";

test("separa aquisição, faixa de mercado e CPPs com frações e sem duplicar origem formal", () => {
  const property = { id: "a", participacao_percentual: 25, valor_aquisicao_brl: 1000, estimativa_dashboard: { min: 1200, max: 1600, value: 1400 } };
  const result = portfolioDashboard([property, property, { ...property, id: "origin", consolidado_via_bia: true }], [{ id: "bia", cpp_base_brl: 500, cpp_contributed_brl: 125, cpp_remaining_brl: 375, valor_participacao_brl: 300 }]);
  assert.equal(result.acquisition.value, 250); assert.equal(result.propertyEstimate.min, 300); assert.equal(result.propertyEstimate.max, 400);
  assert.equal(result.propertyEstimate.value, 350); assert.equal(result.cppBase.value, 500); assert.equal(result.cppContributed.value, 125); assert.equal(result.cppRemaining.value, 375); assert.equal(result.cppEstimate.value, 300);
});
test("ausência, parcial, zero e perda não se confundem; sem usar valor cadastrado como IA", () => {
  const result = portfolioDashboard([{ id: "a", valor_aquisicao_brl: null }, { id: "b", participacao_percentual: 0, valor_aquisicao_brl: 9999 }], [{ id: "bia", cpp_base_brl: 100, valor_participacao_brl: -20, estimativa_patrimonial: { partial: true } }, { id: "foreign", cpp_base_brl: null, valor_participacao_brl: null }]);
  assert.equal(result.acquisition.value, null); assert.equal(result.acquisition.total, 1); assert.equal(result.propertyEstimate.min, null);
  assert.equal(result.cppEstimate.value, null); assert.equal(result.cppEstimate.partial, true);
  assert.equal(portfolioDashboard([], []).cppEstimate.value, 0);
  assert.equal(portfolioDashboard([], [{ id: "zero", valor_participacao_brl: 0 }]).cppEstimate.value, 0);
  assert.equal(portfolioDashboard([], [{ id: "loss", valor_participacao_brl: -20 }]).cppEstimate.value, -20);
  assert.equal(portfolioDashboard([], [{ id: "known", valor_participacao_brl: 50 },{id:'unknown',valor_participacao_brl:null}]).cppEstimate.value,null);
  assert.equal(result.cppContributed.value,null); assert.equal(result.cppRemaining.value,null);
});

test("estimativa indicativa entra proporcionalmente no total com sua origem, sem alterar a aquisição", () => {
  const result = portfolioDashboard([{ id: "a", participacao_percentual: 50, valor_aquisicao_brl: 300,
    estimativa_dashboard: { min: 800, value: 900, max: 1000, indicative: true } }], []);
  assert.equal(result.propertyEstimate.value, 450); assert.equal(result.propertyEstimate.min, 400);
  assert.equal(result.propertyEstimate.indicative, true); assert.equal(result.acquisition.value, 150);
});

test("aquisição não declarada soma zero, mas falha de conversão continua incompleta", () => {
  assert.equal(dashboardAcquisitionValue("", null), 0);
  assert.equal(dashboardAcquisitionValue(null, null), 0);
  assert.equal(dashboardAcquisitionValue("0", 0), 0);
  assert.equal(dashboardAcquisitionValue("100", null), null);
  const result = portfolioDashboard([
    { id: "known", valor_aquisicao_brl: 1 },
    { id: "undeclared", valor_aquisicao_brl: dashboardAcquisitionValue("", null) },
  ], []);
  assert.equal(result.acquisition.value, 1);
  assert.equal(result.acquisition.included, 2);
  assert.equal(result.acquisition.total, 2);
  assert.equal(result.acquisition.partial, false);
  const compatible = portfolioDashboardFromApi([
    { id: "known", valor_pago: "1", valor_aquisicao_brl: 1 },
    { id: "undeclared", valor_pago: "", valor_aquisicao_brl: null },
  ], []);
  assert.deepEqual(compatible.acquisition, result.acquisition);
});
