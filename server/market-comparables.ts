export const MARKET_MIN_COMPARABLES = 3;
export const MARKET_RADIUS_KM = 20;

export function marketAreaRange(areaM2: number) {
  const tolerance = Math.min(50, Math.max(15, areaM2 * 0.2));
  return {
    min: Math.max(1, Number((areaM2 - tolerance).toFixed(2))),
    max: Number((areaM2 + tolerance).toFixed(2)),
  };
}

export interface MarketComparable {
  titulo: string;
  url: string;
  tipo: string;
  bairro: string;
  cidade: string;
  localizacao: string;
  area_m2: number;
  preco_total: number;
  preco_m2: number;
  moeda: string;
  distancia_km?: number;
  ano_construcao?: number;
  padrao?: string;
  estado_conservacao?: string;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  trecho?: string;
}

export interface MarketComparableTarget {
  tipo: string;
  bairro?: string;
  cidade?: string;
  localizacao?: string;
  areaM2: number;
  precoM2: number;
  moeda: string;
  raioMaxKm?: number;
  exigirDistancia?: boolean;
  anoConstrucao?: number;
  padrao?: string;
  estadoConservacao?: string;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
}

interface MarketSource {
  titulo: string;
  url: string;
  trecho?: string;
}

export interface MarketComparableAnalysis {
  amostra_suficiente: boolean;
  quantidade_comparaveis: number;
  area_min: number;
  area_max: number;
  comparaveis: MarketComparable[];
  fontes: MarketSource[];
  resumo: string;
  fatores: string[];
  observacao: string;
  classificacao?: "abaixo" | "media" | "acima";
  referencia_m2_min?: number;
  referencia_m2_max?: number;
  referencia_m2_media?: number;
  diferenca_percentual?: number;
  confianca?: "baixa" | "media" | "alta";
  raio_aplicado_km?: number;
  metodo?: "mediana";
  cobertura_caracteristicas_percentual?: number;
  lacunas?: string[];
}

export function marketLocationCandidates(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const endereco = row.endereco || row.address;
  const numero = row.numero || row.number;
  const bairro = row.bairro || row.neighborhood;
  const cidade = row.cidade || row.city;
  const estado = row.estado || row.state;
  const pais = row.pais || row.country;
  const cep = row.cep || row.postal_code;
  const localizacao = row.localizacao || row.location;
  const candidates = [
    [endereco, numero, bairro, cidade, estado, pais, cep ? `CEP ${cep}` : ""],
    [bairro, cidade, estado, pais],
    [cidade, estado, pais],
    [cep ? `CEP ${cep}` : "", pais],
    [localizacao],
  ].map((parts) => parts.filter(Boolean).join(", ").trim()).filter(Boolean);
  return Array.from(new Map(candidates.map((candidate) => [candidate.toLocaleLowerCase("pt-BR"), candidate])).values());
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  let normalized = String(value ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!normalized) return 0;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) normalized = normalized.replace(/\./g, "").replace(",", ".");
    else normalized = normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /,\d{1,2}$/.test(normalized) ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (lastDot >= 0 && /\.\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if ((normalized.match(/\./g) || []).length > 1) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function optionalInteger(value: unknown, min = 0, max = 100): number | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const parsed = Math.round(parsePositiveNumber(value));
  if (!parsed && Number(value) !== 0) return undefined;
  return parsed >= min && parsed <= max ? parsed : undefined;
}

const PROPERTY_CONDITIONS = ["reformar", "regular", "bom", "reformado", "novo"] as const;

function normalizeStandard(value: unknown): string {
  const normalized = normalizeText(value);
  if (/luxo|luxury|altissimo/.test(normalized)) return "luxo";
  if (/alto|premium|superior/.test(normalized)) return "alto";
  if (/economico|popular|entrada/.test(normalized)) return "economico";
  if (/medio|padrao/.test(normalized)) return "medio";
  return "";
}

function normalizeCondition(value: unknown): string {
  const normalized = normalizeText(value);
  if (/novo|lancamento|recem construido/.test(normalized)) return "novo";
  if (/reformado|renovado/.test(normalized)) return "reformado";
  if (/bom/.test(normalized)) return "bom";
  if (/regular/.test(normalized)) return "regular";
  if (/reformar|reforma|ruim/.test(normalized)) return "reformar";
  return "";
}

