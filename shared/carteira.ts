export const CARTEIRA_ACCESS_LEVELS = [
  "leitura",
  "colaboracao",
  "administracao",
  "proprietario",
] as const;

export type CarteiraAccessLevel = typeof CARTEIRA_ACCESS_LEVELS[number];

const ACCESS_RANK: Record<CarteiraAccessLevel, number> = {
  leitura: 1,
  colaboracao: 2,
  administracao: 3,
  proprietario: 4,
};

export function isCarteiraAccessLevel(value: unknown): value is CarteiraAccessLevel {
  return CARTEIRA_ACCESS_LEVELS.includes(value as CarteiraAccessLevel);
}

export function hasCarteiraAccess(
  current: CarteiraAccessLevel | null | undefined,
  required: CarteiraAccessLevel,
): boolean {
  return !!current && ACCESS_RANK[current] >= ACCESS_RANK[required];
}

export function canDeleteCarteiraAsset(isOwner: boolean, isPlatformAdmin: boolean): boolean {
  return isOwner || isPlatformAdmin;
}

export type CarteiraDataOrigin =
  | "declarada"
  | "extraida"
  | "externa"
  | "validada"
  | "estimada";

export interface CarteiraLancamentoLike {
  tipo?: "receita" | "despesa" | string | null;
  valor?: number | string | null;
  status?: string | null;
  data?: string | null;
}

export interface CarteiraDocumentoLike {
  tipo?: string | null;
  validade?: string | null;
  status_validacao?: string | null;
}

export interface CarteiraAlertaLike {
  tipo?: string | null;
  severidade?: string | null;
  status?: string | null;
  titulo?: string | null;
}

export interface CarteiraImovelLike {
  nome?: string | null;
  tipo?: string | null;
  area_m2?: number | string | null;
  valor_atual?: number | string | null;
  valor_data_base?: string | null;
  ocupacao?: string | null;
  objetivo?: string | null;
  titularidade?: unknown;
  divida_saldo?: number | string | null;
  ultima_atualizacao?: string | null;
}

export interface CarteiraDiagnostico {
  situacao: string;
  classificacoes: string[];
  oportunidade: string;
  risco: string;
  recomendacao: string;
  proxima_acao: string;
  confianca: "baixa" | "moderada" | "alta";
  cobertura: {
    preenchidos: number;
    total: number;
    percentual: number;
  };
  dados_faltantes: string[];
  indicadores: {
    ocupacao: string;
    receitas: number;
    despesas: number;
    resultado_liquido: number;
    documentos_ativos: number;
    alertas_abertos: number;
  };
  calculado_em: string;
  versao_regra: string;
}

function carteiraNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeLancamentos(items: CarteiraLancamentoLike[]): CarteiraLancamentoLike[] {
  return items.filter((item) => !["cancelado", "cancelada"].includes(String(item.status || "").toLowerCase()));
}

function currentDocuments(items: CarteiraDocumentoLike[], today: string): CarteiraDocumentoLike[] {
  return items.filter((item) => !item.validade || String(item.validade) >= today);
}

