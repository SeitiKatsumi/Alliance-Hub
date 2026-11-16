import test from "node:test";
import assert from "node:assert/strict";
import { biaObaCreationUrl, hasAddedBiaVacancies } from "./bia-oba-prompt";

test("OBA é sugerida quando nasce ou aumenta uma cota disponível", () => {
  const vacancy = { participantId: "draft:slot", titular: "vaga" as const, cotasInvestimento: 1 };
  assert.equal(hasAddedBiaVacancies([], [vacancy]), true);
  assert.equal(hasAddedBiaVacancies([vacancy], [vacancy]), false);
  assert.equal(hasAddedBiaVacancies([vacancy], [{ ...vacancy, cotasInvestimento: 2 }]), true);
  assert.equal(hasAddedBiaVacancies([vacancy], [{ ...vacancy, titular: "externo" }]), false);
  assert.equal(hasAddedBiaVacancies([], [{ ...vacancy, cotasInvestimento: 0 }]), false);
});

test("o atalho abre a criação de OBA com a BIA de origem", () => {
  const url = new URL(biaObaCreationUrl("bia / exemplo"), "http://localhost");
  assert.equal(url.pathname, "/area-aliancas");
  assert.equal(url.searchParams.get("tipo"), "obas");
  assert.equal(url.searchParams.get("criar"), "true");
  assert.equal(url.searchParams.get("bia"), "bia / exemplo");
});
