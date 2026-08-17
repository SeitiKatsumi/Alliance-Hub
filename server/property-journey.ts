export const ACCOUNT_PURPOSES = ["imoveis", "profissional", "capital"] as const;
export type AccountPurpose = typeof ACCOUNT_PURPOSES[number];

export const PROPERTY_ASSISTANT_STEPS = ["intencao", "cadastro", "analise", "conexao", "concluido"] as const;
export type PropertyAssistantStep = typeof PROPERTY_ASSISTANT_STEPS[number];

export const PROPERTY_INTENTS = [
  "gerir",
  "vender",
  "alugar",
  "reformar",
  "construir",
  "regularizar",
  "estruturar_alianca",
] as const;
export type PropertyIntent = typeof PROPERTY_INTENTS[number];

export const PROPERTY_PATHS = ["imovel", "oportunidade"] as const;
export const PROPERTY_METHODS = ["conversa", "cartorio", "documentos", "manual"] as const;
export type PropertyPath = typeof PROPERTY_PATHS[number];
export type PropertyMethod = typeof PROPERTY_METHODS[number];

export type InitialPropertyJourney = {
  path: PropertyPath;
  intencao: PropertyIntent;
  method?: PropertyMethod;
};

export type PropertyExtractionConflict = {
  atual: unknown;
  extraido: unknown;
  fonte?: string | null;
};

const PROPERTY_INTENT_SPECIALTIES: Record<PropertyIntent, string[]> = {
  gerir: [
    "administração de imóveis",
    "gestão imobiliária",
    "gestão patrimonial",
    "property management",
    "administração condominial",
  ],
  vender: [
    "corretor de imóveis",
    "corretagem imobiliária",
    "vendas imobiliárias",
    "avaliação imobiliária",
    "imobiliária",
  ],
  alugar: [
    "locação imobiliária",
    "administração de imóveis",
    "gestão de locação",
    "corretor de imóveis",
    "imobiliária",
  ],
  reformar: [
    "reforma",
    "arquitetura",
    "engenharia civil",
    "design de interiores",
    "construção civil",
    "obras",
  ],
  construir: [
    "arquitetura",
    "engenharia civil",
    "construção civil",
    "gestão de obras",
    "incorporação imobiliária",
    "projetos",
  ],
  regularizar: [
    "regularização imobiliária",
    "direito imobiliário",
    "advocacia imobiliária",
    "topografia",
    "cartório",
    "engenharia civil",
    "arquitetura",
  ],
  estruturar_alianca: [
    "estruturação de negócios",
    "negócios imobiliários",
    "direito imobiliário",
    "investimentos imobiliários",
    "gestão de projetos",
    "alianças",
  ],
};

export type PropertyProfessionalMatchInput = {
  intent: unknown;
  suggestedSpecialties?: unknown[];
  professionalSpecialties?: unknown[];
  propertyCity?: unknown;
  propertyState?: unknown;
  professionalCity?: unknown;
  professionalState?: unknown;
  isBuiltMember?: boolean;
  hasProfessionalProfile?: boolean;
};

export const DEMAND_KINDS = ["venda", "locacao", "servico_fornecimento"] as const;
export type DemandKind = typeof DEMAND_KINDS[number];

export const DEMAND_DISTRIBUTION_MODES = ["direcionada", "pulso"] as const;
export type DemandDistributionMode = typeof DEMAND_DISTRIBUTION_MODES[number];

export const DEMAND_CLOSURE_REASONS = [
  "contratacao",
  "desistencia",
  "necessidade_alterada",
  "sem_profissional_adequado",
  "preco",
  "prazo",
  "duplicidade",
  "outro",
] as const;
export type DemandClosureReason = typeof DEMAND_CLOSURE_REASONS[number];

export function normalizeAccountPurposes(value: unknown): AccountPurpose[] {
  const values = Array.isArray(value) ? value : [];
  return Array.from(new Set(values
    .map((item) => String(item || "").trim().toLowerCase())
    .map((item) => item === "vitrine" || item === "prestador" ? "profissional" : item)
    .filter((item): item is AccountPurpose => ACCOUNT_PURPOSES.includes(item as AccountPurpose))));
}

export function resolveAccountPurposesForInvite(value: unknown, inviteType: unknown): AccountPurpose[] {
  const requested = normalizeAccountPurposes(value);
  if (requested.length > 0) return requested;

  const legacyDefaults: Record<string, AccountPurpose[]> = {
    vitrine: ["profissional"],
    capital: ["capital"],
    membros: ["profissional"],
    associacao_completa: ["profissional"],
  };
  const normalizedInviteType = String(inviteType || "unificado").trim().toLowerCase();
  return legacyDefaults[normalizedInviteType] || ["imoveis"];
}

export function normalizePropertyAssistantStep(value: unknown): PropertyAssistantStep {
  const normalized = String(value || "").trim().toLowerCase();
  return PROPERTY_ASSISTANT_STEPS.includes(normalized as PropertyAssistantStep)
    ? normalized as PropertyAssistantStep
    : "intencao";
}

export function normalizePropertyIntent(value: unknown): PropertyIntent {
  const normalized = String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ -]+/g, "_");
  return PROPERTY_INTENTS.includes(normalized as PropertyIntent)
    ? normalized as PropertyIntent
    : "gerir";
}

export function normalizePropertyMethod(value: unknown): PropertyMethod | null {
  const normalized = String(value || "").trim().toLowerCase();
  return PROPERTY_METHODS.includes(normalized as PropertyMethod)
    ? normalized as PropertyMethod
    : null;
}