export function diagnosticarCarteira(input: {
  imovel: CarteiraImovelLike;
  lancamentos?: CarteiraLancamentoLike[];
  documentos?: CarteiraDocumentoLike[];
  alertas?: CarteiraAlertaLike[];
  now?: Date;
}): CarteiraDiagnostico {
  const now = input.now || new Date();
  const today = now.toISOString().slice(0, 10);
  const lancamentos = activeLancamentos(input.lancamentos || []);
  const documentos = currentDocuments(input.documentos || [], today);
  const alertas = (input.alertas || []).filter((item) => String(item.status || "aberto") !== "resolvido");
  const receitas = lancamentos
    .filter((item) => item.tipo === "receita")
    .reduce((sum, item) => sum + Math.abs(carteiraNumber(item.valor)), 0);
  const despesas = lancamentos
    .filter((item) => item.tipo === "despesa")
    .reduce((sum, item) => sum + Math.abs(carteiraNumber(item.valor)), 0);
  const resultadoLiquido = receitas - despesas;
  const ocupacao = String(input.imovel.ocupacao || "").toLowerCase();
  const objetivo = String(input.imovel.objetivo || "").toLowerCase();
  const hasOcupacao = Boolean(ocupacao && !["desconhecido", "nao_informado", "não informado"].includes(ocupacao));
  const hasObjetivo = Boolean(objetivo && !["indefinido", "nao_definido", "não definido"].includes(objetivo));
  const isVazio = ["vazio", "ocioso", "desocupado"].includes(ocupacao);
  const isParcial = ["parcial", "parcialmente_ocupado", "subutilizado"].includes(ocupacao);
  const hasCriticalAlert = alertas.some((item) => ["alta", "critica", "crítica"].includes(String(item.severidade || "").toLowerCase()));

  const classificacoes: string[] = [];
  if (isVazio && receitas <= 0) classificacoes.push("Ocioso");
  if (isParcial) classificacoes.push("Subutilizado");
  if (receitas <= 0 && despesas > 0) classificacoes.push("Gerador de custos");
  if (receitas > 0 && resultadoLiquido < 0) classificacoes.push("Deficitário");
  if (receitas > 0 && Math.abs(resultadoLiquido) <= Math.max(receitas, despesas) * 0.05) {
    classificacoes.push("Em equilíbrio");
  }
  if (resultadoLiquido > 0) {
    classificacoes.push(isParcial ? "Rentável, mas ineficiente" : "Rentável estabilizado");
  }
  if (hasCriticalAlert) classificacoes.unshift("Requer atenção");
  if (classificacoes.length === 0) classificacoes.push("Diagnóstico preliminar");

  const coverageChecks = [
    hasOcupacao,
    hasObjetivo,
    carteiraNumber(input.imovel.area_m2) > 0,
    carteiraNumber(input.imovel.valor_atual) > 0 && Boolean(input.imovel.valor_data_base),
    lancamentos.some((item) => item.tipo === "receita"),
    lancamentos.some((item) => item.tipo === "despesa"),
    documentos.length > 0,
  ];
  const preenchidos = coverageChecks.filter(Boolean).length;
  const hasVerifiedDocument = documentos.some((item) =>
    ["extraido", "extraída", "extraida", "validado", "validada"].includes(String(item.status_validacao || "").toLowerCase()),
  );
  const confianca = preenchidos <= 3
    ? "baixa"
    : preenchidos <= 5 || !hasVerifiedDocument
      ? "moderada"
      : "alta";

  const dadosFaltantes = [
    !hasOcupacao && "ocupação",
    !hasObjetivo && "objetivo patrimonial",
    carteiraNumber(input.imovel.area_m2) <= 0 && "área",
    (carteiraNumber(input.imovel.valor_atual) <= 0 || !input.imovel.valor_data_base) && "valor atual com data-base",
    !lancamentos.some((item) => item.tipo === "receita") && "receitas do período",
    !lancamentos.some((item) => item.tipo === "despesa") && "despesas do período",
    documentos.length === 0 && "documento atual",
  ].filter(Boolean) as string[];

  let oportunidade = "Completar os dados para identificar o melhor potencial do imóvel.";
  let recomendacao = "Atualize o cadastro e envie ao menos um documento atual.";
  let proximaAcao = "Realizar o Pulso Patrimonial";
  if (isVazio) {
    oportunidade = "Avaliar geração de renda, venda ou transformação do imóvel.";
    recomendacao = "Comparar as alternativas de locação, venda e transformação.";
    proximaAcao = "Analisar alternativas";
  } else if (resultadoLiquido < 0) {
    oportunidade = "Reduzir custos ou melhorar a geração de receita.";
    recomendacao = "Revisar despesas e validar o potencial de renda do ativo.";
    proximaAcao = "Revisar lançamentos e analisar alternativas";
  } else if (resultadoLiquido > 0) {
    oportunidade = "Otimizar a renda e preservar a condição do ativo.";
    recomendacao = "Acompanhar ocupação, contratos e despesas recorrentes.";
    proximaAcao = "Atualizar o Pulso Patrimonial";
  }

  const riskTitles = alertas
    .filter((item) => ["alta", "critica", "crítica"].includes(String(item.severidade || "").toLowerCase()))
    .map((item) => item.titulo)
    .filter(Boolean);
  const risco = riskTitles.length > 0
    ? String(riskTitles[0])
    : dadosFaltantes.length > 0
      ? `Conclusão limitada por ${dadosFaltantes.slice(0, 2).join(" e ")}.`
      : "Nenhum risco crítico identificado com os dados disponíveis.";

  return {
    situacao: classificacoes[0],
    classificacoes,
    oportunidade,
    risco,
    recomendacao,
    proxima_acao: proximaAcao,
    confianca,
    cobertura: {
      preenchidos,
      total: coverageChecks.length,
      percentual: Number(((preenchidos / coverageChecks.length) * 100).toFixed(1)),
    },
    dados_faltantes: dadosFaltantes,
    indicadores: {
      ocupacao: hasOcupacao ? ocupacao : "não informada",
      receitas: Number(receitas.toFixed(2)),
      despesas: Number(despesas.toFixed(2)),
      resultado_liquido: Number(resultadoLiquido.toFixed(2)),
      documentos_ativos: documentos.length,
      alertas_abertos: alertas.length,
    },
    calculado_em: now.toISOString(),
    versao_regra: "carteira-v1",
  };
}

