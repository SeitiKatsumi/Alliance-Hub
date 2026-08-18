export type ContributionAreaIconKey =
  | "leadership"
  | "project"
  | "legal"
  | "intelligence"
  | "integrity"
  | "execution"
  | "supply"
  | "construction"
  | "commercial"
  | "sales"
  | "marketing"
  | "operations"
  | "relationship"
  | "investment"
  | "credit"
  | "accounting"
  | "finance";

export type ContributionAreaTone = "blue" | "emerald" | "purple" | "orange";

export type ContributionAreaDefinition = {
  value: string;
  displayName: string;
  description: string;
  iconKey: ContributionAreaIconKey;
  tone: ContributionAreaTone;
};

export type ContributionAreaGroup = {
  nucleus: string;
  areas: ContributionAreaDefinition[];
};

export const CONTRIBUTION_AREA_GROUPS: ContributionAreaGroup[] = [
  {
    nucleus: "Diretoria da Aliança",
    areas: [
      { value: "Alianças de Liderança Técnica", displayName: "Liderança Técnica", description: "Coordenação técnica, integração das alianças técnicas, viabilidade, conformidade e prevenção de riscos", iconKey: "leadership", tone: "blue" },
      { value: "Alianças de Liderança de Obras", displayName: "Liderança de Obras", description: "Coordenação da execução, integração de equipes, fornecedores, cronograma, qualidade e aderência aos projetos", iconKey: "leadership", tone: "emerald" },
      { value: "Alianças de Liderança Comercial", displayName: "Liderança Comercial", description: "Coordenação comercial, integração de vendas, locação, marketing, relacionamento e geração de receita", iconKey: "leadership", tone: "purple" },
      { value: "Alianças de Liderança de Capital", displayName: "Liderança de Capital", description: "Coordenação econômica e financeira, integração de investimentos, captação, controle, prestação de contas e resultados", iconKey: "leadership", tone: "orange" },
    ],
  },
  {
    nucleus: "Núcleo Técnico",
    areas: [
      { value: "Alianças de Projeto", displayName: "Projeto", description: "Arquitetos, engenheiros, projetistas, designers urbanistas", iconKey: "project", tone: "blue" },
      { value: "Alianças Jurídicas", displayName: "Jurídicas", description: "Especialistas em direito imobiliário, societário, contratual e compliance", iconKey: "legal", tone: "blue" },
      { value: "Alianças de Inteligência", displayName: "Inteligência", description: "Inteligência de mercado, viabilidade de produto, marketing", iconKey: "intelligence", tone: "blue" },
      { value: "Alianças de Integridade e sustentabilidade", displayName: "Integridade e sustentabilidade", description: "Compliance, segurança, qualidade, rastreamento, auditoria, ambiental, ESG", iconKey: "integrity", tone: "blue" },
    ],
  },
  {
    nucleus: "Núcleo de Obra",
    areas: [
      { value: "Alianças de Execução", displayName: "Execução", description: "Profissionais independentes, engenheiros de obra, supervisores, construtoras, empreiteiras", iconKey: "execution", tone: "emerald" },
      { value: "Alianças de Fornecimento", displayName: "Fornecimento", description: "Materiais, equipamentos e logística", iconKey: "supply", tone: "emerald" },
      { value: "Alianças de Construção", displayName: "Construção", description: "Construtoras, empreiteiras, obra civil e execução construtiva", iconKey: "construction", tone: "emerald" },
    ],
  },
  {
    nucleus: "Núcleo Comercial",
    areas: [
      { value: "Alianças Comerciais", displayName: "Comerciais", description: "Captadores, executivos de negócios, articuladores", iconKey: "commercial", tone: "purple" },
      { value: "Alianças de Vendas e Locação", displayName: "Vendas e Locação", description: "Corretores, consultores e administradores de imóveis", iconKey: "sales", tone: "purple" },
      { value: "Alianças de Marketing", displayName: "Marketing", description: "Marketing estratégico, conteúdo e criação, performance e relacionamento", iconKey: "marketing", tone: "purple" },
      { value: "Alianças de Operações e Facilities", displayName: "Operações e Facilities", description: "Manutenção, terceirização", iconKey: "operations", tone: "purple" },
      { value: "Alianças de Gestão de Relacionamento com Cliente", displayName: "Gestão de Relacionamento com Cliente", description: "Pós-venda, SAC, garantias, suporte técnico", iconKey: "relationship", tone: "purple" },
    ],
  },
  {
    nucleus: "Núcleo de Capital",
    areas: [
      { value: "Alianças de Aporte Financeiro", displayName: "Aporte Financeiro", description: "Aporte de recursos financeiros, relacionamento com investidores, cotistas e parceiros de capital", iconKey: "investment", tone: "orange" },
      { value: "Alianças de Crédito e Captação", displayName: "Crédito e Captação", description: "Crédito, financiamento, funding, captação de investidores, recursos e parceiros financeiros", iconKey: "credit", tone: "orange" },
      { value: "Alianças Contábeis e Tributárias", displayName: "Contábeis e Tributárias", description: "Contabilidade, tributos e conciliação", iconKey: "accounting", tone: "orange" },
      { value: "Alianças de Gestão Financeira", displayName: "Gestão Financeira", description: "Orçamento, caixa, controle", iconKey: "finance", tone: "orange" },
    ],
  },
];