function rankDifference(values: readonly string[], left: string, right: string): number {
  return Math.abs(values.indexOf(left) - values.indexOf(right));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function canonicalUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeCurrency(value: unknown, fallback: string): string {
  const normalized = normalizeText(value).replace(/\s+/g, "").toUpperCase();
  if (!normalized || normalized === "R" || normalized === "RS") return fallback.toUpperCase();
  if (normalized === "REAL" || normalized === "REAIS") return "BRL";
  return normalized;
}

const TYPE_FAMILIES: Array<{ family: string; pattern: RegExp }> = [
  { family: "apartamento", pattern: /\b(apartamento|apto|flat|studio|kitnet|apartment)\b/ },
  { family: "casa", pattern: /\b(casa|sobrado|residencia|house)\b/ },
  { family: "terreno", pattern: /\b(terreno|lote|gleba|area rural|area urbana|land|lot)\b/ },
  { family: "galpao", pattern: /\b(galpao|armazem|deposito industrial|warehouse)\b/ },
  { family: "sala", pattern: /\b(sala comercial|escritorio|conjunto comercial|office)\b/ },
  { family: "loja", pattern: /\b(loja|ponto comercial|store|retail)\b/ },
  { family: "predio", pattern: /\b(predio|edificio|building)\b/ },
  { family: "rural", pattern: /\b(fazenda|sitio|chacara|farm)\b/ },
];

function typeFamily(value: unknown): string {
  const normalized = normalizeText(value);
  return TYPE_FAMILIES.find(({ pattern }) => pattern.test(normalized))?.family || "";
}

function sameType(targetType: string, comparableType: string): boolean {
  const targetFamily = typeFamily(targetType);
  const comparableFamily = typeFamily(comparableType);
  if (targetFamily) return targetFamily === comparableFamily;

  const target = normalizeText(targetType);
  const comparable = normalizeText(comparableType);
  if (!target || !comparable || target.length < 4 || comparable.length < 4) return false;
  return target.includes(comparable) || comparable.includes(target);
}

function sameRegion(target: MarketComparableTarget, comparable: Record<string, unknown>): boolean {
  const requiredRegion = normalizeText(target.bairro || target.cidade || target.localizacao);
  if (!requiredRegion) return false;
  const comparableRegion = normalizeText([
    comparable.bairro,
    comparable.neighborhood,
    comparable.cidade,
    comparable.city,
    comparable.localizacao,
    comparable.location,
  ].filter(Boolean).join(" "));
  return comparableRegion.includes(requiredRegion);
}

function normalizeComparable(
  value: unknown,
  target: MarketComparableTarget,
  areaMin: number,
  areaMax: number,
): MarketComparable | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const url = canonicalUrl(row.url || row.link);
  const tipo = String(row.tipo || row.qualificacao || row.property_type || "").trim();
  const areaM2 = parsePositiveNumber(row.area_m2 || row.area);
  const precoTotal = parsePositiveNumber(row.preco_total || row.valor || row.preco || row.price);
  const moeda = normalizeCurrency(row.moeda, target.moeda);
  const distanciaKm = Number(row.distancia_km);
  const anoConstrucao = optionalInteger(row.ano_construcao || row.ano || row.year_built, 1800, new Date().getFullYear() + 2);
  const padrao = normalizeStandard(row.padrao || row.standard || row.segmento);
  const estadoConservacao = normalizeCondition(row.estado_conservacao || row.conservacao || row.condition);
  const quartos = optionalInteger(row.quartos || row.dormitorios || row.bedrooms);
  const banheiros = optionalInteger(row.banheiros || row.bathrooms);
  const vagas = optionalInteger(row.vagas || row.garagens || row.parking_spaces);

  if (!url || !sameType(target.tipo, tipo) || (!target.exigirDistancia && !sameRegion(target, row))) return null;
  if (areaM2 < areaMin || areaM2 > areaMax || precoTotal <= 0) return null;
  if (moeda !== target.moeda.toUpperCase()) return null;
  if (target.exigirDistancia && (!Number.isFinite(distanciaKm) || distanciaKm < 0)) return null;
  if (Number.isFinite(distanciaKm) && distanciaKm > Number(target.raioMaxKm || MARKET_RADIUS_KM)) return null;
  if (target.padrao && padrao && target.padrao !== padrao) return null;
  if (target.anoConstrucao != null && anoConstrucao != null && Math.abs(target.anoConstrucao - anoConstrucao) > 12) return null;
  if (target.quartos != null && quartos != null && Math.abs(target.quartos - quartos) > 1) return null;
  if (target.banheiros != null && banheiros != null && Math.abs(target.banheiros - banheiros) > 1) return null;
  if (target.vagas != null && vagas != null && Math.abs(target.vagas - vagas) > 1) return null;
  if (target.estadoConservacao && estadoConservacao
    && rankDifference(PROPERTY_CONDITIONS, target.estadoConservacao, estadoConservacao) > 1) return null;

  return {
    titulo: String(row.titulo || row.title || row.nome || "Imóvel comparável").trim().slice(0, 180),
    url,
    tipo: tipo.slice(0, 120),
    bairro: String(row.bairro || row.neighborhood || "").trim().slice(0, 120),
    cidade: String(row.cidade || row.city || "").trim().slice(0, 120),
    localizacao: String(row.localizacao || row.location || [row.bairro, row.cidade].filter(Boolean).join(", ")).trim().slice(0, 220),
    area_m2: Number(areaM2.toFixed(2)),
    preco_total: Number(precoTotal.toFixed(2)),
    preco_m2: Number((precoTotal / areaM2).toFixed(2)),
    moeda,
    distancia_km: Number.isFinite(distanciaKm) ? Number(distanciaKm.toFixed(2)) : undefined,
    ano_construcao: anoConstrucao,
    padrao: padrao || undefined,
    estado_conservacao: estadoConservacao || undefined,
    quartos,
    banheiros,
    vagas,
    trecho: row.trecho || row.resumo ? String(row.trecho || row.resumo).trim().slice(0, 280) : undefined,
  };
}

