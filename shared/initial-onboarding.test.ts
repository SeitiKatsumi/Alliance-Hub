import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOnboardingRecommendationPhotoUrl,
  buildInitialOnboardingProfileFields,
  canAccessOnboardingStep,
  firstPendingOnboardingStep,
  getInitialOnboardingSteps,
  getInitialOnboardingVisibleStepNumber,
  isInitialOnboardingApiAllowed,
  INITIAL_ONBOARDING_OBJECTIVE_COPY,
  INITIAL_ONBOARDING_OBJECTIVES,
  INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES,
  INITIAL_ONBOARDING_LOCATION_NOTICE,
  INITIAL_ONBOARDING_PURPOSE_TONES,
  INITIAL_ONBOARDING_READY_ACTION_TONES,
  INITIAL_ONBOARDING_REQUIRED_TERM_KEYS,
  nextOnboardingStep,
  normalizeAccountPurposeObjectives,
  normalizeOnboardingPurposes,
  resolveInitialOnboardingInviteCompletion,
  shouldOfferOnboardingCpf,
  validateOnboardingStepPayload,
} from "./initial-onboarding";

test("encaminha o convite para a Aura do aliado conector logo apos os aceites", () => {
  assert.equal(resolveInitialOnboardingInviteCompletion({
    status: "termos_aceitos",
    candidato_membro_id: "candidato-1",
    invitador_membro_id: "conector-1",
  }), "request_aura");
  assert.equal(resolveInitialOnboardingInviteCompletion({
    status: "termos_aceitos",
    candidato_membro_id: "candidato-1",
    invitador_membro_id: null,
  }), "activate_access");
  assert.equal(resolveInitialOnboardingInviteCompletion({
    status: "aguardando_avaliacao_aura",
    candidato_membro_id: "candidato-1",
    invitador_membro_id: "conector-1",
  }), "preserve_status");
  assert.equal(resolveInitialOnboardingInviteCompletion({
    status: "termos_enviados",
    termos_aceitos_em: new Date(),
    candidato_membro_id: "candidato-1",
    invitador_membro_id: "conector-1",
  }), "request_aura");
});

test("mantém os títulos e perguntas oficiais dos blocos de intenção", () => {
  assert.deepEqual(INITIAL_ONBOARDING_OBJECTIVE_COPY, {
    imoveis: {
      title: "Imóvel ou oportunidade",
      question: "Qual a sua intenção com este ativo?",
    },
    profissional: {
      title: "Profissional, fornecedor ou empresa",
      question: "Como você quer atuar na BUILT?",
    },
    capital: {
      title: "Parceiro de capital",
      question: "Como você quer atuar com capital?",
    },
  });
});

test("mantém uma única taxonomia de intenções para onboarding e edição do perfil", () => {
  assert.deepEqual(INITIAL_ONBOARDING_OBJECTIVES.imoveis, [
    "Vender",
    "Alugar",
    "Reformar",
    "Construir",
    "Regularizar",
    "Buscar orçamento",
    "Buscar aliados",
    "Buscar investidores",
    "Estruturar uma Aliança BUILT",
    "Apenas cadastrar por enquanto",
  ]);
  assert.deepEqual(INITIAL_ONBOARDING_OBJECTIVES.profissional, [
    "Oferecer serviços ou soluções",
    "Participar de demandas",
    "Participar de alianças",
    "Apenas configurar meu perfil por enquanto",
  ]);
  assert.deepEqual(INITIAL_ONBOARDING_OBJECTIVES.capital, [
    "Avaliar oportunidades",
    "Participar de chamadas de capital",
    "Coinvestir em alianças",
    "Apenas configurar meu perfil por enquanto",
  ]);
});

test("normaliza intenções apenas para finalidades ativas e opções oficiais", () => {
  assert.deepEqual(normalizeAccountPurposeObjectives({
    imoveis: ["Vender", " Vender ", "Opção inventada"],
    profissional: ["Participar de demandas"],
    capital: "Avaliar oportunidades",
  }, ["imoveis", "capital"]), {
    imoveis: ["Vender"],
    capital: [],
  });
});

test("mantém a identidade visual oficial de cada perfil do onboarding", () => {
  assert.deepEqual(INITIAL_ONBOARDING_PURPOSE_TONES, {
    imoveis: "blue",
    profissional: "emerald",
    capital: "violet",
  });
});

test("mantém cores distintas nas ações recomendadas da conclusão", () => {
  assert.deepEqual(INITIAL_ONBOARDING_READY_ACTION_TONES, {
    imovel: "blue",
    profissional: "emerald",
    capital: "violet",
    rede: "cyan",
  });
});

test("mantém informações completas nas preferências de atualização", () => {
  assert.deepEqual(INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES.map((item) => item.key), [
    "connections",
    "opportunities",
    "capital",
    "messages",
  ]);
  assert.equal(INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES.every((item) => item.description.length > 30), true);
});

test("normaliza fotos de recomendação vindas do Directus ou de URL externa", () => {
  assert.equal(
    buildOnboardingRecommendationPhotoUrl("foto-uuid"),
    "/api/assets/foto-uuid?width=96&height=96&fit=cover",
  );
  assert.equal(
    buildOnboardingRecommendationPhotoUrl({ id: "foto-uuid" }),
    "/api/assets/foto-uuid?width=96&height=96&fit=cover",
  );
  assert.equal(
    buildOnboardingRecommendationPhotoUrl("https://images.example.com/perfil.jpg"),
    "https://images.example.com/perfil.jpg",
  );
  assert.equal(buildOnboardingRecommendationPhotoUrl(null), null);
});