export function normalizeInitialPropertyJourney(value: unknown): InitialPropertyJourney | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const path = String(input.path || "").trim().toLowerCase();
  const intent = String(input.intencao || "").trim().toLowerCase();
  const rawMethod = String(input.method || "").trim();
  const method = normalizePropertyMethod(rawMethod);
  if (
    !PROPERTY_PATHS.includes(path as PropertyPath)
    || !PROPERTY_INTENTS.includes(intent as PropertyIntent)
    || (rawMethod && !method)
  ) return null;
  const journey: InitialPropertyJourney = {
    path: path as PropertyPath,
    intencao: intent as PropertyIntent,
  };
  if (method) journey.method = method;
  return journey;
}

function isEmptyPropertyValue(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function comparablePropertyValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().toLocaleLowerCase("pt-BR");
  }
  return JSON.stringify(value);
}

export function mergePropertyExtraction(
  currentDraft: Record<string, unknown>,
  extractedDraft: Record<string, unknown>,
  source?: string | null,
) {
  const draft = { ...currentDraft };
  const conflicts: Record<string, PropertyExtractionConflict> = {};

  for (const [field, extracted] of Object.entries(extractedDraft || {})) {
    if (isEmptyPropertyValue(extracted)) continue;
    const current = draft[field];
    if (isEmptyPropertyValue(current)) {
      draft[field] = extracted;
      continue;
    }
    if (comparablePropertyValue(current) !== comparablePropertyValue(extracted)) {
      conflicts[field] = { atual: current, extraido: extracted, fonte: source || null };
    }
  }

  return { draft, conflicts };
}

export function normalizeDemandKind(value: unknown): DemandKind {
  const normalized = String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ -]+/g, "_");
  const aliases: Record<string, DemandKind> = {
    vender: "venda",
    aluguel: "locacao",
    alugar: "locacao",
    servico: "servico_fornecimento",
    fornecimento: "servico_fornecimento",
  };
  const candidate = aliases[normalized] || normalized;
  return DEMAND_KINDS.includes(candidate as DemandKind)
    ? candidate as DemandKind
    : "servico_fornecimento";
}

export function normalizeDemandDistributionMode(value: unknown): DemandDistributionMode {
  return String(value || "").trim().toLowerCase() === "direcionada" ? "direcionada" : "pulso";
}

export function normalizeDemandClosureReason(value: unknown): DemandClosureReason | null {
  const normalized = String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[ -]+/g, "_");
  return DEMAND_CLOSURE_REASONS.includes(normalized as DemandClosureReason)
    ? normalized as DemandClosureReason
    : null;
}

export function nextPropertyAssistantStep(current: unknown): PropertyAssistantStep {
  const step = normalizePropertyAssistantStep(current);
  const index = PROPERTY_ASSISTANT_STEPS.indexOf(step);
  return PROPERTY_ASSISTANT_STEPS[Math.min(PROPERTY_ASSISTANT_STEPS.length - 1, index + 1)];
}

export function isProfessionalPurpose(purposes: unknown) {
  const normalized = normalizeAccountPurposes(purposes);
  return normalized.includes("profissional") || normalized.includes("capital");
}

export function normalizeJourneySearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function propertyIntentSpecialties(intent: unknown) {
  return PROPERTY_INTENT_SPECIALTIES[normalizePropertyIntent(intent)];
}

export function scorePropertyProfessionalMatch(input: PropertyProfessionalMatchInput) {
  const requested = Array.from(new Set([
    ...propertyIntentSpecialties(input.intent),
    ...(Array.isArray(input.suggestedSpecialties) ? input.suggestedSpecialties : []),
  ].map(normalizeJourneySearchText).filter((value) => value.length >= 4)));
  const specialties = (Array.isArray(input.professionalSpecialties) ? input.professionalSpecialties : [])
    .map((label) => ({ label: String(label || "").trim(), normalized: normalizeJourneySearchText(label) }))
    .filter((item) => item.normalized.length >= 4);
  const matchedSpecialties = specialties.filter((specialty) => requested.some((term) =>
    specialty.normalized.includes(term) || term.includes(specialty.normalized),
  ));
  const uniqueMatches = Array.from(new Map(matchedSpecialties.map((item) => [item.normalized, item.label])).values());

  // Location and membership refine a professional match; they never create one.
  if (!uniqueMatches.length) {
    return { eligible: false, score: 0, matchedSpecialties: [], reasons: [] as string[] };
  }

  let score = 50 + Math.min(20, Math.max(0, uniqueMatches.length - 1) * 10);
  const reasons = [`Especialidade: ${uniqueMatches.slice(0, 2).join(", ")}`];
  const propertyCity = normalizeJourneySearchText(input.propertyCity);
  const propertyState = normalizeJourneySearchText(input.propertyState);
  const professionalCity = normalizeJourneySearchText(input.professionalCity);
  const professionalState = normalizeJourneySearchText(input.professionalState);
  if (propertyCity && professionalCity === propertyCity) {
    score += 20;
    reasons.push("Atua na mesma cidade");
  } else if (propertyState && professionalState === propertyState) {
    score += 10;
    reasons.push("Atua no mesmo estado");
  }
  if (input.isBuiltMember) {
    score += 5;
    reasons.push("Membro da rede BUILT");
  }
  if (input.hasProfessionalProfile) {
    score += 5;
    reasons.push("Perfil profissional preenchido");
  }

  return {
    eligible: true,
    score: Math.min(100, score),
    matchedSpecialties: uniqueMatches,
    reasons,
  };
}