const DISPLAY_ORDER = [
  "Liderança Técnica", "Projeto", "Jurídicas", "Inteligência", "Integridade e sustentabilidade",
  "Liderança de Obras", "Execução", "Fornecimento", "Construção",
  "Liderança Comercial", "Comerciais", "Vendas e Locação", "Marketing", "Operações e Facilities", "Gestão de Relacionamento com Cliente",
  "Liderança de Capital", "Aporte Financeiro", "Crédito e Captação", "Contábeis e Tributárias", "Gestão Financeira",
];

function normalizedKey(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getAllContributionAreas(): ContributionAreaDefinition[] {
  const order = new Map(DISPLAY_ORDER.map((name, index) => [normalizedKey(name), index]));
  return CONTRIBUTION_AREA_GROUPS
    .flatMap((group) => group.areas)
    .sort((a, b) => (order.get(normalizedKey(a.displayName)) ?? 999) - (order.get(normalizedKey(b.displayName)) ?? 999));
}

export function getContributionAreaDisplayName(value: string): string {
  const candidate = normalizedKey(value);
  const area = getAllContributionAreas().find((item) =>
    normalizedKey(item.value) === candidate || normalizedKey(item.displayName) === candidate,
  );
  if (area) return area.displayName;
  const display = String(value || "")
    .replace(/^Aliança de /i, "")
    .replace(/^Alianças de /i, "")
    .replace(/^Alianças /i, "");
  if (display === "Governança") return "Integridade e sustentabilidade";
  if (display === "Crédito" || display === "Captação") return "Crédito e Captação";
  if (display === "Investimento") return "Aporte Financeiro";
  return display;
}

export function normalizeContributionAreaValues(value: unknown): string[] {
  const candidates = Array.isArray(value) ? value : value == null ? [] : [value];
  const all = getAllContributionAreas();
  const selected = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizedKey(candidate);
    const match = all.find((item) =>
      normalizedKey(item.value) === key || normalizedKey(item.displayName) === key,
    );
    if (match) selected.add(match.value);
  }
  return all.filter((item) => selected.has(item.value)).map((item) => item.value);
}

export function getContributionNuclei(value: unknown): string[] {
  const selected = new Set(normalizeContributionAreaValues(value));
  return CONTRIBUTION_AREA_GROUPS
    .filter((group) => group.areas.some((area) => selected.has(area.value)))
    .map((group) => group.nucleus);
}
