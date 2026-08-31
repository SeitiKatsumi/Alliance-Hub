import {
  getContributionNuclei,
  normalizeContributionAreaValues,
} from "./contribution-areas";
import {
  PROFILE_AREA_SCOPE_OPTIONS,
  normalizeProfileLanguages,
} from "./profile-taxonomy";

export const INITIAL_ONBOARDING_STEPS = [
  "aceites",
  "personalizacao",
  "perfil",
  "configuracao",
  "conexoes",
  "pronto",
] as const;

export const INITIAL_ONBOARDING_LEGACY_STEPS = [
  "personalizacao",
  "perfil",
  "configuracao",
  "conexoes",
  "pronto",
  "aceites",
] as const;

export type InitialOnboardingStep = typeof INITIAL_ONBOARDING_STEPS[number];

export type InitialOnboardingInviteCompletionAction =
  | "request_aura"
  | "activate_access"
  | "preserve_status";

export function resolveInitialOnboardingInviteCompletion(invite: {
  status?: unknown;
  candidato_membro_id?: unknown;
  invitador_membro_id?: unknown;
  termos_aceitos_em?: unknown;
} | null | undefined): InitialOnboardingInviteCompletionAction {
  const status = String(invite?.status || "");
  const hasAcceptedTerms = status === "termos_aceitos"
    || (status === "termos_enviados" && Boolean(invite?.termos_aceitos_em));
  if (!hasAcceptedTerms) return "preserve_status";
  const hasCandidate = Boolean(String(invite?.candidato_membro_id || "").trim());
  const hasConnector = Boolean(String(invite?.invitador_membro_id || "").trim());
  return hasCandidate && hasConnector ? "request_aura" : "activate_access";
}

export function getInitialOnboardingSteps(flowVersion: unknown = 2): readonly InitialOnboardingStep[] {
  return Number(flowVersion || 1) >= 2 ? INITIAL_ONBOARDING_STEPS : INITIAL_ONBOARDING_LEGACY_STEPS;
}

export const INITIAL_ONBOARDING_API_ALLOWLIST = [
  "/api/me",
  "/api/login",
  "/api/logout",
  "/api/register",
  "/api/onboarding",
  "/api/files",
  "/api/convites",
  "/api/assets",
  "/api/taxonomy",
  "/api/strategic-cell-types",
  "/api/reunioes-oportunidades/convidado",
] as const;

export function isInitialOnboardingApiAllowed(url: unknown): boolean {
  const pathname = String(url || "").split(/[?#]/, 1)[0];
  return INITIAL_ONBOARDING_API_ALLOWLIST.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export const ACCOUNT_PURPOSES = ["imoveis", "profissional", "capital"] as const;
export type AccountPurpose = typeof ACCOUNT_PURPOSES[number];

export const INITIAL_ONBOARDING_OBJECTIVE_COPY: Record<AccountPurpose, { title: string; question: string }> = {
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
};

export const INITIAL_ONBOARDING_OBJECTIVES: Record<AccountPurpose, readonly string[]> = {
  imoveis: [
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
  ],
  profissional: [
    "Oferecer serviços ou soluções",
    "Participar de demandas",
    "Participar de alianças",
    "Apenas configurar meu perfil por enquanto",
  ],
  capital: [
    "Avaliar oportunidades",
    "Participar de chamadas de capital",
    "Coinvestir em alianças",
    "Apenas configurar meu perfil por enquanto",
  ],
};

export type AccountPurposeObjectives = Partial<Record<AccountPurpose, string[]>>;

export const INITIAL_ONBOARDING_PURPOSE_TONES: Record<AccountPurpose, "blue" | "emerald" | "violet"> = {
  imoveis: "blue",
  profissional: "emerald",
  capital: "violet",
};

export const INITIAL_ONBOARDING_READY_ACTION_TONES = {
  imovel: INITIAL_ONBOARDING_PURPOSE_TONES.imoveis,
  profissional: INITIAL_ONBOARDING_PURPOSE_TONES.profissional,
  capital: INITIAL_ONBOARDING_PURPOSE_TONES.capital,
  rede: "cyan",
} as const;

export const INITIAL_ONBOARDING_REQUIRED_TERM_KEYS = [
  "codigo_etica",
  "politicas_participacao_protecao",
] as const;

export const INITIAL_ONBOARDING_LOCATION_NOTICE = {
  title: "Ative a localização para continuar",
  description: "Permita que este site acesse a localização do dispositivo. Sem essa autorização, não será possível registrar os aceites e iniciar o onboarding.",
} as const;

export const INITIAL_ONBOARDING_NOTIFICATION_PREFERENCES = [
  {
    key: "connections",
    label: "Convites e solicitações de conexão",
    description: "Receber convites para conectar e participar da rede BUILT.",
    tone: "blue",
  },
  {
    key: "opportunities",
    label: "Oportunidades e demandas compatíveis",
    description: "Acompanhar oportunidades e demandas alinhadas ao seu perfil e às suas áreas.",
    tone: "emerald",
  },
  {
    key: "capital",
    label: "Chamadas de capital",
    description: "Acompanhar convites para estruturas de capital, coinvestimentos e BIAs.",
    tone: "violet",
  },
  {
    key: "messages",
    label: "Mensagens diretas",
    description: "Receber mensagens enviadas diretamente por membros da rede.",
    tone: "teal",
  },
] as const;

export function buildOnboardingRecommendationPhotoUrl(value: unknown): string | null {
  if (!value) return null;
  const raw = typeof value === "object"
    ? (value as any).id || (value as any).uuid || (value as any).directus_files_id || (value as any).file
    : value;
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(text)) return text;
  if (text.startsWith("/api/assets/")) return text;
  if (text.startsWith("/assets/")) return `/api/assets/${text.slice("/assets/".length)}`;
  return `/api/assets/${encodeURIComponent(text)}?width=96&height=96&fit=cover`;
}

export function isInitialOnboardingStep(value: unknown): value is InitialOnboardingStep {
  return getInitialOnboardingSteps(2).includes(String(value || "") as InitialOnboardingStep);
}

export function normalizeOnboardingPurposes(value: unknown): AccountPurpose[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(String).filter((item): item is AccountPurpose =>
    ACCOUNT_PURPOSES.includes(item as AccountPurpose),
  )));
}

