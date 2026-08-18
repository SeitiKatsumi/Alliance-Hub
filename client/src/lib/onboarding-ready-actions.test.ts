import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  onboardingAcceptanceUrl,
  onboardingReadyDestinationFromSearch,
  onboardingReadyDestinationHref,
} from "./onboarding-ready-actions";

describe("ações finais do onboarding", () => {
  it("mantém destinos oficiais para cada card", () => {
    assert.equal(onboardingReadyDestinationHref("imovel"), "/carteira/novo");
    assert.equal(onboardingReadyDestinationHref("profissional"), "/meu-perfil");
    assert.equal(onboardingReadyDestinationHref("capital"), "/built-capital");
    assert.equal(onboardingReadyDestinationHref("rede"), "/vitrine/parceiros");
  });

  it("preserva o destino escolhido durante os aceites", () => {
    const url = onboardingAcceptanceUrl("capital");
    assert.equal(url, "/onboarding/aceites?destino=capital");
    assert.equal(onboardingReadyDestinationFromSearch("?destino=capital"), "capital");
  });

  it("ignora destinos manipulados ou desconhecidos", () => {
    assert.equal(onboardingReadyDestinationFromSearch("?destino=https://example.com"), null);
    assert.equal(onboardingReadyDestinationHref("desconhecido"), null);
  });
});
