import assert from "node:assert/strict";
import test from "node:test";
import { getProfileCompletion, getProfileCompletionPath, type ProfileCompletionSource } from "./profile-completion";

const completeProfile: ProfileCompletionSource = {
  foto_perfil: "foto-id",
  nome: "Maria da Silva",
  nome_completo: "Maria Aparecida da Silva",
  email: "maria@example.com",
  cpf: "123.456.789-00",
  telefone: "+55 11 99999-9999",
  whatsapp: "+55 11 99999-9999",
  nacionalidade: "Brasileira",
  data_nascimento: "1990-01-01",
  rg: "12.345.678-9",
  estado_civil: "solteiro",
  cidade: "São Paulo",
  estado: "São Paulo",
  pais: "Brasil",
  endereco: "Rua Exemplo",
  numero: "10",
  tipos_alianca: ["Projeto"],
  cargo: "Arquiteta",
  ramo_atuacao: "Construção",
  segmento: "Projetos",
  area_atuacao: "Regional",
  especialidade_livre: "Arquitetura residencial",
  idiomas: ["Português"],
  perfil_aliado: "Atua com projetos residenciais.",
  link_site: "https://example.com",
};

test("perfil sem dados inicia em zero e informa os campos faltantes", () => {
  const result = getProfileCompletion({});
  assert.equal(result.percentage, 0);
  assert.equal(result.completedCount, 0);
  assert.ok(result.missing.some((item) => item.key === "foto"));
  assert.ok(result.missing.some((item) => item.key === "especialidade"));
});

test("perfil recomendado preenchido alcança cem por cento", () => {
  const result = getProfileCompletion(completeProfile);
  assert.equal(result.percentage, 100);
  assert.equal(result.missing.length, 0);
});

test("pendência informa o nome do campo que deve ser preenchido", () => {
  const { link_site: _linkSite, ...profileWithoutSite } = completeProfile;
  const result = getProfileCompletion(profileWithoutSite);
  assert.deepEqual(result.missing.map((item) => item.label), ["Site ou portfólio"]);
});

test("nome público não substitui o nome completo de formalização", () => {
  const { nome_completo: _nomeCompleto, ...profileWithoutFormalName } = completeProfile;
  const result = getProfileCompletion(profileWithoutFormalName);
  assert.deepEqual(result.missing.map((item) => item.key), ["nome_completo"]);
  assert.equal(result.missing[0]?.label, "Nome completo para formalização");
  assert.equal(getProfileCompletionPath(profileWithoutFormalName), "/meu-perfil?campo=nome_completo");
});

test("perfil completo abre o perfil sem apontar um campo", () => {
  assert.equal(getProfileCompletionPath(completeProfile), "/meu-perfil");
});

test("empresa informada exige CNPJ e marca para completar o perfil", () => {
  const incomplete = getProfileCompletion({ ...completeProfile, empresa: "BUILT" });
  assert.ok(incomplete.percentage < 100);
  assert.deepEqual(incomplete.missing.map((item) => item.key), ["cnpj", "logo_empresa"]);

  const complete = getProfileCompletion({
    ...completeProfile,
    empresa: "BUILT",
    cnpj: "00.000.000/0001-00",
    logo_empresa: "logo-id",
  });
  assert.equal(complete.percentage, 100);
});

test("pessoa casada recebe pendências específicas do cônjuge", () => {
  const result = getProfileCompletion({ ...completeProfile, estado_civil: "casado" });
  assert.deepEqual(result.missing.map((item) => item.key), ["regime_comunhao", "conjuge_nome"]);
});