export function normalizeAccountPurposeObjectives(
  value: unknown,
  purposes: unknown = ACCOUNT_PURPOSES,
): AccountPurposeObjectives {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const selectedPurposes = new Set(normalizeOnboardingPurposes(purposes));
  const source = value as Record<string, unknown>;

  return ACCOUNT_PURPOSES.reduce<AccountPurposeObjectives>((normalized, purpose) => {
    if (!selectedPurposes.has(purpose)) return normalized;
    const allowed = new Set(INITIAL_ONBOARDING_OBJECTIVES[purpose]);
    const selected = Array.isArray(source[purpose])
      ? Array.from(new Set(source[purpose].map((item) => String(item || "").trim()).filter((item) => allowed.has(item))))
      : [];
    normalized[purpose] = selected;
    return normalized;
  }, {});
}

export function shouldOfferOnboardingCpf(purposes: unknown): boolean {
  return normalizeOnboardingPurposes(purposes).length > 0;
}

export function buildInitialOnboardingProfileFields(profile: any, config: any): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (String(profile?.telefone || "").trim()) fields.telefone = String(profile.telefone).trim();
  if (String(profile?.professional?.empresa || "").trim()) fields.empresa = String(profile.professional.empresa).trim();
  if (String(profile?.professional?.role || "").trim()) fields.cargo = String(profile.professional.role).trim();
  if (String(profile?.cpf || "").trim()) fields.cpf = String(profile.cpf).trim();

  const contributionAreas = normalizeContributionAreaValues(config?.areas);
  if (contributionAreas.length) {
    const contributionNuclei = getContributionNuclei(contributionAreas);
    fields.tipos_alianca = contributionAreas;
    fields.tipo_alianca = contributionAreas[0];
    if (contributionNuclei.length) {
      fields.nucleos_alianca = contributionNuclei;
      fields.nucleo_alianca = contributionNuclei[0];
    }
  }

  if (String(config?.ramo_atuacao || "").trim()) fields.ramo_atuacao = String(config.ramo_atuacao).trim();
  if (String(config?.segmento || "").trim()) fields.segmento = String(config.segmento).trim();
  const areaAtuacao = String(config?.area_atuacao || "").trim();
  if (PROFILE_AREA_SCOPE_OPTIONS.some((option) => option === areaAtuacao)) fields.area_atuacao = areaAtuacao;
  if (String(config?.especialidade_livre || "").trim()) fields.especialidade_livre = String(config.especialidade_livre).trim();
  const profileLanguages = normalizeProfileLanguages(config?.idiomas);
  if (profileLanguages.length) fields.idiomas = profileLanguages;
  return fields;
}

export function nextOnboardingStep(step: InitialOnboardingStep, flowVersion: unknown = 2): InitialOnboardingStep {
  const steps = getInitialOnboardingSteps(flowVersion);
  const index = steps.indexOf(step);
  return steps[Math.min(index + 1, steps.length - 1)];
}

export function firstPendingOnboardingStep(completed: unknown, flowVersion: unknown = 2): InitialOnboardingStep {
  const steps = getInitialOnboardingSteps(flowVersion);
  const done = new Set(Array.isArray(completed) ? completed.map(String) : []);
  return steps.find((step) => !done.has(step)) || steps[steps.length - 1];
}

export function canAccessOnboardingStep(current: InitialOnboardingStep, requested: InitialOnboardingStep, flowVersion: unknown = 2) {
  const steps = getInitialOnboardingSteps(flowVersion);
  return steps.indexOf(requested) <= steps.indexOf(current);
}

export function getInitialOnboardingVisibleStepNumber(step: InitialOnboardingStep, flowVersion: unknown = 2): number | null {
  if (step === "aceites") return Number(flowVersion || 1) >= 2 ? null : 5;
  const visibleSteps: InitialOnboardingStep[] = ["personalizacao", "perfil", "configuracao", "conexoes", "pronto"];
  const index = visibleSteps.indexOf(step);
  return index >= 0 ? index + 1 : null;
}

export function validateOnboardingStepPayload(step: InitialOnboardingStep, payload: any): string | null {
  if (!payload || typeof payload !== "object") return "Dados da etapa não informados.";
  if (step === "personalizacao") {
    const purposes = normalizeOnboardingPurposes(payload.purposes);
    if (purposes.length === 0) return "Selecione ao menos uma finalidade.";
    if (!String(payload.start_destination || "").trim()) return "Escolha por onde deseja começar.";
  }
  if (step === "perfil") {
    const purposes = normalizeOnboardingPurposes(payload.purposes);
    if (purposes.includes("profissional") && !String(payload.professional?.role || "").trim()) {
      return "Informe sua função profissional.";
    }
  }
  if (step === "configuracao" && !String(payload.visibility || "").trim()) {
    return "Defina a visibilidade inicial.";
  }
  return null;
}
