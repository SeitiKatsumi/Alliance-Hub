export const DEMAND_VISIBILITIES = ["privada", "publicada", "pausada"] as const;
export const ASSET_VISIBILITIES = ["privada", "publicada", "pausada"] as const;
export const ASSET_ORIGINS = [
  "ativo_proprio",
  "terceiro_autorizado",
  "oportunidade_externa",
  "origem_nao_informada",
] as const;
export const ASSET_STAGES = [
  "identificada",
  "em_analise",
  "complementos_solicitados",
  "pre_viabilidade_aprovada",
  "estruturacao_solicitada",
  "bia_em_formacao",
  "convertida_bia",
  "rejeitada",
  "arquivada",
] as const;
export const INTEREST_STATUSES = [
  "interesse_recebido",
  "em_conversa",
  "selecionado",
  "nao_selecionado",
  "retirado",
] as const;
export const BIA_STRUCTURING_STATUSES = [
  "pendente",
  "complementos_solicitados",
  "aprovada",
  "rejeitada",
  "cancelada",
] as const;

type AllowedValue = readonly string[];

function allowed<T extends AllowedValue>(values: T, value: unknown, fallback: T[number]): T[number] {
  const normalized = String(value || "").trim();
  return values.includes(normalized) ? normalized : fallback;
}

export function normalizeDemandVisibility(value: unknown) {
  return allowed(DEMAND_VISIBILITIES, value, "privada");
}

export function normalizeAssetVisibility(value: unknown) {
  return allowed(ASSET_VISIBILITIES, value, "privada");
}

export function normalizeAssetOrigin(value: unknown) {
  return allowed(ASSET_ORIGINS, value, "origem_nao_informada");
}

export function normalizeAssetStage(value: unknown) {
  return allowed(ASSET_STAGES, value, "identificada");
}

export function normalizeInterestStatus(value: unknown) {
  return allowed(INTEREST_STATUSES, value, "interesse_recebido");
}

export function normalizeBiaStructuringStatus(value: unknown) {
  return allowed(BIA_STRUCTURING_STATUSES, value, "pendente");
}

const PRIVATE_ASSET_FIELDS = [
  "cep",
  "endereco",
  "numero",
  "complemento",
  "documentos",
  "basicInfoAttachment",
  "contato_nome",
  "contato_email",
  "contato_telefone",
  "contato",
  "quem_esta_vendendo",
  "origem_contato",
  "created_by",
  "created_by_membro",
  "originador_user_id",
  "originador_membro_id",
  "owner_user_id",
  "owner_membro_id",
  "directus_id",
  "demanda_origem_id",
  "autorizacao_compartilhamento_at",
  "autorizacao_compartilhamento",
] as const;

export function publicAssetView<T extends Record<string, any>>(
  asset: T,
): T & { dados_privados_liberados: false } {
  const result: Record<string, any> = { ...asset };
  for (const field of PRIVATE_ASSET_FIELDS) delete result[field];
  result.dados_privados_liberados = false;
  return result as T & { dados_privados_liberados: false };
}

export function privateAssetView<T extends Record<string, any>>(
  asset: T,
): T & { dados_privados_liberados: true } {
  return { ...asset, dados_privados_liberados: true };
}

export function publicDemandView(demand: Record<string, any>) {
  return {
    id: demand.id,
    codigo: demand.codigo || null,
    tipo: "demanda",
    selo: "Demanda",
    titulo: demand.titulo,
    resumo_publico: demand.resumo_publico || demand.escopo || null,
    urgencia: demand.urgencia || "normal",
    especialidades: Array.isArray(demand.especialidades) ? demand.especialidades : [],
    status: demand.status,
    publicada_em: demand.publicada_em || demand.criado_em || null,
    cidade: demand.cidade || null,
    estado: demand.estado || null,
    pais: demand.pais || "Brasil",
    tipo_imovel: demand.tipo_imovel || null,
    autor_tipo: demand.autor_tipo || (demand.bia_id ? "bia" : "usuario"),
    bia_id: demand.bia_id || null,
    strategic_cell_id: demand.strategic_cell_id || null,
    strategic_cell_type_code: demand.strategic_cell_type_code || null,
    market_code: demand.market_code || null,
    contribution_area: demand.contribution_area || null,
    primary_segment_code: demand.primary_segment_code || null,
    expira_em: demand.expira_em || null,
    total_interesses: Number(demand.total_interesses || 0),
    dados_privados_liberados: false,
  };
}

export function canRequestBiaStructuring(asset: Record<string, any>) {
  return normalizeAssetOrigin(asset.origem_tipo) !== "origem_nao_informada"
    && Boolean(asset.autorizacao_compartilhamento_at || asset.autorizacao_compartilhamento)
    && normalizeAssetStage(asset.estagio) === "pre_viabilidade_aprovada"
    && !asset.bia_id;
}
