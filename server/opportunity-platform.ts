import { createHash, randomBytes } from "crypto";

export const OPPORTUNITY_STATUSES = [
  "rascunho",
  "aberta",
  "em_negociacao",
  "contratada",
  "em_execucao",
  "concluida",
  "convertida",
  "encerrada_sem_acordo",
  "expirada",
  "cancelada",
  "arquivada",
] as const;

export type OpportunityStatus = typeof OPPORTUNITY_STATUSES[number];
export type OpportunityKind = "demanda" | "oba";

export const ECONOMIC_OPPORTUNITY_STAGES = [
  "identificada",
  "em_analise",
  "em_amadurecimento",
  "pronta_decisao",
  "estruturacao_solicitada",
  "bia_em_formacao",
  "convertida_bia",
  "descartada",
  "arquivada",
] as const;

export type EconomicOpportunityStage = typeof ECONOMIC_OPPORTUNITY_STAGES[number];

export const RO_DECISION_ACTIONS = [
  "descartar",
  "amadurecer",
  "gerar_demanda",
  "solicitar_bia",
] as const;

export type RoDecisionAction = typeof RO_DECISION_ACTIONS[number];

export const TERMINAL_OPPORTUNITY_STATUSES = new Set<OpportunityStatus>([
  "concluida",
  "convertida",
  "encerrada_sem_acordo",
  "expirada",
  "cancelada",
  "arquivada",
]);

export const DISTRIBUTION_AUDIENCES = [
  "comunidade_origem",
  "mesmo_territorio",
  "mesmo_estado",
  "mesmo_pais",
  "membros_globais",
  "vitrine_geral",
] as const;

export function normalizeOpportunityStatus(value: unknown, fallback: OpportunityStatus = "rascunho"): OpportunityStatus {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  const aliases: Record<string, OpportunityStatus> = {
    ativa: "aberta",
    ativo: "aberta",
    publicada: "aberta",
    em_andamento: "em_execucao",
    aguardando: "em_negociacao",
    encerrada: "concluida",
    encerrado: "concluida",
    cancelado: "cancelada",
    desistencia: "encerrada_sem_acordo",
  };
  const candidate = aliases[normalized] || normalized;
  return OPPORTUNITY_STATUSES.includes(candidate as OpportunityStatus)
    ? candidate as OpportunityStatus
    : fallback;
}

export function normalizeOpportunityVisibility(value: unknown, fallback = "privada") {
  const normalized = String(value || "").trim().toLowerCase();
  return ["privada", "publicada", "pausada", "restrita"].includes(normalized) ? normalized : fallback;
}

export function opportunityExpiry(from: Date = new Date(), days = 60): Date {
  const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 60;
  return new Date(from.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

function randomCodeBody(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createDemandCode() {
  return `DEM-${randomCodeBody(10)}`;
}

export function createMeetingCode() {
  return `RO-${randomCodeBody(10)}`;
}

export function createEconomicOpportunityCode() {
  return `OPP-${randomCodeBody(10)}`;
}

export function normalizeEconomicOpportunityStage(
  value: unknown,
  fallback: EconomicOpportunityStage = "identificada",
): EconomicOpportunityStage {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  const aliases: Record<string, EconomicOpportunityStage> = {
    analise: "em_analise",
    amadurecimento: "em_amadurecimento",
    pronta_para_decisao: "pronta_decisao",
    convertida_em_bia: "convertida_bia",
    rejeitada: "descartada",
  };
  const candidate = aliases[normalized] || normalized;
  return ECONOMIC_OPPORTUNITY_STAGES.includes(candidate as EconomicOpportunityStage)
    ? candidate as EconomicOpportunityStage
    : fallback;
}

export function normalizeRoDecisionAction(value: unknown): RoDecisionAction | null {
  const normalized = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  return RO_DECISION_ACTIONS.includes(normalized as RoDecisionAction)
    ? normalized as RoDecisionAction
    : null;
}

export function createLegacyStableCode(kind: OpportunityKind, sourceId: string) {
  const digest = createHash("sha256").update(`${kind}:${sourceId}`).digest("hex").slice(0, 10).toUpperCase();
  return kind === "demanda" ? `DEM-${digest}` : `OBA-LEGADO-${digest.slice(0, 6)}`;
}

export function createOpaCode(biaCode: string | null | undefined, sequence: number) {
  const safeBia = String(biaCode || "LEGADO").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14) || "LEGADO";
  return `OBA-${safeBia}-${Math.max(1, Math.floor(sequence)).toString().padStart(2, "0")}`;
}

export function buildDistributionSchedule(start: Date = new Date(), intervalHours = 12) {
  const safeInterval = Math.max(1, Math.floor(intervalHours));
  return DISTRIBUTION_AUDIENCES.map((audiencia, index) => ({
    ordem: index + 1,
    audiencia,
    agendada_em: new Date(start.getTime() + index * safeInterval * 60 * 60 * 1000),
  }));
}

export function isOpportunityEditable(status: unknown) {
  return !TERMINAL_OPPORTUNITY_STATUSES.has(normalizeOpportunityStatus(status));
}

export function isOpportunityPublic(status: unknown, visibility: unknown, expiresAt?: Date | string | null, now = new Date()) {
  if (normalizeOpportunityVisibility(visibility) !== "publicada") return false;
  if (TERMINAL_OPPORTUNITY_STATUSES.has(normalizeOpportunityStatus(status))) return false;
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry > now;
}

export function canReadRestrictedOpportunity(input: {
  isAdmin?: boolean;
  actorUserId?: string | null;
  actorMemberId?: string | null;
  creatorUserId?: string | null;
  authorUserId?: string | null;
  authorMemberId?: string | null;
  responsibleMemberId?: string | null;
  reviewerMemberId?: string | null;
}) {
  if (input.isAdmin) return true;
  const actorUserId = String(input.actorUserId || "");
  const actorMemberId = String(input.actorMemberId || "");
  if (actorUserId && [input.creatorUserId, input.authorUserId].some((value) => String(value || "") === actorUserId)) return true;
  if (actorMemberId && [input.authorMemberId, input.responsibleMemberId, input.reviewerMemberId].some((value) => String(value || "") === actorMemberId)) return true;
  return false;
}

export function publicOpportunityRegistryView(item: Record<string, any>) {
  return {
    id: item.id,
    source_id: item.source_id,
    codigo: item.codigo,
    tipo: item.tipo,
    selo: item.selo,
    titulo: item.titulo,
    descricao: item.descricao,
    status: item.status,
    visibilidade: item.visibilidade,
    urgencia: item.urgencia,
    especialidades: Array.isArray(item.especialidades) ? item.especialidades : [],
    cidade: item.cidade,
    estado: item.estado,
    pais: item.pais,
    expira_em: item.expira_em,
    publicada_em: item.publicada_em,
    total_interesses: item.total_interesses,
    resultado_fechamento: item.resultado_fechamento,
    valor_fechamento: item.valor_fechamento,
    moeda_fechamento: item.moeda_fechamento,
    url: item.url,
    can_manage: false,
  };
}
