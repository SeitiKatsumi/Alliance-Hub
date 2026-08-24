import { parseRamosValue, parseSegmentosValue } from "./ramos-segmentos";

export const ALL_VITRINE_PARTNER_FILTERS = "all";

const BRAZILIAN_STATE_KEYS: Record<string, string> = {
  acre: "ac", alagoas: "al", amapa: "ap", amazonas: "am", bahia: "ba", ceara: "ce",
  "distrito federal": "df", "espirito santo": "es", goias: "go", maranhao: "ma",
  "mato grosso": "mt", "mato grosso do sul": "ms", "minas gerais": "mg", para: "pa",
  paraiba: "pb", parana: "pr", pernambuco: "pe", piaui: "pi", "rio de janeiro": "rj",
  "rio grande do norte": "rn", "rio grande do sul": "rs", rondonia: "ro", roraima: "rr",
  "santa catarina": "sc", "sao paulo": "sp", sergipe: "se", tocantins: "to",
};

export interface VitrinePartnerSearchProfile {
  nome?: string | null;
  cargo?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  especialidade?: string | null;
  especialidade_livre?: string | null;
  ramo_atuacao?: string | null;
  segmento?: string | null;
  area_atuacao?: string | null;
  idiomas?: string[] | null;
  Especialidades?: Array<{
    especialidades_id?: { nome_especialidade?: string | null } | null;
  }> | null;
}

export interface VitrinePartnerFilters {
  query?: string;
  cidade?: string;
  estado?: string;
  ramo?: string;
  segmento?: string;
  areaAtuacao?: string;
  especialidade?: string;
}

export function normalizeVitrinePartnerText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;/|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const label = String(value || "").trim();
    const key = normalizeVitrinePartnerText(label);
    if (key && !unique.has(key)) unique.set(key, label);
  }
  return Array.from(unique.values());
}

export function getVitrinePartnerRamos(profile: VitrinePartnerSearchProfile): string[] {
  return parseRamosValue(profile.ramo_atuacao);
}

export function getVitrinePartnerSegmentos(profile: VitrinePartnerSearchProfile): string[] {
  return parseSegmentosValue(profile.segmento);
}

export function getVitrinePartnerEspecialidades(profile: VitrinePartnerSearchProfile): string[] {
  return uniqueValues([
    profile.especialidade,
    profile.especialidade_livre,
    ...(profile.Especialidades || []).map(item => item?.especialidades_id?.nome_especialidade),
  ]);
}

export function getVitrinePartnerCidadeKey(profile: VitrinePartnerSearchProfile): string {
  return normalizeVitrinePartnerText(profile.cidade);
}

export function getVitrinePartnerEstadoKey(value: unknown): string {
  const estado = normalizeVitrinePartnerText(value);
  return BRAZILIAN_STATE_KEYS[estado] || estado;
}

function matchesValue(values: string[], filter = ALL_VITRINE_PARTNER_FILTERS): boolean {
  if (!filter || filter === ALL_VITRINE_PARTNER_FILTERS) return true;
  return values.some(value => normalizeVitrinePartnerText(value) === filter);
}

export function matchesVitrinePartner(
  profile: VitrinePartnerSearchProfile,
  filters: VitrinePartnerFilters,
): boolean {
  const ramos = getVitrinePartnerRamos(profile);
  const segmentos = getVitrinePartnerSegmentos(profile);
  const especialidades = getVitrinePartnerEspecialidades(profile);
  const queryTokens = normalizeVitrinePartnerText(filters.query).split(" ").filter(Boolean);
  const searchable = normalizeVitrinePartnerText([
    profile.nome,
    profile.cargo,
    profile.empresa,
    profile.cidade,
    profile.estado,
    profile.pais,
    ...ramos,
    ...segmentos,
    profile.area_atuacao,
    ...especialidades,
    ...(profile.idiomas || []),
  ].filter(Boolean).join(" "));

  return queryTokens.every(token => searchable.includes(token))
    && (!filters.cidade || filters.cidade === ALL_VITRINE_PARTNER_FILTERS || getVitrinePartnerCidadeKey(profile) === filters.cidade)
    && (!filters.estado || filters.estado === ALL_VITRINE_PARTNER_FILTERS || getVitrinePartnerEstadoKey(profile.estado) === filters.estado)
    && matchesValue(ramos, filters.ramo)
    && matchesValue(segmentos, filters.segmento)
    && matchesValue([profile.area_atuacao || ""], filters.areaAtuacao)
    && matchesValue(especialidades, filters.especialidade);
}
