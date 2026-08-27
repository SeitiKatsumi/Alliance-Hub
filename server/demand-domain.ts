export const DEMAND_RESOLUTION_MODES = [
  "DIRECT_HIRE",
  "NETWORK_DEMAND",
  "INTERNAL_BIA",
  "OBA",
] as const;

export type DemandResolutionMode = typeof DEMAND_RESOLUTION_MODES[number];

const RESOLUTION_ALIASES: Record<string, DemandResolutionMode> = {
  contratacao_direta: "DIRECT_HIRE",
  direct_hire: "DIRECT_HIRE",
  solicitacao: "NETWORK_DEMAND",
  demanda_rede: "NETWORK_DEMAND",
  network_demand: "NETWORK_DEMAND",
  interna_bia: "INTERNAL_BIA",
  internal_bia: "INTERNAL_BIA",
  oba: "OBA",
};

export function normalizeDemandResolutionMode(
  value: unknown,
  fallback: DemandResolutionMode = "NETWORK_DEMAND",
): DemandResolutionMode {
  const normalized = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  return RESOLUTION_ALIASES[normalized] || fallback;
}

export function demandResolutionError(mode: DemandResolutionMode, biaId?: unknown): string | null {
  if ((mode === "INTERNAL_BIA" || mode === "OBA") && !String(biaId || "").trim()) {
    return mode === "OBA"
      ? "A resolução por OBA exige uma Demanda vinculada a uma BIA."
      : "A resolução interna exige uma Demanda vinculada a uma BIA.";
  }
  return null;
}

export const DEMAND_PROPOSAL_STATUSES = [
  "interesse_recebido",
  "em_analise",
  "selecionado",
  "nao_selecionado",
  "retirado",
] as const;

export type DemandProposalStatus = typeof DEMAND_PROPOSAL_STATUSES[number];

export function normalizeDemandProposalStatus(value: unknown): DemandProposalStatus | null {
  const normalized = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  const aliases: Record<string, DemandProposalStatus> = {
    recebido: "interesse_recebido",
    proposta_recebida: "interesse_recebido",
    interesse_recebido: "interesse_recebido",
    em_analise: "em_analise",
    aceito: "selecionado",
    aceita: "selecionado",
    selecionado: "selecionado",
    rejeitado: "nao_selecionado",
    rejeitada: "nao_selecionado",
    nao_selecionado: "nao_selecionado",
    retirado: "retirado",
    retirada: "retirado",
  };
  return aliases[normalized] || null;
}

export function normalizeProposalAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "string"
    ? Number(value.trim().replace(/\./g, "").replace(",", "."))
    : Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function demandStatusAfterProposalAccepted(current: unknown) {
  const status = String(current || "").trim().toLowerCase();
  return status === "aberta" || status === "rascunho" ? "em_negociacao" : status;
}
