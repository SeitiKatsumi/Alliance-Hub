import assert from "node:assert/strict";
import test from "node:test";
import { getAllContributionAreas, getPublicContributionAreas, normalizeContributionAreaValues } from "./contribution-areas";
import { publicLabel } from "./public-labels";

test("separa as 16 ofertas publicas das quatro funcoes de lideranca", () => {
  assert.equal(getAllContributionAreas().length, 20);
  assert.equal(getPublicContributionAreas().length, 16);
  assert.equal(getPublicContributionAreas().some((area) => area.iconKey === "leadership"), false);
});

test("preserva valores legados mesmo quando nao aparecem no seletor publico", () => {
  assert.deepEqual(normalizeContributionAreaValues(["Liderança Técnica"]), ["Alianças de Liderança Técnica"]);
  assert.equal(publicLabel("ContributionArea"), "O que você pode oferecer");
});
