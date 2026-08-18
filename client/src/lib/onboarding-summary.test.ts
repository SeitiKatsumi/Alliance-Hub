import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOnboardingConfigurationSummary } from "./onboarding-summary";

describe("buildOnboardingConfigurationSummary", () => {
  it("leva áreas de contribuição e a classificação de atuação ao resumo", () => {
    const summary = buildOnboardingConfigurationSummary({
      areas: ["Alianças de Liderança Técnica", "Alianças de Construção"],
      ramo_atuacao: "Arquitetura, Engenharia & Planejamento; Construção & Execução de Obras",
      segmento: "Projetos de arquitetura; Construção de edifícios residenciais",
      area_atuacao: "Regional",
      especialidade_livre: "BIM e retrofit",
      idiomas: ["Português", "Inglês"],
    });

    assert.deepEqual(summary.contributionAreas, ["Liderança Técnica", "Construção"]);
    assert.deepEqual(summary.activity, [
      { label: "Ramo", value: "Arquitetura, Engenharia & Planejamento, Construção & Execução de Obras" },
      { label: "Segmento", value: "Projetos de arquitetura, Construção de edifícios residenciais" },
      { label: "Área de atuação", value: "Regional" },
      { label: "Especialidade", value: "BIM e retrofit" },
      { label: "Idiomas", value: "Português, Inglês" },
    ]);
  });

  it("omite blocos ainda não preenchidos", () => {
    assert.deepEqual(buildOnboardingConfigurationSummary({}), { contributionAreas: [], activity: [] });
  });
});