test("libera imagens necessárias no onboarding sem abrir APIs vizinhas", () => {
  assert.equal(isInitialOnboardingApiAllowed("/api/assets/foto-uuid?width=96"), true);
  assert.equal(isInitialOnboardingApiAllowed("/api/onboarding/etapas/conexoes"), true);
  assert.equal(isInitialOnboardingApiAllowed("/api/taxonomy/public-labels"), true);
  assert.equal(isInitialOnboardingApiAllowed("/api/membros"), false);
  assert.equal(isInitialOnboardingApiAllowed("/api/admin"), false);
});

test("normaliza finalidades múltiplas sem duplicar valores", () => {
  assert.deepEqual(normalizeOnboardingPurposes(["imoveis", "capital", "imoveis", "desconhecido"]), ["imoveis", "capital"]);
});

test("coloca os aceites antes do onboarding no fluxo novo", () => {
  assert.deepEqual(getInitialOnboardingSteps(2), ["aceites", "personalizacao", "perfil", "configuracao", "conexoes", "pronto"]);
  assert.equal(nextOnboardingStep("aceites", 2), "personalizacao");
  assert.equal(nextOnboardingStep("personalizacao"), "perfil");
  assert.equal(nextOnboardingStep("pronto"), "pronto");
  assert.equal(firstPendingOnboardingStep(["aceites", "personalizacao", "perfil"]), "configuracao");
  assert.equal(canAccessOnboardingStep("configuracao", "perfil"), true);
  assert.equal(canAccessOnboardingStep("configuracao", "conexoes"), false);
});

test("preserva a sequência antiga para jornadas já iniciadas", () => {
  assert.deepEqual(getInitialOnboardingSteps(1), ["personalizacao", "perfil", "configuracao", "conexoes", "pronto", "aceites"]);
  assert.equal(nextOnboardingStep("pronto", 1), "aceites");
  assert.equal(firstPendingOnboardingStep(["personalizacao", "perfil"], 1), "configuracao");
});

test("não apresenta os aceites iniciais como etapa cinco", () => {
  assert.equal(getInitialOnboardingVisibleStepNumber("aceites", 2), null);
  assert.equal(getInitialOnboardingVisibleStepNumber("personalizacao", 2), 1);
  assert.equal(getInitialOnboardingVisibleStepNumber("pronto", 2), 5);
  assert.equal(getInitialOnboardingVisibleStepNumber("aceites", 1), 5);
});

test("informa que a localização é obrigatória para registrar os aceites", () => {
  assert.match(INITIAL_ONBOARDING_LOCATION_NOTICE.title, /localização/i);
  assert.match(INITIAL_ONBOARDING_LOCATION_NOTICE.description, /não será possível/i);
});

test("mantém no onboarding apenas os termos gerais da plataforma", () => {
  assert.deepEqual(INITIAL_ONBOARDING_REQUIRED_TERM_KEYS, [
    "codigo_etica",
    "politicas_participacao_protecao",
  ]);
  assert.equal(INITIAL_ONBOARDING_REQUIRED_TERM_KEYS.includes("vitrine" as never), false);
  assert.equal(INITIAL_ONBOARDING_REQUIRED_TERM_KEYS.includes("built_capital" as never), false);
});

test("personalização exige finalidade e destino inicial", () => {
  assert.equal(validateOnboardingStepPayload("personalizacao", { purposes: [] }), "Selecione ao menos uma finalidade.");
  assert.equal(validateOnboardingStepPayload("personalizacao", { purposes: ["imoveis"] }), "Escolha por onde deseja começar.");
  assert.equal(validateOnboardingStepPayload("personalizacao", { purposes: ["imoveis"], start_destination: "imovel" }), null);
});

test("perfil exclusivo de imóvel não exige CPF", () => {
  assert.equal(validateOnboardingStepPayload("perfil", { purposes: ["imoveis"] }), null);
});

test("oferece preenchimento opcional de CPF também no perfil exclusivo de imóvel", () => {
  assert.equal(shouldOfferOnboardingCpf(["imoveis"]), true);
  assert.equal(shouldOfferOnboardingCpf([]), false);
});

test("sincroniza configuração do onboarding com os campos oficiais do perfil", () => {
  assert.deepEqual(buildInitialOnboardingProfileFields(
    { telefone: " 31999999999 ", cpf: " 123.456.789-00 " },
    {
      areas: ["Projeto", "Alianças de Aporte Financeiro"],
      ramo_atuacao: "Arquitetura, Engenharia & Planejamento",
      segmento: "Projetos de arquitetura",
      area_atuacao: "Local",
      especialidade_livre: " BIM ",
      idiomas: ["Português", "Inglês", "Português"],
    },
  ), {
    telefone: "31999999999",
    cpf: "123.456.789-00",
    tipos_alianca: ["Alianças de Projeto", "Alianças de Aporte Financeiro"],
    tipo_alianca: "Alianças de Projeto",
    nucleos_alianca: ["Núcleo Técnico", "Núcleo de Capital"],
    nucleo_alianca: "Núcleo Técnico",
    ramo_atuacao: "Arquitetura, Engenharia & Planejamento",
    segmento: "Projetos de arquitetura",
    area_atuacao: "Local",
    especialidade_livre: "BIM",
    idiomas: ["Português", "Inglês"],
  });
});

test("perfil profissional exige somente a função nesta versão", () => {
  assert.equal(validateOnboardingStepPayload("perfil", { purposes: ["profissional"], professional: {} }), "Informe sua função profissional.");
  assert.equal(validateOnboardingStepPayload("perfil", { purposes: ["profissional"], professional: { role: "Arquiteta" } }), null);
});

test("configuração exige visibilidade explícita", () => {
  assert.equal(validateOnboardingStepPayload("configuracao", {}), "Defina a visibilidade inicial.");
  assert.equal(validateOnboardingStepPayload("configuracao", { visibility: "private" }), null);
});
