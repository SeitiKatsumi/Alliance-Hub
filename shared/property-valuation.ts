/** First delivery of Manual BUILT v2: current residential market comparison only. */
export const BUILT_VALUATION_VERSION = "built-residencial-v1";
export function valuationObservationReason(current: { versao_regra?: string; entrada?: { fingerprint?: string } }, previous?: { versao_regra?: string; entrada?: { fingerprint?: string } }) {
  if (!previous) return "Início do histórico exibido";
  if (current.versao_regra !== previous.versao_regra) return "Mudança de método";
  if (!current.entrada?.fingerprint || !previous.entrada?.fingerprint) return "Registro sem comparação de cadastro";
  return current.entrada.fingerprint !== previous.entrada.fingerprint ? "Dados do imóvel alterados" : "Nova pesquisa com o mesmo cadastro";
}
export const PROPERTY_AREA_FIELDS = ["area_privativa_m2", "area_construida_m2", "area_terreno_m2", "area_total_m2"] as const;
export const PROPERTY_AREA_LABELS = {
  area_privativa_m2: "Área privativa", area_construida_m2: "Área construída",
  area_terreno_m2: "Área do terreno", area_total_m2: "Área total",
} as const;
export interface PropertyValuationAreas {
  area_privativa_m2?: number | string | null;
  area_construida_m2?: number | string | null;
  area_terreno_m2?: number | string | null;
  area_total_m2?: number | string | null;
  area_avaliacao_tipo?: "privativa" | "construida" | null;
  areas_fonte?: string | null;
}
export function valuationNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text || !/^[\d.,]+$/.test(text)) return null;
  const n = typeof value === "number" ? value : Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Additive JSON fields; never infer a typed area from the ambiguous legacy area_m2. */
export function sanitizeValuationAreas(body: PropertyValuationAreas): PropertyValuationAreas {
  const values: PropertyValuationAreas = {};
  for (const key of PROPERTY_AREA_FIELDS) {
    const raw = body[key];
    const value = valuationNumber(raw);
    if (raw != null && String(raw).trim() && value == null) throw Object.assign(new Error(`${PROPERTY_AREA_LABELS[key]} deve ser um número positivo.`), { status: 400 });
    values[key] = value;
  }
  if (body.area_avaliacao_tipo && !["privativa", "construida"].includes(body.area_avaliacao_tipo)) throw Object.assign(new Error("Selecione a natureza da área usada na avaliação."), { status: 400 });
  return { ...values, area_avaliacao_tipo: body.area_avaliacao_tipo || null, areas_fonte: String(body.areas_fonte || "").trim().slice(0, 500) };
}
export function propertyValuationReadiness(property: PropertyValuationAreas & { tipo?: string; cidade?: string; estado?: string; pais?: string; endereco?: string; quartos?: unknown; banheiros?: unknown; vagas?: unknown; estado_conservacao?: unknown }) {
  const pending: string[] = [];
  const type = String(property.tipo || "").toLowerCase().trim();
  if (!["casa", "apartamento"].includes(type)) pending.push("Esta etapa atende casas e apartamentos; os demais tipos exigem método específico.");
  if (!property.cidade || !property.estado || !property.endereco) pending.push("Informe endereço, cidade e estado.");
  if (property.pais && !["brasil", "br", "brazil"].includes(property.pais.toLowerCase().trim())) pending.push("Esta etapa do método atende imóveis no Brasil.");
  const basis = property.area_avaliacao_tipo;
  const area = basis === "privativa" ? valuationNumber(property.area_privativa_m2) : basis === "construida" ? valuationNumber(property.area_construida_m2) : null;
  if (!area) pending.push("Informe a área privativa ou construída e selecione qual será usada na avaliação.");
  if (!String(property.areas_fonte || "").trim()) pending.push("Informe de onde vieram as medidas de área.");
  const missingFeatures = ["quartos", "banheiros", "vagas", "estado_conservacao"].filter(key => (property as any)[key] == null || (property as any)[key] === "");
  return { ready: pending.length === 0, pending, area, basis: basis || null, missingFeatures };
}