export function marketDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classification(precoM2: number, referenceAverage: number): "abaixo" | "media" | "acima" {
  if (precoM2 < referenceAverage * 0.9) return "abaixo";
  if (precoM2 > referenceAverage * 1.1) return "acima";
  return "media";
}

export function buildComparableMarketAnalysis(
  rawComparables: unknown,
  target: MarketComparableTarget,
): MarketComparableAnalysis {
  const normalizedTarget: MarketComparableTarget = {
    ...target,
    moeda: normalizeCurrency(target.moeda, "BRL"),
    anoConstrucao: optionalInteger(target.anoConstrucao, 1800, new Date().getFullYear() + 2),
    padrao: normalizeStandard(target.padrao),
    estadoConservacao: normalizeCondition(target.estadoConservacao),
    quartos: optionalInteger(target.quartos),
    banheiros: optionalInteger(target.banheiros),
    vagas: optionalInteger(target.vagas),
  };
  const { min: areaMin, max: areaMax } = marketAreaRange(target.areaM2);
  const values = Array.isArray(rawComparables) ? rawComparables : [];
  const byUrl = new Map<string, MarketComparable>();

  for (const value of values) {
    const comparable = normalizeComparable(value, normalizedTarget, areaMin, areaMax);
    if (comparable && !byUrl.has(comparable.url)) byUrl.set(comparable.url, comparable);
  }

  const targetNeighborhood = normalizeText(target.bairro);
  const candidates = Array.from(byUrl.values()).sort((left, right) => {
    const leftSameNeighborhood = targetNeighborhood && normalizeText(left.bairro) === targetNeighborhood ? 1 : 0;
    const rightSameNeighborhood = targetNeighborhood && normalizeText(right.bairro) === targetNeighborhood ? 1 : 0;
    return rightSameNeighborhood - leftSameNeighborhood
      || Number(left.distancia_km ?? Number.POSITIVE_INFINITY) - Number(right.distancia_km ?? Number.POSITIVE_INFINITY)
      || Math.abs(left.area_m2 - target.areaM2) - Math.abs(right.area_m2 - target.areaM2);
  });
  const maxRadius = Number(target.raioMaxKm || MARKET_RADIUS_KM);
  let appliedRadius = target.exigirDistancia ? maxRadius : undefined;
  let comparaveis = candidates;
  if (target.exigirDistancia) {
    for (const radius of Array.from(new Set([5, 10, maxRadius])).sort((left, right) => left - right)) {
      const nearby = candidates.filter((item) => Number(item.distancia_km) <= radius);
      if (nearby.length >= MARKET_MIN_COMPARABLES || radius === maxRadius) {
        comparaveis = nearby;
        appliedRadius = radius;
        break;
      }
    }
  }
  comparaveis = comparaveis.slice(0, 12);
  if (comparaveis.length >= 4) {
    const priceMedian = median(comparaveis.map((item) => item.preco_m2));
    const medianDeviation = median(comparaveis.map((item) => Math.abs(item.preco_m2 - priceMedian)));
    const withoutOutliers = medianDeviation > 0
      ? comparaveis.filter((item) => Math.abs(item.preco_m2 - priceMedian) <= medianDeviation * 3)
      : comparaveis;
    if (withoutOutliers.length >= MARKET_MIN_COMPARABLES) comparaveis = withoutOutliers;
  }

  const region = String(target.bairro || target.cidade || target.localizacao || "região informada").trim();
  const residential = ["apartamento", "casa"].includes(typeFamily(target.tipo));
  const characteristics = [
    { label: "padrão", value: normalizedTarget.padrao, key: "padrao" as const },
    { label: "ano de construção", value: normalizedTarget.anoConstrucao, key: "ano_construcao" as const },
    { label: "estado de conservação", value: normalizedTarget.estadoConservacao, key: "estado_conservacao" as const },
    ...(residential ? [
      { label: "quartos", value: normalizedTarget.quartos, key: "quartos" as const },
      { label: "banheiros", value: normalizedTarget.banheiros, key: "banheiros" as const },
      { label: "vagas", value: normalizedTarget.vagas, key: "vagas" as const },
    ] : []),
  ];
  const informedCharacteristics = characteristics.filter((item) => item.value !== undefined && item.value !== "");
  const coveredCharacteristics = informedCharacteristics.length && comparaveis.length
    ? comparaveis.reduce((sum, comparable) => sum + informedCharacteristics.filter((item) => comparable[item.key] != null).length, 0)
      / (informedCharacteristics.length * comparaveis.length) * 100
    : 0;
  const lacunas = characteristics.filter((item) => item.value === undefined || item.value === "").map((item) => item.label);
  const fatores = [
    `mesmo tipo: ${target.tipo}`,
    `região de referência: ${region}`,
    `área entre ${areaMin.toLocaleString("pt-BR")} e ${areaMax.toLocaleString("pt-BR")} m²`,
    ...(target.exigirDistancia ? [`menor raio com amostra suficiente: até ${Number(appliedRadius).toLocaleString("pt-BR")} km`] : []),
    ...informedCharacteristics.map((item) => `${item.label}: ${String(item.value)}`),
    "referência calculada pela mediana do preço por m²",
  ];
  const fontes = comparaveis.map(({ titulo, url, trecho }) => ({ titulo, url, trecho }));
  const base = {
    amostra_suficiente: comparaveis.length >= MARKET_MIN_COMPARABLES,
    quantidade_comparaveis: comparaveis.length,
    area_min: areaMin,
    area_max: areaMax,
    comparaveis,
    fontes,
    fatores,
    raio_aplicado_km: appliedRadius,
    metodo: "mediana" as const,
    cobertura_caracteristicas_percentual: Number(coveredCharacteristics.toFixed(0)),
    lacunas,
  };

  if (!base.amostra_suficiente) {
    return {
      ...base,
      resumo: `Foram encontrados ${comparaveis.length} de ${MARKET_MIN_COMPARABLES} imóveis comparáveis necessários.`,
      observacao: "A referência fica oculta até haver anúncios públicos suficientes do mesmo tipo, região, faixa de área e características compatíveis.",
    };
  }

  const pricesM2 = comparaveis.map((item) => item.preco_m2);
  const referenceMedian = median(pricesM2);
  const difference = ((target.precoM2 - referenceMedian) / referenceMedian) * 100;
  const resultClassification = classification(target.precoM2, referenceMedian);
  const classificationText = resultClassification === "media"
    ? "na média"
    : resultClassification === "acima" ? "acima da média" : "abaixo da média";
  const confidence = comparaveis.length >= 5 && Number(appliedRadius || 0) <= 5
    && informedCharacteristics.length >= 3 && coveredCharacteristics >= 70
    ? "alta"
    : comparaveis.length >= 4 && informedCharacteristics.length >= 2 && coveredCharacteristics >= 50
      ? "media"
      : "baixa";

  return {
    ...base,
    classificacao: resultClassification,
    referencia_m2_min: Math.round(Math.min(...pricesM2)),
    referencia_m2_max: Math.round(Math.max(...pricesM2)),
    referencia_m2_media: Math.round(referenceMedian),
    diferenca_percentual: Number(difference.toFixed(1)),
    confianca: confidence,
    resumo: `O preço informado está ${classificationText} da referência mediana, com base em ${comparaveis.length} imóveis comparáveis em ${region}.`,
    observacao: "A mediana reduz o efeito de anúncios fora da curva. Características ausentes diminuem a confiança; a referência não substitui laudo de avaliação.",
  };
}
