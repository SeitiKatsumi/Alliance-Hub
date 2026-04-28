export type Dimensao = "T" | "R" | "C";

export interface PalavraClassificada {
  canonico: string;
  dimensao: Dimensao;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

type LexicoEntry = { canonico: string; dimensao: Dimensao };

const RAW: Array<{ canonico: string; dimensao: Dimensao; sinonimos: string[] }> = [
  { canonico: "Integridade", dimensao: "C", sinonimos: ["honesto","etica","etico","integro","confiavel","justo","verdadeiro","carater","transparencia","coerente","leal","sinceridade","sincero","honestidade","integridade"] },
  { canonico: "Responsabilidade", dimensao: "T", sinonimos: ["responsavel","comprometido","cumpre promessa","assume erro","presta contas","accountability","disciplinado","consciente","responsabilidade","comprometimento"] },
  { canonico: "Excelência", dimensao: "T", sinonimos: ["qualidade","caprichoso","exigente","perfeccionista","detalhista","alto padrao","primoroso","cuidadoso","meticuloso","impecavel","excelencia","perfeito","preciso","precisao"] },
  { canonico: "Protagonismo", dimensao: "C", sinonimos: ["proativo","iniciativa","faz acontecer","empreendedor","lider","autonomo","executor","realizador","resolvedor","agente de mudanca","protagonismo","protagonista"] },
  { canonico: "Aliança", dimensao: "R", sinonimos: ["colaborativo","parceiro","cooperativo","agregador","trabalha em equipe","soma","coletivo","uniao","aliado","sinergia","ajuda mutua","alianca","parceria","parceiros"] },
  { canonico: "Empatia", dimensao: "R", sinonimos: ["compreensivo","sensivel","acolhedor","humano","ouvinte","atencioso","gentil","compassivo","respeitoso","solidario","empatico","empatia","compreender"] },
  { canonico: "Inovação", dimensao: "T", sinonimos: ["criativo","inventivo","visionario","disruptivo","moderno","ousado","original","experimental","transformador","curioso","inovacao","inovador","inovar"] },
  { canonico: "Coragem", dimensao: "C", sinonimos: ["destemido","audaz","enfrenta desafios","assertivo","firme","confiante","perseverante","resiliente","corajoso","coragem","valente","determinado","determinacao"] },
  { canonico: "Persistência", dimensao: "C", sinonimos: ["constante","insistente","incansavel","focado","paciente","persistente","persistencia","tenaz","continuidade"] },
  { canonico: "Lealdade", dimensao: "R", sinonimos: ["fiel","dedicado","protetor","consistente","devotado","lealdade","leal","fidelidade"] },
  { canonico: "Confiança", dimensao: "R", sinonimos: ["seguro","acreditavel","estavel","previsivel","solido","respeitavel","confiado","autentico","confianca","credibilidade","credivel"] },
  { canonico: "Colaboração", dimensao: "R", sinonimos: ["participativo","integrador","articulador","envolvido","compartilhador","coeso","colaboracao","trabalho em equipe","time"] },
  { canonico: "Visão", dimensao: "T", sinonimos: ["estrategico","antecipa","planejador","analitico","sistemico","clarividente","de longo prazo","visao","estrategia","planejamento"] },
  { canonico: "Comunicação", dimensao: "R", sinonimos: ["claro","objetivo","articulado","expressivo","bom ouvinte","convincente","eloquente","comunicacao","comunicativo","clareza"] },
  { canonico: "Liderança", dimensao: "C", sinonimos: ["inspirador","motivador","orientador","guia","mentor","coordenador","influente","mobilizador","lideranca","lider","leadership"] },
  { canonico: "Disciplina", dimensao: "T", sinonimos: ["organizado","pontual","metodico","rigoroso","estruturado","disciplina","metodo","rigor","sistematico"] },
  { canonico: "Humildade", dimensao: "C", sinonimos: ["simples","aprendiz","receptivo","aberto","reconhece erros","grato","modesto","humildade","humilde"] },
  { canonico: "Justiça", dimensao: "C", sinonimos: ["imparcial","equitativo","equilibrado","neutro","justica","justo","equidade"] },
  { canonico: "Autenticidade", dimensao: "C", sinonimos: ["genuino","espontaneo","natural","autenticidade","autentico","verdadeiro"] },
  { canonico: "Comprometimento", dimensao: "C", sinonimos: ["dedicado","envolvido","engajado","presente","participativo","comprometimento","comprometido"] },
  { canonico: "Criatividade", dimensao: "T", sinonimos: ["imaginativo","artistico","engenhoso","criatividade","criativo","criacao"] },
  { canonico: "Eficácia", dimensao: "T", sinonimos: ["produtivo","eficiente","pragmatico","entrega resultados","efetivo","eficacia","eficaz","resultados"] },
  { canonico: "Generosidade", dimensao: "R", sinonimos: ["altruista","doador","prestativo","benevolente","generosidade","generoso"] },
  { canonico: "Resiliência", dimensao: "C", sinonimos: ["forte","resistente","adaptavel","maduro","resiliente","resiliencia","superacao"] },
  { canonico: "Foco", dimensao: "T", sinonimos: ["concentrado","direcionado","foco","focado"] },
  { canonico: "Equilíbrio", dimensao: "C", sinonimos: ["ponderado","racional","tranquilo","controlado","harmonico","centrado","sereno","equilibrio","equilibrado"] },
  { canonico: "Iniciativa", dimensao: "C", sinonimos: ["antecipado","faz antes","decidido","criador","iniciativa","proatividade"] },
  { canonico: "Adaptabilidade", dimensao: "T", sinonimos: ["flexivel","versatil","ajustavel","dinamico","adaptabilidade","adaptavel","adaptacao"] },
  { canonico: "Entusiasmo", dimensao: "C", sinonimos: ["motivado","positivo","energizado","alegre","contagiante","animado","entusiasmo","entusiasmado","vibrante"] },
  { canonico: "Autonomia", dimensao: "T", sinonimos: ["independente","autodidata","autossuficiente","autonomia","autonomo"] },
  { canonico: "Sabedoria", dimensao: "C", sinonimos: ["experiente","prudente","reflexivo","sabedoria","sabio","maturidade"] },
  { canonico: "Transparência", dimensao: "C", sinonimos: ["aberto","direto","transparente","transparencia"] },
  { canonico: "Eficiência", dimensao: "T", sinonimos: ["rapido","pratico","funcional","otimizado","eficiencia","eficiente","agilidade","agil"] },
  { canonico: "Organização", dimensao: "T", sinonimos: ["ordenado","planejado","organizacao","organizado","ordem"] },
  { canonico: "Aprendizado", dimensao: "T", sinonimos: ["pesquisador","evolutivo","aprendizado","aprender","aprendizagem","conhecimento"] },
  { canonico: "Cuidado", dimensao: "T", sinonimos: ["atento","zeloso","observador","cuidado","cuidadoso","zelador"] },
  { canonico: "Paixão", dimensao: "C", sinonimos: ["intenso","paixao","apaixonado","dedicacao","vocacao"] },
  { canonico: "Altruísmo", dimensao: "R", sinonimos: ["altruismo","altruista","doacao"] },
  { canonico: "Gratidão", dimensao: "C", sinonimos: ["reconhecido","satisfeito","reciproco","gratidao","grato","agradecimento"] },
  { canonico: "Pontualidade", dimensao: "T", sinonimos: ["cumpre prazos","preciso","pontualidade","pontual","prazo"] },
  { canonico: "Conexão", dimensao: "R", sinonimos: ["relacional","conexao","relacionamento","rede"] },
  { canonico: "Valentia", dimensao: "C", sinonimos: ["valente","valentia","bravura"] },
  { canonico: "Estabilidade", dimensao: "T", sinonimos: ["estabilidade","estavel","consistencia"] },
  { canonico: "Companheirismo", dimensao: "R", sinonimos: ["unido","amigo","companheirismo","companherismo","colega"] },
  { canonico: "Honra", dimensao: "C", sinonimos: ["digno","respeitavel","correto","honra","honrado"] },
  { canonico: "Sensatez", dimensao: "C", sinonimos: ["prudente","sensatez","sensato","bom senso"] },
  { canonico: "Evolução", dimensao: "C", sinonimos: ["crescimento","desenvolvimento","amadurecimento","progresso","evolucao","evoluindo"] },
  { canonico: "Entendimento", dimensao: "R", sinonimos: ["compreensao","escuta","percepcao","entendimento","entender","compreender"] },
  { canonico: "Inspiração", dimensao: "C", sinonimos: ["exemplo","referencia","iluminador","inspiracao","inspirador","inspira"] },
  { canonico: "Valorização", dimensao: "R", sinonimos: ["reconhecimento","apreco","respeito","incentivo","estimulo","valorizacao","valorizar"] },
];

const LEXICO = new Map<string, LexicoEntry>();

for (const { canonico, dimensao, sinonimos } of RAW) {
  LEXICO.set(normalize(canonico), { canonico, dimensao });
  for (const s of sinonimos) {
    const key = normalize(s);
    if (!LEXICO.has(key)) {
      LEXICO.set(key, { canonico, dimensao });
    }
  }
}

export function classificarPalavra(palavra: string): PalavraClassificada | null {
  const key = normalize(palavra);
  const entry = LEXICO.get(key);
  return entry ? { canonico: entry.canonico, dimensao: entry.dimensao } : null;
}

export function getSugestoes(prefix: string): string[] {
  const norm = normalize(prefix);
  if (norm.length < 2) return [];
  const found: string[] = [];
  for (const [key, { canonico }] of LEXICO.entries()) {
    if (key.startsWith(norm)) {
      if (!found.includes(canonico)) found.push(canonico);
      if (found.length >= 10) break;
    }
  }
  return found.sort();
}

export interface AuraResult {
  score: number;
  T: number;
  R: number;
  C: number;
  n: number;
  faixa: string;
  palavras_recebidas: Array<{ palavra: string; canonico: string; dimensao: Dimensao; count: number }>;
}

export function calcularAura(avaliacoes: Array<{ avaliador_membro_id: string; palavras: string[] }>): AuraResult {
  const n = avaliacoes.length;

  const canonCounter = new Map<string, { canonico: string; dimensao: Dimensao; avaliadores: Set<string> }>();
  const palavraRaw: string[] = [];

  for (const av of avaliacoes) {
    const seen = new Set<string>();
    for (const p of av.palavras) {
      const cls = classificarPalavra(p);
      if (!cls) continue;
      if (seen.has(cls.canonico)) continue;
      seen.add(cls.canonico);
      palavraRaw.push(p);
      if (!canonCounter.has(cls.canonico)) {
        canonCounter.set(cls.canonico, { canonico: cls.canonico, dimensao: cls.dimensao, avaliadores: new Set() });
      }
      canonCounter.get(cls.canonico)!.avaliadores.add(av.avaliador_membro_id);
    }
  }

  function getPeso(count: number): number {
    if (count >= 4) return 2.0;
    if (count >= 2) return 1.5;
    return 1.0;
  }

  let T = 0, R = 0, C = 0;
  const palavrasRecebidas: AuraResult["palavras_recebidas"] = [];

  for (const [, entry] of canonCounter) {
    const count = entry.avaliadores.size;
    const peso = getPeso(count);
    if (entry.dimensao === "T") T += peso;
    else if (entry.dimensao === "R") R += peso;
    else C += peso;
    palavrasRecebidas.push({ palavra: entry.canonico, canonico: entry.canonico, dimensao: entry.dimensao, count });
  }

  const pontoMaximoDim = n > 0 ? n * 2 : 1;
  const Tnorm = Math.min(T / pontoMaximoDim, 1);
  const Rnorm = Math.min(R / pontoMaximoDim, 1);
  const Cnorm = Math.min(C / pontoMaximoDim, 1);

  const score = Math.round((Tnorm * 40 + Rnorm * 25 + Cnorm * 35));

  let faixa = "Em Evolução";
  if (score >= 90) faixa = "Aura Suprema";
  else if (score >= 70) faixa = "Aura Forte";
  else if (score >= 50) faixa = "Aura Confiável";

  palavrasRecebidas.sort((a, b) => b.count - a.count);

  return {
    score,
    T: Math.round(Tnorm * 100),
    R: Math.round(Rnorm * 100),
    C: Math.round(Cnorm * 100),
    n,
    faixa,
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

export const PALAVRAS_SUGERIDAS = Array.from(
  new Set(RAW.map(r => r.canonico))
).sort();