export interface CarteiraAlternativa {
  tipo: "manter" | "renda" | "vender" | "transformar";
  titulo: string;
  capital_necessario: string;
  resultado_esperado: string;
  prazo: string;
  risco: "baixo" | "medio" | "alto";
  premissas: string[];
  validacoes: string[];
  aderencia: number;
  justificativa: string;
}

export function buildCarteiraAlternativas(input: {
  objetivo?: string | null;
  prazo?: string | null;
  preferencia?: "renda" | "liquidez" | "equilibrio" | string | null;
  capacidade_investimento?: number | string | null;
  diagnostico?: CarteiraDiagnostico | null;
}): CarteiraAlternativa[] {
  const preferencia = String(input.preferencia || "equilibrio").toLowerCase();
  const capacidade = carteiraNumber(input.capacidade_investimento);
  const isDeficitario = (input.diagnostico?.classificacoes || []).some((item) =>
    ["Deficitário", "Gerador de custos", "Ocioso"].includes(item),
  );
  const score = (tipo: CarteiraAlternativa["tipo"]) => {
    let value = 50;
    if (preferencia === "renda" && tipo === "renda") value += 30;
    if (preferencia === "liquidez" && tipo === "vender") value += 30;
    if (preferencia === "equilibrio" && ["manter", "renda"].includes(tipo)) value += 10;
    if (isDeficitario && tipo === "manter") value -= 20;
    if (isDeficitario && ["renda", "vender"].includes(tipo)) value += 10;
    if (capacidade <= 0 && tipo === "transformar") value -= 25;
    return Math.max(0, Math.min(100, value));
  };

  const alternativas: CarteiraAlternativa[] = [
    {
      tipo: "manter",
      titulo: "Manter como está",
      capital_necessario: "Baixo, sujeito às despesas recorrentes",
      resultado_esperado: "Preservação do uso e do resultado atual",
      prazo: input.prazo || "Curto prazo",
      risco: isDeficitario ? "medio" : "baixo",
      premissas: ["Condição atual preservada", "Sem intervenção relevante"],
      validacoes: ["Custos recorrentes", "Situação documental"],
      aderencia: score("manter"),
      justificativa: "Adequado quando o imóvel já cumpre seu objetivo e os riscos estão controlados.",
    },
    {
      tipo: "renda",
      titulo: "Colocar para renda",
      capital_necessario: "A estimar após inspeção e estudo de mercado",
      resultado_esperado: "Receita recorrente a validar",
      prazo: input.prazo || "Curto a médio prazo",
      risco: "medio",
      premissas: ["Demanda de locação", "Imóvel apto ou adaptável para ocupação"],
      validacoes: ["Pesquisa de mercado", "Documentação", "Orçamento de adequações"],
      aderencia: score("renda"),
      justificativa: "Favorece geração de caixa recorrente quando existe demanda e condição de ocupação.",
    },
    {
      tipo: "vender",
      titulo: "Vender",
      capital_necessario: "Baixo, além dos custos de preparação e venda",
      resultado_esperado: "Liquidez pelo valor líquido provável",
      prazo: input.prazo || "Curto a médio prazo",
      risco: "medio",
      premissas: ["Preço compatível com o mercado", "Documentação apta à transferência"],
      validacoes: ["Avaliação", "Tributação", "Documentação e corretagem"],
      aderencia: score("vender"),
      justificativa: "Favorece liquidez e realocação patrimonial, sujeito ao prazo e ao preço de mercado.",
    },
    {
      tipo: "transformar",
      titulo: "Transformar",
      capital_necessario: capacidade > 0
        ? `Limitado à capacidade informada de ${capacidade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Elevado e ainda não informado",
      resultado_esperado: "Potencial de valorização ou renda adicional",
      prazo: input.prazo || "Médio a longo prazo",
      risco: "alto",
      premissas: ["Viabilidade técnica, comercial e urbanística", "Capital disponível"],
      validacoes: ["Zoneamento", "Projeto", "Orçamento", "Mercado", "Capital e governança"],
      aderencia: score("transformar"),
      justificativa: "Pode ampliar valor ou renda, mas exige validação profissional e maior capacidade de execução.",
    },
  ];
  return alternativas.sort((a, b) => b.aderencia - a.aderencia);
}
