export type Dimensao = "T" | "R" | "C";

export interface PalavraClassificada {
  canonico: string;
  dimensao: Dimensao;
  valorBuilt: boolean;
  polaridade: "positiva" | "negativa";
  gravidade?: "leve" | "moderada" | "grave" | "critica";
  fatorGravidade?: number;
  valorAfetado?: string;
  recomendacao?: string;
  impactaScore: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Polaridade = "positiva" | "negativa";
type GravidadeNegativa = "leve" | "moderada" | "grave" | "critica";

type LexicoEntry = {
  canonico: string;
  dimensao: Dimensao;
  valorBuilt: boolean;
  polaridade: Polaridade;
  gravidade?: GravidadeNegativa;
  fatorGravidade?: number;
  valorAfetado?: string;
  recomendacao?: string;
  impactaScore: boolean;
};

const RAW: Array<{ canonico: string; dimensao: Dimensao; sinonimos: string[] }> = [
  { canonico: "Integridade", dimensao: "C", sinonimos: ["honesto", "ética", "ético", "íntegro", "confiável", "justo", "verdadeiro", "caráter", "transparência", "coerente", "leal", "sinceridade", "sincero", "honestidade"] },
  { canonico: "Responsabilidade", dimensao: "T", sinonimos: ["responsável", "comprometido", "cumpre promessa", "assume erro", "presta contas", "accountability", "disciplinado", "consciente", "confiável", "responsabilidade"] },
  { canonico: "Excelência", dimensao: "T", sinonimos: ["qualidade", "caprichoso", "exigente", "perfeccionista", "detalhista", "alto padrão", "primoroso", "cuidadoso", "meticuloso", "impecável", "perfeito", "preciso", "precisão"] },
  { canonico: "Protagonismo", dimensao: "C", sinonimos: ["proativo", "iniciativa", "faz acontecer", "empreendedor", "líder", "autônomo", "executor", "realizador", "resolvedor", "agente de mudança", "protagonista"] },
  { canonico: "Aliança", dimensao: "R", sinonimos: ["colaborativo", "parceiro", "cooperativo", "agregador", "trabalha em equipe", "soma", "coletivo", "união", "aliado", "sinergia", "ajuda mútua", "parceria"] },
  { canonico: "Empatia", dimensao: "R", sinonimos: ["compreensivo", "sensível", "acolhedor", "humano", "ouvinte", "atencioso", "gentil", "compassivo", "respeitoso", "solidário", "empático"] },
  { canonico: "Inovação", dimensao: "T", sinonimos: ["criativo", "inventivo", "visionário", "disruptivo", "moderno", "ousado", "original", "experimental", "transformador", "curioso", "inovador", "inovar"] },
  { canonico: "Coragem", dimensao: "C", sinonimos: ["destemido", "ousado", "audaz", "determinado", "enfrenta desafios", "assertivo", "firme", "confiante", "perseverante", "resiliente", "corajoso", "valente"] },
  { canonico: "Persistência", dimensao: "C", sinonimos: ["determinado", "constante", "insistente", "disciplinado", "incansável", "comprometido", "resiliente", "focado", "paciente", "persistente", "tenaz"] },
  { canonico: "Lealdade", dimensao: "R", sinonimos: ["fiel", "confiável", "dedicado", "constante", "comprometido", "verdadeiro", "protetor", "consistente", "devotado"] },
  { canonico: "Confiança", dimensao: "R", sinonimos: ["seguro", "acreditável", "estável", "previsível", "sólido", "confiável", "respeitável", "autêntico", "credibilidade", "crível"] },
  { canonico: "Colaboração", dimensao: "R", sinonimos: ["cooperativo", "participativo", "integrador", "articulador", "envolvido", "solidário", "compartilhador", "coeso", "coletivo", "trabalho em equipe"] },
  { canonico: "Visão", dimensao: "T", sinonimos: ["visionário", "estratégico", "antecipa", "planejador", "analítico", "sistêmico", "inovador", "clarividente", "longo prazo"] },
  { canonico: "Comunicação", dimensao: "R", sinonimos: ["claro", "objetivo", "articulado", "expressivo", "bom ouvinte", "assertivo", "empático", "convincente", "eloquente", "comunicativo"] },
  { canonico: "Liderança", dimensao: "C", sinonimos: ["inspirador", "motivador", "orientador", "guia", "mentor", "coordenador", "influente", "mobilizador", "líder"] },
  { canonico: "Disciplina", dimensao: "T", sinonimos: ["organizado", "pontual", "metódico", "rigoroso", "constante", "estruturado", "focado", "coerente", "sistemático"] },
  { canonico: "Humildade", dimensao: "C", sinonimos: ["simples", "aprendiz", "receptivo", "aberto", "reconhece erros", "grato", "modesto", "respeitoso", "humilde"] },
  { canonico: "Justiça", dimensao: "C", sinonimos: ["imparcial", "equitativo", "honesto", "ético", "equilibrado", "neutro", "íntegro", "justo"] },
  { canonico: "Autenticidade", dimensao: "C", sinonimos: ["verdadeiro", "genuíno", "espontâneo", "transparente", "natural", "original", "autêntico"] },
  { canonico: "Comprometimento", dimensao: "C", sinonimos: ["dedicado", "envolvido", "fiel", "leal", "engajado", "presente", "participativo", "comprometido"] },
  { canonico: "Criatividade", dimensao: "T", sinonimos: ["inventivo", "inovador", "imaginativo", "curioso", "original", "engenhoso", "criativo"] },
  { canonico: "Eficácia", dimensao: "T", sinonimos: ["produtivo", "eficiente", "focado", "objetivo", "pragmático", "efetivo", "eficaz", "entrega resultados"] },
  { canonico: "Generosidade", dimensao: "R", sinonimos: ["altruísta", "solidário", "doador", "prestativo", "atencioso", "empático", "benevolente", "generoso"] },
  { canonico: "Resiliência", dimensao: "C", sinonimos: ["persistente", "firme", "forte", "resistente", "adaptável", "equilibrado", "maduro", "paciente", "resiliente"] },
  { canonico: "Foco", dimensao: "T", sinonimos: ["concentrado", "objetivo", "direcionado", "determinado", "organizado", "focado"] },
  { canonico: "Credibilidade", dimensao: "R", sinonimos: ["confiável", "respeitado", "legítimo", "validado", "consistente", "reconhecido", "crível"] },
  { canonico: "Equilíbrio", dimensao: "C", sinonimos: ["ponderado", "racional", "tranquilo", "controlado", "harmônico", "centrado", "sereno", "equilibrado"] },
  { canonico: "Iniciativa", dimensao: "C", sinonimos: ["proativo", "empreendedor", "antecipado", "decidido", "criador", "inovador", "proatividade"] },
  { canonico: "Adaptabilidade", dimensao: "C", sinonimos: ["flexível", "versátil", "aberto", "ajustável", "resiliente", "dinâmico", "adaptável"] },
  { canonico: "Entusiasmo", dimensao: "C", sinonimos: ["motivado", "positivo", "energizado", "alegre", "engajado", "contagiante", "animado", "entusiasmado", "vibrante"] },
  { canonico: "Autonomia", dimensao: "C", sinonimos: ["independente", "confiante", "seguro", "responsável", "autodidata", "autossuficiente", "autônomo"] },
  { canonico: "Sabedoria", dimensao: "C", sinonimos: ["experiente", "prudente", "ponderado", "reflexivo", "maduro", "sábio", "maturidade"] },
  { canonico: "Transparência", dimensao: "C", sinonimos: ["claro", "aberto", "verdadeiro", "honesto", "direto", "transparente"] },
  { canonico: "Eficiência", dimensao: "T", sinonimos: ["rápido", "produtivo", "prático", "funcional", "organizado", "otimizado", "eficiente", "ágil", "agilidade"] },
  { canonico: "Sustentabilidade", dimensao: "T", sinonimos: ["equilibrado", "consciente", "ecológico", "duradouro", "responsável", "prudente", "sustentável"] },
  { canonico: "Assertividade", dimensao: "C", sinonimos: ["direto", "firme", "claro", "seguro", "objetivo", "determinado", "assertivo"] },
  { canonico: "Organização", dimensao: "T", sinonimos: ["estruturado", "sistemático", "ordenado", "planejado", "metódico", "disciplinado", "organizado"] },
  { canonico: "Aprendizado", dimensao: "C", sinonimos: ["curioso", "aprendiz", "aberto", "pesquisador", "evolutivo", "flexível", "aprendizagem", "aprender"] },
  { canonico: "Cuidado", dimensao: "R", sinonimos: ["atento", "zeloso", "protetor", "responsável", "empático", "observador", "detalhista", "cuidadoso"] },
  { canonico: "Paixão", dimensao: "C", sinonimos: ["entusiasmado", "engajado", "vibrante", "intenso", "dedicado", "motivado", "apaixonado", "vocação"] },
  { canonico: "Altruísmo", dimensao: "R", sinonimos: ["generoso", "solidário", "prestativo", "benevolente", "empático", "doador", "altruísta"] },
  { canonico: "Gratidão", dimensao: "R", sinonimos: ["reconhecido", "humilde", "satisfeito", "positivo", "recíproco", "grato"] },
  { canonico: "Pontualidade", dimensao: "T", sinonimos: ["cumpre prazos", "preciso", "responsável", "confiável", "disciplinado", "pontual"] },
  { canonico: "Conexão", dimensao: "R", sinonimos: ["empático", "colaborativo", "parceiro", "comunicativo", "presente", "relacional", "relacionamento", "rede"] },
  { canonico: "Valentia", dimensao: "C", sinonimos: ["destemido", "corajoso", "ousado", "firme", "assertivo", "decidido", "valente", "bravura"] },
  { canonico: "Estabilidade", dimensao: "T", sinonimos: ["constante", "seguro", "previsível", "equilibrado", "confiável", "estável", "consistência"] },
  { canonico: "Companheirismo", dimensao: "R", sinonimos: ["parceiro", "colaborativo", "leal", "prestativo", "unido", "amigo", "colega"] },
  { canonico: "Determinação", dimensao: "C", sinonimos: ["persistente", "firme", "resiliente", "constante", "focado", "decidido", "determinado"] },
  { canonico: "Honra", dimensao: "C", sinonimos: ["digno", "respeitável", "íntegro", "confiável", "leal", "correto", "honrado"] },
  { canonico: "Sensatez", dimensao: "C", sinonimos: ["prudente", "equilibrado", "racional", "coerente", "ponderado", "sensato", "bom senso"] },
  { canonico: "Evolução", dimensao: "C", sinonimos: ["crescimento", "desenvolvimento", "aprendizado", "amadurecimento", "progresso", "evolutivo"] },
  { canonico: "Entendimento", dimensao: "R", sinonimos: ["empatia", "compreensão", "escuta", "análise", "percepção", "sabedoria", "entender"] },
  { canonico: "Inspiração", dimensao: "C", sinonimos: ["motivador", "exemplo", "referência", "iluminador", "contagiante", "inspirador"] },
  { canonico: "Valorização", dimensao: "R", sinonimos: ["reconhecimento", "apreço", "respeito", "cuidado", "incentivo", "estímulo", "valorizar"] },
];

const LISTA_VIVA: Record<Dimensao, string[]> = {
  T: [
    "Competente", "Eficiente", "Detalhista", "Organizado", "Preciso", "Capaz", "Especialista",
    "Metódico", "Resolutivo", "Inteligente", "Rápido", "Inovador", "Analítico", "Visionário",
    "Produtivo", "Estruturado", "Atualizado", "Qualificado", "Profundo", "Lógico", "Perito",
    "Planejado", "Técnico", "Didático", "Seguro", "Ponderado", "Prático", "Disciplinado",
    "Sustentável", "Responsável"
  ],
  R: [
    "Comunicativo", "Empático", "Claro", "Transparente", "Acessível", "Cordial", "Prestativo",
    "Generoso", "Confiável", "Escutador", "Conciliador", "Colaborativo", "Educado", "Disponível",
    "Participativo", "Afetivo", "Gentil", "Flexível", "Amigável", "Honesto", "Inspirador",
    "Protetor", "Motivador", "Conectado", "Simpático", "Atencioso", "Justo", "Leal",
    "Integrador", "Facilitador"
  ],
  C: [
    "Proativo", "Ético", "Coerente", "Alinhado", "Corajoso", "Determinado", "Resiliente",
    "Maduro", "Evolutivo", "Firme", "Empreendedor", "Engajado", "Consciente", "Ativo",
    "Inquieto", "Leal", "Pioneiro", "Exemplar", "Incansável", "Fiel", "Transparente",
    "Solidário", "Independente", "Consistente", "Altruísta"
  ],
};

const LEXICO = new Map<string, LexicoEntry>();

function addEntry(word: string, entry: LexicoEntry, override = false) {
  const key = normalize(word);
  if (!key) return;
  if (override || !LEXICO.has(key)) {
    LEXICO.set(key, entry);
  }
}

for (const { canonico, dimensao, sinonimos } of RAW) {
  const entry = { canonico, dimensao, valorBuilt: true, polaridade: "positiva" as const, impactaScore: true };
  addEntry(canonico, entry, true);
  for (const s of sinonimos) addEntry(s, entry);
}

for (const [dimensao, palavras] of Object.entries(LISTA_VIVA) as Array<[Dimensao, string[]]>) {
  for (const palavra of palavras) {
    addEntry(palavra, { canonico: palavra, dimensao, valorBuilt: false, polaridade: "positiva", impactaScore: true });
  }
}

const PALAVRAS_OFICIAIS_V3: Record<Dimensao, string[]> = {
  T: [
    "Eficiente", "Detalhista", "Organizado", "Preciso", "Especialista", "Resolutivo",
    "Inteligente", "Inovador", "Analítico", "Planejado", "Técnico", "Seguro",
    "Produtivo", "Disciplinado", "Sustentável", "Estratégico", "Competente",
    "Estruturado", "Pontual", "Eficaz",
  ],
  R: [
    "Confiável", "Comunicativo", "Transparente", "Empático", "Cordial", "Prestativo",
    "Colaborativo", "Educado", "Participativo", "Inspirador", "Amigável", "Justo",
    "Leal", "Facilitador", "Atencioso", "Acessível", "Acolhedor", "Agregador",
    "Aliado", "Parceiro", "Acreditável", "Credibilidade",
  ],
  C: [
    "Proativo", "Ético", "Alinhado", "Determinado", "Resiliente", "Engajado",
    "Corajoso", "Evolutivo", "Maduro", "Visionário", "Consistente", "Exemplar",
    "Fiel", "Pioneiro", "Solidário", "Líder", "Motivador", "Responsável",
    "Aberto", "Liderança",
  ],
};

for (const [dimensao, palavras] of Object.entries(PALAVRAS_OFICIAIS_V3) as Array<[Dimensao, string[]]>) {
  for (const palavra of palavras) {
    addEntry(palavra, { canonico: palavra, dimensao, valorBuilt: dimensao !== "T" && normalize(palavra) !== "acessivel", polaridade: "positiva", impactaScore: true }, true);
  }
}

const PALAVRAS_NEGATIVAS: Array<{
  canonico: string;
  dimensao: Dimensao;
  valorAfetado: string;
  gravidade: GravidadeNegativa;
  fatorGravidade: number;
  sinonimos: string[];
  recomendacao: string;
}> = [
  {
    canonico: "T\u00edmido",
    dimensao: "R",
    valorAfetado: "Comunica\u00e7\u00e3o / Conex\u00e3o",
    gravidade: "leve",
    fatorGravidade: 0.5,
    sinonimos: ["timido", "retraido", "reservado demais"],
    recomendacao: "Estimular maior abertura e participacao nas interacoes da rede.",
  },
  {
    canonico: "Inseguro",
    dimensao: "C",
    valorAfetado: "Autonomia / Coragem",
    gravidade: "leve",
    fatorGravidade: 0.5,
    sinonimos: ["inseguro", "hesitante", "indeciso"],
    recomendacao: "Acompanhar em decis\u00f5es de maior impacto at\u00e9 nova valida\u00e7\u00e3o.",
  },
  {
    canonico: "Disperso",
    dimensao: "T",
    valorAfetado: "Foco / Disciplina",
    gravidade: "leve",
    fatorGravidade: 0.5,
    sinonimos: ["disperso", "desatento", "sem foco"],
    recomendacao: "Refor\u00e7ar foco, m\u00e9todo e acompanhamento de entregas.",
  },
  {
    canonico: "Desorganizado",
    dimensao: "T",
    valorAfetado: "Organiza\u00e7\u00e3o",
    gravidade: "moderada",
    fatorGravidade: 1,
    sinonimos: ["desorganizado", "baguncado", "desestruturado"],
    recomendacao: "Melhorar m\u00e9todo, planejamento e clareza de acompanhamento.",
  },
  {
    canonico: "Inconstante",
    dimensao: "T",
    valorAfetado: "Consist\u00eancia / Estabilidade",
    gravidade: "moderada",
    fatorGravidade: 1,
    sinonimos: ["inconstante", "instavel", "oscilante", "inconsistente"],
    recomendacao: "Validar const\u00e2ncia antes de responsabilidades cont\u00ednuas.",
  },
  {
    canonico: "Inacess\u00edvel",
    dimensao: "R",
    valorAfetado: "Comunica\u00e7\u00e3o / Conex\u00e3o",
    gravidade: "moderada",
    fatorGravidade: 1,
    sinonimos: ["inacessivel", "indisponivel", "distante", "dificil acesso"],
    recomendacao: "Melhorar disponibilidade, retorno e clareza de comunica\u00e7\u00e3o.",
  },
  {
    canonico: "Arrogante",
    dimensao: "C",
    valorAfetado: "Humildade / Empatia",
    gravidade: "moderada",
    fatorGravidade: 1,
    sinonimos: ["arrogante", "prepotente", "soberbo"],
    recomendacao: "Observar abertura a feedback, escuta e postura colaborativa.",
  },
  {
    canonico: "Irrespons\u00e1vel",
    dimensao: "C",
    valorAfetado: "Responsabilidade",
    gravidade: "grave",
    fatorGravidade: 1.5,
    sinonimos: ["irresponsavel", "negligente", "imprudente"],
    recomendacao: "Evitar responsabilidade cr\u00edtica isolada at\u00e9 nova valida\u00e7\u00e3o.",
  },
  {
    canonico: "Desagregador",
    dimensao: "R",
    valorAfetado: "Alian\u00e7a / Colabora\u00e7\u00e3o",
    gravidade: "grave",
    fatorGravidade: 1.5,
    sinonimos: ["desagregador", "conflitivo", "divide equipe", "nao colaborativo"],
    recomendacao: "Priorizar media\u00e7\u00e3o e acompanhamento em ambientes coletivos.",
  },
  {
    canonico: "Descomprometido",
    dimensao: "C",
    valorAfetado: "Comprometimento",
    gravidade: "grave",
    fatorGravidade: 1.5,
    sinonimos: ["descomprometido", "sem compromisso", "nao engajado"],
    recomendacao: "Validar compromisso por entregas reais antes de amplia\u00e7\u00e3o de papel.",
  },
  {
    canonico: "Incompetente",
    dimensao: "T",
    valorAfetado: "Compet\u00eancia / Efic\u00e1cia",
    gravidade: "grave",
    fatorGravidade: 1.5,
    sinonimos: ["incompetente"],
    recomendacao: "Exigir contexto e curadoria antes de decis\u00e3o operacional sens\u00edvel.",
  },
  {
    canonico: "Anti\u00e9tico",
    dimensao: "C",
    valorAfetado: "Integridade",
    gravidade: "critica",
    fatorGravidade: 2,
    sinonimos: ["antietico", "anti etico"],
    recomendacao: "Encaminhar para curadoria reputacional e valida\u00e7\u00e3o humana.",
  },
  {
    canonico: "Desonesto",
    dimensao: "C",
    valorAfetado: "Integridade",
    gravidade: "critica",
    fatorGravidade: 2,
    sinonimos: ["desonesto"],
    recomendacao: "Encaminhar para curadoria reputacional e valida\u00e7\u00e3o humana.",
  },
  {
    canonico: "Fraudulento",
    dimensao: "C",
    valorAfetado: "Integridade",
    gravidade: "critica",
    fatorGravidade: 2,
    sinonimos: ["fraudulento", "fraude"],
    recomendacao: "Encaminhar para curadoria reputacional e valida\u00e7\u00e3o humana.",
  },
  {
    canonico: "Irregular",
    dimensao: "C",
    valorAfetado: "Integridade / Conformidade",
    gravidade: "critica",
    fatorGravidade: 2,
    sinonimos: ["irregular"],
    recomendacao: "Encaminhar para curadoria reputacional e valida\u00e7\u00e3o humana.",
  },
];

for (const palavra of PALAVRAS_NEGATIVAS) {
  const entry: LexicoEntry = {
    canonico: palavra.canonico,
    dimensao: palavra.dimensao,
    valorBuilt: false,
    polaridade: "negativa",
    gravidade: palavra.gravidade,
    fatorGravidade: palavra.fatorGravidade,
    valorAfetado: palavra.valorAfetado,
    recomendacao: palavra.recomendacao,
    impactaScore: palavra.gravidade !== "critica",
  };
  addEntry(palavra.canonico, entry, true);
  for (const sinonimo of palavra.sinonimos) addEntry(sinonimo, entry, true);
}

export function classificarPalavra(palavra: string): PalavraClassificada | null {
  const entry = LEXICO.get(normalize(palavra));
  return entry ? {
    canonico: entry.canonico,
    dimensao: entry.dimensao,
    valorBuilt: entry.valorBuilt,
    polaridade: entry.polaridade,
    gravidade: entry.gravidade,
    fatorGravidade: entry.fatorGravidade,
    valorAfetado: entry.valorAfetado,
    recomendacao: entry.recomendacao,
    impactaScore: entry.impactaScore,
  } : null;
}

const PALAVRAS_SUGERIDAS_MAP = new Map<string, string>();

function normalizeSuggestionKey(palavra: string): string {
  return normalize(palavra)
    .replace(/(acao|coes|amento|amentos|idade|idades|ancia|encias|encia|ado|ada|idos|idas|ido|ida|avel|ivel|ante|ente|ivo|iva|oso|osa|or|ora|al|ico|ica|ao|a|o|s)$/, "");
}

for (const palavra of [
  ...Object.values(PALAVRAS_OFICIAIS_V3).flat(),
  ...RAW.map((r) => r.canonico),
  ...RAW.flatMap((r) => r.sinonimos),
  ...Object.values(LISTA_VIVA).flat(),
  ...PALAVRAS_NEGATIVAS.map((r) => r.canonico),
  ...PALAVRAS_NEGATIVAS.flatMap((r) => r.sinonimos),
]) {
  const key = normalizeSuggestionKey(palavra);
  if (!key || PALAVRAS_SUGERIDAS_MAP.has(key)) continue;
  PALAVRAS_SUGERIDAS_MAP.set(key, palavra.toLocaleUpperCase("pt-BR"));
}

export const PALAVRAS_SUGERIDAS = Array.from(PALAVRAS_SUGERIDAS_MAP.values())
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

export function getSugestoes(prefix: string): string[] {
  const norm = normalize(prefix);
  if (norm.length < 2) return [];
  return PALAVRAS_SUGERIDAS
    .filter((palavra) => normalize(palavra).startsWith(norm))
    .slice(0, 10);
}

export interface AuraResult {
  score: number;
  T: number;
  R: number;
  C: number;
  n: number;
  faixa: string;
  FR_T: number;
  FR_R: number;
  FR_C: number;
  confianca: string;
  confianca_descricao: string;
  total_palavras: number;
  dimensoes_sem_evidencia: Dimensao[];
  correspondencia_valores: Record<Dimensao, number>;
  redutor_reputacional: number;
  pontos_atencao_reputacional: Array<{
    palavra: string;
    canonico: string;
    dimensao: Dimensao;
    count: number;
    gravidade: GravidadeNegativa;
    valor_afetado: string;
    impacto: number;
    status: "considerado_no_calculo" | "em_curadoria_reputacional";
    recomendacao: string;
  }>;
  palavras_recebidas: Array<{
    palavra: string;
    canonico: string;
    dimensao: Dimensao;
    count: number;
    polaridade: Polaridade;
    gravidade?: GravidadeNegativa;
  }>;
}

function getPesoFrequencia(count: number): number {
  if (count >= 4) return 2.0;
  if (count >= 2) return 1.5;
  return 1.0;
}

function getFaixa(score: number): string {
  if (score >= 90) return "Aura Suprema";
  if (score >= 70) return "Aura Forte";
  if (score >= 50) return "Aura Confiável";
  return "Em Evolução";
}

function getConfianca(n: number): { nome: string; descricao: string } {
  if (n >= 10) return { nome: "Aura Consolidada", descricao: "Alta maturidade estatística" };
  if (n >= 5) return { nome: "Aura Validada", descricao: "Base mínima adequada para decisões operacionais" };
  if (n >= 2) return { nome: "Aura em Validação", descricao: "Percepção em formação" };
  return { nome: "Aura Inicial", descricao: "Primeira leitura reputacional" };
}

export function calcularAura(avaliacoes: Array<{ avaliador_membro_id: string; palavras: string[] }>): AuraResult {
  const avaliadores = new Set(avaliacoes.map((av) => av.avaliador_membro_id).filter(Boolean));
  const n = avaliadores.size || avaliacoes.length;

  const canonCounter = new Map<string, {
    canonico: string;
    dimensao: Dimensao;
    valorBuilt: boolean;
    polaridade: Polaridade;
    gravidade?: GravidadeNegativa;
    fatorGravidade?: number;
    valorAfetado?: string;
    recomendacao?: string;
    impactaScore: boolean;
    avaliadores: Set<string>;
  }>();

  for (const av of avaliacoes) {
    const seen = new Set<string>();
    for (const palavra of av.palavras || []) {
      const cls = classificarPalavra(palavra);
      const key = cls ? `${cls.polaridade}:${cls.canonico}` : "";
      if (!cls || seen.has(key)) continue;
      seen.add(key);
      if (!canonCounter.has(key)) {
        canonCounter.set(key, {
          canonico: cls.canonico,
          dimensao: cls.dimensao,
          valorBuilt: cls.valorBuilt,
          polaridade: cls.polaridade,
          gravidade: cls.gravidade,
          fatorGravidade: cls.fatorGravidade,
          valorAfetado: cls.valorAfetado,
          recomendacao: cls.recomendacao,
          impactaScore: cls.impactaScore,
          avaliadores: new Set(),
        });
      }
      canonCounter.get(key)!.avaliadores.add(av.avaliador_membro_id);
    }
  }

  const pontos: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const penalidades: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const palavrasCanonicasPositivasPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const palavrasCanonicasPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const ocorrenciasPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const ocorrenciasAlinhadasPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const palavrasRecebidas: AuraResult["palavras_recebidas"] = [];
  const pontosAtencao: AuraResult["pontos_atencao_reputacional"] = [];

  for (const entry of Array.from(canonCounter.values())) {
    const count = entry.avaliadores.size;
    const pesoFrequencia = getPesoFrequencia(count);
    palavrasCanonicasPorDimensao[entry.dimensao] += 1;
    ocorrenciasPorDimensao[entry.dimensao] += count;
    if (entry.polaridade === "positiva") {
      pontos[entry.dimensao] += pesoFrequencia;
      palavrasCanonicasPositivasPorDimensao[entry.dimensao] += 1;
      if (entry.valorBuilt) ocorrenciasAlinhadasPorDimensao[entry.dimensao] += count;
    } else {
      const impacto = Number((pesoFrequencia * (entry.fatorGravidade || 1)).toFixed(2));
      if (entry.impactaScore) penalidades[entry.dimensao] += impacto;
      pontosAtencao.push({
        palavra: entry.canonico,
        canonico: entry.canonico,
        dimensao: entry.dimensao,
        count,
        gravidade: entry.gravidade || "moderada",
        valor_afetado: entry.valorAfetado || "Valor reputacional relacionado",
        impacto: entry.impactaScore ? impacto : 0,
        status: entry.impactaScore ? "considerado_no_calculo" : "em_curadoria_reputacional",
        recomendacao: entry.recomendacao || "Validar contexto antes de decisao reputacional.",
      });
    }
    palavrasRecebidas.push({
      palavra: entry.canonico,
      canonico: entry.canonico,
      dimensao: entry.dimensao,
      count,
      polaridade: entry.polaridade,
      gravidade: entry.gravidade,
    });
  }

  const getFR = (dimensao: Dimensao) => {
    const total = ocorrenciasPorDimensao[dimensao];
    if (!total) return 1;
    return Math.min(1 + (ocorrenciasAlinhadasPorDimensao[dimensao] / total) * 0.2, 1.2);
  };

  const FR_T = getFR("T");
  const FR_R = getFR("R");
  const FR_C = getFR("C");

  const getScoreDimensao = (dimensao: Dimensao, fr: number) => {
    const totalCanonicos = palavrasCanonicasPositivasPorDimensao[dimensao];
    if (!totalCanonicos) return 0;
    const saldo = Math.max(0, pontos[dimensao] - penalidades[dimensao]);
    const scoreBase = (saldo / (totalCanonicos * 2)) * 100;
    return Math.min(scoreBase * fr, 100);
  };

  const Tscore = getScoreDimensao("T", FR_T);
  const Rscore = getScoreDimensao("R", FR_R);
  const Cscore = getScoreDimensao("C", FR_C);
  const scores: Record<Dimensao, number> = { T: Tscore, R: Rscore, C: Cscore };
  const pesosOficiais: Record<Dimensao, number> = { T: 0.4, R: 0.25, C: 0.35 };
  const dimensoes: Dimensao[] = ["T", "R", "C"];
  const dimensoesComEvidencia = dimensoes.filter((dimensao) => palavrasCanonicasPorDimensao[dimensao] > 0);
  const dimensoesSemEvidencia = dimensoes.filter((dimensao) => palavrasCanonicasPorDimensao[dimensao] === 0);
  const redistribuirPesos = n < 5 && dimensoesComEvidencia.length > 0;
  const somaPesosComEvidencia = dimensoesComEvidencia.reduce((total, dimensao) => total + pesosOficiais[dimensao], 0);
  const pesoEfetivo = (dimensao: Dimensao) => {
    if (!redistribuirPesos) return pesosOficiais[dimensao];
    if (!palavrasCanonicasPorDimensao[dimensao]) return 0;
    return pesosOficiais[dimensao] / somaPesosComEvidencia;
  };

  const score = Math.min(100, Math.round(
    scores.T * pesoEfetivo("T") +
    scores.R * pesoEfetivo("R") +
    scores.C * pesoEfetivo("C")
  ));
  const confianca = getConfianca(n);

  palavrasRecebidas.sort((a, b) => b.count - a.count || a.canonico.localeCompare(b.canonico, "pt-BR"));
  pontosAtencao.sort((a, b) => b.impacto - a.impacto || b.count - a.count || a.canonico.localeCompare(b.canonico, "pt-BR"));

  return {
    score,
    T: Math.round(Tscore),
    R: Math.round(Rscore),
    C: Math.round(Cscore),
    n,
    faixa: getFaixa(score),
    FR_T: Number(FR_T.toFixed(4)),
    FR_R: Number(FR_R.toFixed(4)),
    FR_C: Number(FR_C.toFixed(4)),
    confianca: confianca.nome,
    confianca_descricao: confianca.descricao,
    total_palavras: ocorrenciasPorDimensao.T + ocorrenciasPorDimensao.R + ocorrenciasPorDimensao.C,
    dimensoes_sem_evidencia: dimensoesSemEvidencia,
    correspondencia_valores: {
      T: ocorrenciasPorDimensao.T ? Number((ocorrenciasAlinhadasPorDimensao.T / ocorrenciasPorDimensao.T).toFixed(2)) : 0,
      R: ocorrenciasPorDimensao.R ? Number((ocorrenciasAlinhadasPorDimensao.R / ocorrenciasPorDimensao.R).toFixed(2)) : 0,
      C: ocorrenciasPorDimensao.C ? Number((ocorrenciasAlinhadasPorDimensao.C / ocorrenciasPorDimensao.C).toFixed(2)) : 0,
    },
    redutor_reputacional: Number((penalidades.T + penalidades.R + penalidades.C).toFixed(2)),
    pontos_atencao_reputacional: pontosAtencao,
    palavras_recebidas: palavrasRecebidas,
  };
}

export function getFaixaColor(score: number | null): string {
  if (score === null) return "#6B7280";
  if (score >= 90) return "#D7BB7D";
  if (score >= 70) return "#3B82F6";
  if (score >= 50) return "#22C55E";
  return "#EF4444";
}
