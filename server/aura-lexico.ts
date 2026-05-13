export type Dimensao = "T" | "R" | "C";

export interface PalavraClassificada {
  canonico: string;
  dimensao: Dimensao;
  valorBuilt: boolean;
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

type LexicoEntry = { canonico: string; dimensao: Dimensao; valorBuilt: boolean };

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
  const entry = { canonico, dimensao, valorBuilt: true };
  addEntry(canonico, entry, true);
  for (const s of sinonimos) addEntry(s, entry);
}

for (const [dimensao, palavras] of Object.entries(LISTA_VIVA) as Array<[Dimensao, string[]]>) {
  for (const palavra of palavras) {
    addEntry(palavra, { canonico: palavra, dimensao, valorBuilt: false });
  }
}

export function classificarPalavra(palavra: string): PalavraClassificada | null {
  const entry = LEXICO.get(normalize(palavra));
  return entry ? { canonico: entry.canonico, dimensao: entry.dimensao, valorBuilt: entry.valorBuilt } : null;
}

export const PALAVRAS_SUGERIDAS = Array.from(
  new Set([
    ...RAW.map((r) => r.canonico),
    ...RAW.flatMap((r) => r.sinonimos),
    ...Object.values(LISTA_VIVA).flat(),
  ])
).sort((a, b) => a.localeCompare(b, "pt-BR"));

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
  correspondencia_valores: Record<Dimensao, number>;
  palavras_recebidas: Array<{ palavra: string; canonico: string; dimensao: Dimensao; count: number }>;
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

export function calcularAura(avaliacoes: Array<{ avaliador_membro_id: string; palavras: string[] }>): AuraResult {
  const avaliadores = new Set(avaliacoes.map((av) => av.avaliador_membro_id).filter(Boolean));
  const n = avaliadores.size || avaliacoes.length;

  const canonCounter = new Map<string, { canonico: string; dimensao: Dimensao; valorBuilt: boolean; avaliadores: Set<string> }>();

  for (const av of avaliacoes) {
    const seen = new Set<string>();
    for (const palavra of av.palavras || []) {
      const cls = classificarPalavra(palavra);
      if (!cls || seen.has(cls.canonico)) continue;
      seen.add(cls.canonico);
      if (!canonCounter.has(cls.canonico)) {
        canonCounter.set(cls.canonico, {
          canonico: cls.canonico,
          dimensao: cls.dimensao,
          valorBuilt: cls.valorBuilt,
          avaliadores: new Set(),
        });
      }
      canonCounter.get(cls.canonico)!.avaliadores.add(av.avaliador_membro_id);
    }
  }

  const pesos: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const totalPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const alinhadasPorDimensao: Record<Dimensao, number> = { T: 0, R: 0, C: 0 };
  const palavrasRecebidas: AuraResult["palavras_recebidas"] = [];

  for (const entry of canonCounter.values()) {
    const count = entry.avaliadores.size;
    pesos[entry.dimensao] += getPesoFrequencia(count);
    totalPorDimensao[entry.dimensao] += 1;
    if (entry.valorBuilt) alinhadasPorDimensao[entry.dimensao] += 1;
    palavrasRecebidas.push({ palavra: entry.canonico, canonico: entry.canonico, dimensao: entry.dimensao, count });
  }

  const getFR = (dimensao: Dimensao) => {
    const total = totalPorDimensao[dimensao];
    if (!total) return 1;
    return Math.min(1 + (alinhadasPorDimensao[dimensao] / total) * 0.2, 1.2);
  };

  const FR_T = getFR("T");
  const FR_R = getFR("R");
  const FR_C = getFR("C");
  const pontoMaximoDim = n > 0 ? n * 2 : 1;

  const Tnorm = Math.min((pesos.T * FR_T) / pontoMaximoDim, 1);
  const Rnorm = Math.min((pesos.R * FR_R) / pontoMaximoDim, 1);
  const Cnorm = Math.min((pesos.C * FR_C) / pontoMaximoDim, 1);

  const score = Math.min(100, Math.round(Tnorm * 40 + Rnorm * 25 + Cnorm * 35));

  palavrasRecebidas.sort((a, b) => b.count - a.count || a.canonico.localeCompare(b.canonico, "pt-BR"));

  return {
    score,
    T: Math.round(Tnorm * 100),
    R: Math.round(Rnorm * 100),
    C: Math.round(Cnorm * 100),
    n,
    faixa: getFaixa(score),
    FR_T: Number(FR_T.toFixed(2)),
    FR_R: Number(FR_R.toFixed(2)),
    FR_C: Number(FR_C.toFixed(2)),
    correspondencia_valores: {
      T: totalPorDimensao.T ? Number((alinhadasPorDimensao.T / totalPorDimensao.T).toFixed(2)) : 0,
      R: totalPorDimensao.R ? Number((alinhadasPorDimensao.R / totalPorDimensao.R).toFixed(2)) : 0,
      C: totalPorDimensao.C ? Number((alinhadasPorDimensao.C / totalPorDimensao.C).toFixed(2)) : 0,
    },
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
