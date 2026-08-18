import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import InitialOnboardingPage from "@/pages/initial-onboarding";
import { queryClient } from "@/lib/queryClient";
import "@/index.css";

const previewSteps = ["personalizacao", "perfil", "configuracao", "conexoes", "pronto"] as const;
const previewRouteSteps = ["aceites", ...previewSteps] as const;
const requestedStep = new URLSearchParams(window.location.search).get("step");
const initialStep = previewRouteSteps.includes(requestedStep as (typeof previewRouteSteps)[number])
  ? requestedStep as (typeof previewRouteSteps)[number]
  : "personalizacao";
const initialVisibleStepIndex = previewSteps.indexOf(initialStep as (typeof previewSteps)[number]);
const initialCompletedSteps = initialStep === "aceites"
  ? []
  : ["aceites", ...previewSteps.slice(0, Math.max(initialVisibleStepIndex, 0))];

const previewLocation = memoryLocation({ path: `/onboarding/${initialStep}` });

const previewResponses = {
  personalizacao: {
    purposes: ["imoveis", "profissional", "capital"],
    objectives: {
      imoveis: ["Vender", "Reformar", "Buscar investidores"],
      profissional: ["Oferecer serviços ou soluções", "Participar de alianças"],
      capital: ["Avaliar oportunidades", "Coinvestir em alianças"],
    },
    start_destination: "imovel",
  },
  perfil: {
    purposes: ["imoveis", "profissional", "capital"],
    telefone: "(31) 99999-9999",
    cpf: "123.456.789-00",
    professional: { empresa: "BUILT Engenharia", role: "Diretor de Projetos", registro: "CAU A12345-6" },
    capital: { type: "pessoa_fisica", range: "Até R$ 1 milhão" },
  },
  configuracao: {
    purposes: ["imoveis", "profissional", "capital"],
    areas: ["Alianças de Liderança Técnica", "Alianças de Projeto", "Alianças de Construção", "Alianças Comerciais"],
    ramo_atuacao: "Arquitetura, Engenharia & Planejamento",
    segmento: "Projetos de arquitetura",
    area_atuacao: "Regional",
    especialidade_livre: "Projetos executivos, BIM e coordenação multidisciplinar",
    idiomas: ["Português", "Inglês"],
    visibility: "private",
  },
  conexoes: { connections: true, opportunities: true, capital: false, messages: true },
};

const previewData = {
  required: true,
  journey: {
    id: "preview-only",
    flow_version: 2,
    current_step: initialStep,
    completed_steps: initialCompletedSteps,
    responses: previewResponses,
    status: "em_andamento",
    start_destination: "imovel",
    updated_at: "2026-08-18T00:00:00.000Z",
  },
  next_url: `/onboarding/${initialStep}`,
  profile: { nome: "Prévia BUILT", email: "preview@built.com.br" },
  comunidade: { nome: "BUILT Brasil | Belo Horizonte | Comunidade A01", territorio: "Belo Horizonte", pais: "Brasil" },
  recommendations: [
    { id: "1", nome: "Marcos Tavares", descricao: "Engenheiro Civil", foto: "/api/assets/6a52d331-1631-4fab-b2cc-7e68d1357a2d?width=96&height=96&fit=cover" },
    { id: "2", nome: "Juliana Mendes", descricao: "Arquitetura e Projetos", foto: "/api/assets/1e2983ee-d739-492a-a13d-f5f398676c87?width=96&height=96&fit=cover" },
    { id: "3", nome: "Rafael Gonçalves", descricao: "Especialista em Estruturas", foto: "/api/assets/3fc60822-3710-421d-bd8d-be1962c5fe6e?width=96&height=96&fit=cover" },
  ],
  terms: [
    { key: "codigo_etica", titulo: "Código de Ética BUILT", versao: "BUILT JUR - 1", origem: "BUILT", body: "Princípios éticos aplicáveis à participação na plataforma BUILT." },
    { key: "politicas_participacao_protecao", titulo: "Políticas de Participação e Proteção", versao: "BUILT JUR - 1", origem: "BUILT", body: "Regras de participação, privacidade, proteção e uso responsável da plataforma." },
  ],
};

const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(rawUrl, window.location.origin);
  if (url.pathname === "/api/onboarding") {
    return new Response(JSON.stringify(previewData), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname.startsWith("/api/onboarding/etapas/")) {
    const current = url.pathname.split("/").pop() || "personalizacao";
    const index = previewSteps.indexOf(current as (typeof previewSteps)[number]);
    const next = previewSteps[Math.min(Math.max(index, 0) + 1, previewSteps.length - 1)];
    const result = current === "pronto"
      ? { success: true, redirect_url: "/" }
      : { success: true, draft: url.searchParams.get("draft") === "1", next_url: `/onboarding/${next}?preview=1` };
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname === "/api/onboarding/finalizar-aceites") {
    return new Response(JSON.stringify({ success: true, next_url: "/onboarding/personalizacao" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Router hook={previewLocation.hook}>
      <InitialOnboardingPage />
    </Router>
  </QueryClientProvider>,
);
