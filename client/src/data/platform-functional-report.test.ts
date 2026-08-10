import test from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_FUNCTIONAL_MODULES,
  PLATFORM_FUNCTIONAL_REPORT_SUMMARY,
} from "./platform-functional-report";

test("relatório possui módulos e funcionalidades identificáveis", () => {
  assert.ok(PLATFORM_FUNCTIONAL_MODULES.length >= 10);
  assert.ok(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.features >= 80);

  const moduleIds = PLATFORM_FUNCTIONAL_MODULES.map((module) => module.id);
  const featureIds = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features.map((feature) => feature.id));

  assert.equal(new Set(moduleIds).size, moduleIds.length);
  assert.equal(new Set(featureIds).size, featureIds.length);
  assert.ok(PLATFORM_FUNCTIONAL_MODULES.every((module) => module.title && module.summary && module.features.length > 0));
});

test("resumo do relatório corresponde aos itens documentados", () => {
  const features = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features);
  assert.equal(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.modules, PLATFORM_FUNCTIONAL_MODULES.length);
  assert.equal(PLATFORM_FUNCTIONAL_REPORT_SUMMARY.features, features.length);
  assert.equal(
    PLATFORM_FUNCTIONAL_REPORT_SUMMARY.disponivel
      + PLATFORM_FUNCTIONAL_REPORT_SUMMARY.evolucao
      + PLATFORM_FUNCTIONAL_REPORT_SUMMARY.homologacao,
    features.length,
  );
});
