import assert from "node:assert/strict";
import test from "node:test";
import {
  getVitrinePartnerCidadeKey,
  getVitrinePartnerEstadoKey,
  getVitrinePartnerEspecialidades,
  matchesVitrinePartner,
  normalizeVitrinePartnerText,
  type VitrinePartnerSearchProfile,
} from "./vitrine-partner-search";

const parceiro: VitrinePartnerSearchProfile = {
  nome: "Gabriela Machado",
  cargo: "Engenheira Civil",
  empresa: "Projetos Zona da Mata",
  cidade: "Juiz de Fora",
  estado: "MG",
  pais: "Brasil",
  ramo_atuacao: "Arquitetura, Engenharia & Planejamento; Construção & Execução de Obras",
  segmento: "Projetos de engenharia estrutural; Estudos de viabilidade técnica e econômica",
  area_atuacao: "Regional",
  especialidade_livre: "BIM e retrofit",
  idiomas: ["Português", "Inglês"],
  Especialidades: [
    { especialidades_id: { nome_especialidade: "Engenharia estrutural" } },
  ],
};

test("busca encontra cidade sem depender de acentos ou caixa", () => {
  assert.equal(matchesVitrinePartner(parceiro, { query: "JUIZ DE FÓRA" }), true);
  assert.equal(getVitrinePartnerCidadeKey(parceiro), "juiz de fora");
  assert.equal(getVitrinePartnerEstadoKey("Minas Gerais"), "mg");
  assert.equal(getVitrinePartnerEstadoKey("MG"), "mg");
});

test("busca combina termos de localização e perfil profissional", () => {
  assert.equal(matchesVitrinePartner(parceiro, { query: "juiz estrutural" }), true);
  assert.equal(matchesVitrinePartner(parceiro, { query: "juiz arquitetura" }), true);
  assert.equal(matchesVitrinePartner(parceiro, { query: "campinas estrutural" }), false);
});

test("filtros combinam cidade, ramo, segmento, área e especialidade", () => {
  assert.equal(matchesVitrinePartner(parceiro, {
    cidade: "juiz de fora",
    estado: "mg",
    ramo: normalizeVitrinePartnerText("Arquitetura, Engenharia & Planejamento"),
    segmento: normalizeVitrinePartnerText("Projetos de engenharia estrutural"),
    areaAtuacao: "regional",
    especialidade: normalizeVitrinePartnerText("Engenharia estrutural"),
  }), true);
  assert.equal(matchesVitrinePartner(parceiro, { cidade: "campinas" }), false);
});

test("todas as especialidades oficiais e livres participam da busca", () => {
  assert.deepEqual(getVitrinePartnerEspecialidades(parceiro), [
    "BIM e retrofit",
    "Engenharia estrutural",
  ]);
  assert.equal(matchesVitrinePartner(parceiro, { especialidade: "engenharia estrutural" }), true);
  assert.equal(matchesVitrinePartner(parceiro, { especialidade: "bim e retrofit" }), true);
});

test("perfil sem localização não corresponde a um filtro de cidade", () => {
  assert.equal(matchesVitrinePartner({ nome: "Sem endereço" }, { cidade: "juiz de fora" }), false);
});
