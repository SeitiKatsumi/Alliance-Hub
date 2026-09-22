export const BUILT_MEMBER_ANNUAL_FEE_BRL = 3197;

export type MembershipStatus = "pending" | "active" | "expired" | "canceled" | "refunded" | "disputed";

export function membershipEndsAt(startsAt: Date): Date {
  const endsAt = new Date(startsAt);
  endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
  return endsAt;
}

export function isMembershipActive(
  membership: { status?: unknown; starts_at?: unknown; ends_at?: unknown; frozen_at?: unknown } | null | undefined,
  now = new Date(),
): boolean {
  if (!membership || !["active", "canceled"].includes(String(membership.status || ""))) return false;
  const startsAt = new Date(String(membership.starts_at || ""));
  const endsAt = new Date(String(membership.ends_at || ""));
  const frozenAt = membership.frozen_at ? new Date(String(membership.frozen_at)) : null;
  return Number.isFinite(startsAt.getTime())
    && Number.isFinite(endsAt.getTime())
    && startsAt <= now
    && (Boolean(frozenAt && Number.isFinite(frozenAt.getTime())) || endsAt > now);
}

export type MapContribution = { memberId: string; name?: string; value: number; status: string; finalidade?: string; natureza?: string };
export type MapOriginAllocation = Omit<MapContribution, "status">;
export type MapTransfer = { status?: string; fromMemberId: string; toMemberId: string; value: number };

export const QUOTA_DECIMAL_PLACES = 5;
// MAP Zero owns these fields; the general BIA editor must not submit legacy DM values.
export const BIA_MAP_ECONOMIC_FIELDS = [
  "valor_origem", "divisor_multiplicador", "perc_autor_opa", "perc_aliado_built",
  "perc_built", "perc_dir_alianca", "perc_dir_tecnico", "perc_dir_obras",
  "perc_dir_comercial", "perc_dir_capital", "cpp_autor_opa", "cpp_aliado_built",
  "cpp_built", "cpp_dir_alianca", "cpp_dir_tecnico", "cpp_dir_obras",
  "cpp_dir_comercial", "cpp_dir_capital", "custo_origem_bia", "custo_final_previsto",
] as const;
export const MAP_DYNAMIC_FOOTER = "Este Mapa de Alocação Patrimonial é anexo acessório ao MoU Padrão BUILT e/ou ao instrumento jurídico pertinente à respectiva aliança. Possui finalidade exclusivamente informativa, estratégica e de governança, não constituindo contrato autônomo, promessa de participação, garantia de retorno, cessão de direitos ou obrigação definitiva, nem substituindo ou prevalecendo sobre contratos, atos societários, deliberações formais ou instrumentos jurídicos assinados. Qualquer participação, direito patrimonial, CPP, alocação econômica ou obrigação dependerá da validação e formalização previstas no instrumento jurídico aplicável. Em caso de dúvidas, divergências ou necessidade de interpretação, prevalecerão o instrumento jurídico pertinente, as deliberações formais da aliança e a orientação da Diretoria da Aliança.";

export type InitialMapParticipantInput = {
  modeloCalculo?: 4;
  contribuicoes?: Array<{ cargo: string; indice: number; tipoCpp?: { id: string; nome: string }; valor?: number }>;
  participantId?: string;
  memberId?: string | null;
  institutionCode?: string | null;
  nome: string;
  cargos?: string[];
  tipo: "guardiao" | "multiplicador";
  indiceContribuicao: number;
  pesoCapital: number;
  capitalComprometido?: number;
  naturezaCapital?: "caixa" | "nao_caixa";
  tipoCppCapital?: { id: string; nome: string };
  tipoCppContribuicao?: { id: string; nome: string };
};

export type InitialMapParticipant = InitialMapParticipantInput & {
  participantId: string;
  cargos: string[];
  cppOrigem: number;
  cppCapital: number;
  cppTotal: number;
  mapPercentual: number;
};

export type InitialMapCalculation = {
  valorOrigem: number;
  divisorMultiplicador: number;
  baseEconomicaInicial: number;
  pesoCapitalTotal: number;
  participantes: InitialMapParticipant[];
};

// Display the approved calculation; never reconstruct new BIAs from legacy role percentages.
export function initialMapEconomicSummary(snapshot: Pick<InitialMapCalculation, "valorOrigem" | "divisorMultiplicador" | "baseEconomicaInicial" | "participantes">) {
  return {
    rows: snapshot.participantes.map(p => ({ label: p.nome, perc: p.indiceContribuicao, cpp: p.cppOrigem })),
    divisor: snapshot.divisorMultiplicador,
    cppTotal: roundQuota(snapshot.baseEconomicaInicial - snapshot.valorOrigem),
    custoOrigem: snapshot.baseEconomicaInicial,
  };
}

const INITIAL_MAP_PERCENT_EPSILON = 0.0001;

function roundQuota(value: number): number {
  return Number(value.toFixed(QUOTA_DECIMAL_PLACES));
}

export function initialMapContributionValue(valorOrigem: number, indice: number): number {
  return roundQuota(valorOrigem * roundQuota(indice) / 100);
}

export function withInitialCapitalParticipation(participant: InitialMapParticipantInput, suppliesCapital: boolean): InitialMapParticipantInput {
  return suppliesCapital
    ? {...participant, tipo:"guardiao", capitalComprometido:participant.tipo === "guardiao" ? participant.capitalComprometido : NaN}
    : {...participant, tipo:"multiplicador", capitalComprometido:0, pesoCapital:0, tipoCppCapital:undefined};
}

export function calculateInitialMap(
  valorOrigem: number,
  participantesInput: InitialMapParticipantInput[],
): InitialMapCalculation {
  if (!Number.isFinite(valorOrigem) || valorOrigem <= 0) throw new Error("Informe um Valor de Origem maior que zero.");
  if (!Array.isArray(participantesInput) || participantesInput.length === 0) throw new Error("Adicione pelo menos um participante ao MAP Zero.");

  const seen = new Set<string>();
  const byRole = participantesInput.some(p => p.modeloCalculo === 4);
  if (byRole && participantesInput.some(p => p.modeloCalculo !== 4)) throw new Error("Não misture versões do modelo do MAP.");
  const assignedRoles = new Set<string>();
  const byValue = participantesInput.some((p) => p.capitalComprometido !== undefined);
  const participantes = participantesInput.map((item) => {
    const memberId = String(item.memberId || "").trim() || null;
    const institutionCode = String(item.institutionCode || "").trim().toUpperCase() || null;
    const participantId = String(item.participantId || (memberId ? `member:${memberId}` : institutionCode ? `institution:${institutionCode}` : "")).trim();
    if (!participantId) throw new Error("Todo participante precisa de uma identidade válida.");
    const identity = memberId ? `member:${memberId}` : institutionCode ? `institution:${institutionCode}` : participantId;
    if (seen.has(identity)) throw new Error("A mesma pessoa não pode aparecer mais de uma vez no MAP Zero.");
    seen.add(identity);

    if (item.tipo !== "guardiao" && item.tipo !== "multiplicador") throw new Error("Escolha Guardião ou Multiplicador para cada participante.");
    const contribuicoes = byRole ? (item.contribuicoes || []).map(c => {
      const cargo = String(c.cargo || "").trim();
      if (!cargo || (cargo !== "Contribuição individual" && !(item.cargos || []).includes(cargo))) throw new Error("A contribuição deve corresponder a um cargo da pessoa.");
      const key = cargo === "Contribuição individual" ? `${identity}:${cargo}` : cargo;
      if (assignedRoles.has(key)) throw new Error("Cada cargo deve ter apenas uma contribuição e um responsável.");
      assignedRoles.add(key);
      if (c.indice == null || !Number.isFinite(c.indice) || c.indice < 0) throw new Error("Preencha o DM de cada cargo, inclusive zero.");
      return { cargo, indice: roundQuota(c.indice), tipoCpp: c.tipoCpp, valor: initialMapContributionValue(valorOrigem, c.indice) };
    }) : undefined;
    if (byRole && (!contribuicoes?.length || (item.cargos || []).some(c => !contribuicoes.some(row => row.cargo === c)))) throw new Error("Preencha a contribuição de cada cargo.");
    if ((!byRole && item.indiceContribuicao == null) || (!byValue && item.pesoCapital == null)) throw new Error("Preencha o Índice de Contribuição e a composição de capital de cada participante.");
    const indiceContribuicao = byRole ? contribuicoes!.reduce((sum,c) => sum + c.indice, 0) : Number(item.indiceContribuicao);
    const capital = Number(item.capitalComprometido);
    if (byValue && (item.capitalComprometido == null || !Number.isFinite(capital) || capital < 0)) throw new Error("Informe o capital comprometido de cada participante, inclusive zero.");
    const pesoCapital = byValue ? capital / valorOrigem * 100 : Number(item.pesoCapital);
    if (!Number.isFinite(indiceContribuicao)) throw new Error("Preencha o DM (%) de cada participante (índice individual), inclusive zero.");
    if (indiceContribuicao < 0) throw new Error("O Índice de Contribuição não pode ser negativo.");
    if (!Number.isFinite(pesoCapital) || pesoCapital < 0) throw new Error("O Peso de Capital não pode ser negativo.");
    if (!byRole && item.tipo === "multiplicador" && (byValue ? capital !== 0 : Math.abs(pesoCapital) > INITIAL_MAP_PERCENT_EPSILON)) throw new Error("Sócio Multiplicador não recebe Peso de Capital.");
    if (byRole && !byValue) throw new Error("O modelo por cargo exige capital por valor.");

    return {
      participantId,
      memberId,
      institutionCode,
      nome: String(item.nome || "").trim() || (institutionCode === "BUILT" ? "BUILT" : "Participante"),
      cargos: Array.from(new Set((item.cargos || []).map((role) => String(role).trim()).filter(Boolean))),
      tipo: item.tipo,
      ...(byRole ? { modeloCalculo: 4 as const, contribuicoes } : {}),
      indiceContribuicao: roundQuota(indiceContribuicao),
      pesoCapital: byRole || item.tipo === "guardiao" ? roundQuota(pesoCapital) : 0,
      ...(byValue ? { capitalComprometido: roundQuota(capital), naturezaCapital: item.naturezaCapital,
        tipoCppCapital: item.tipoCppCapital, tipoCppContribuicao: item.tipoCppContribuicao } : {}),
    };
  });

  const guardioes = participantes.filter((item) => byRole || item.tipo === "guardiao");
  const pesoCapitalTotal = roundQuota(guardioes.reduce((sum, item) => sum + item.pesoCapital, 0));
  if (!guardioes.length || (byValue ? Math.round(participantes.reduce((sum, p) => sum + Number(p.capitalComprometido), 0) * 100000) !== Math.round(valorOrigem * 100000) : Math.abs(pesoCapitalTotal - 100) > INITIAL_MAP_PERCENT_EPSILON)) {
    throw new Error(byValue ? "Os valores comprometidos devem somar exatamente o Valor de Origem (100%)." : "Os Pesos de Capital dos Sócios Guardiões devem totalizar 100%.");
  }

  const positiveWeights = guardioes.filter((item) => byValue ? Number(item.capitalComprometido) > 0 : item.pesoCapital > 0);
  const capitalValues = byValue ? positiveWeights.map((p) => Number(p.capitalComprometido)) : allocateQuotaTransferAmounts(valorOrigem, positiveWeights.map((item) => item.pesoCapital));
  const capitalByParticipant = new Map(positiveWeights.map((item, index) => [item.participantId, capitalValues[index]]));
  const divisorMultiplicador = roundQuota(participantes.reduce((sum, item) => sum + item.indiceContribuicao, 0));
  const withCpp = participantes.map((item) => {
    const cppOrigem = byRole ? roundQuota(item.contribuicoes!.reduce((sum,c) => sum + c.valor, 0)) : initialMapContributionValue(valorOrigem, item.indiceContribuicao);
    const cppCapital = roundQuota(capitalByParticipant.get(item.participantId) || 0);
    return { ...item, cppOrigem, cppCapital, cppTotal: roundQuota(cppOrigem + cppCapital), mapPercentual: 0 };
  });
  const baseEconomicaInicial = roundQuota(valorOrigem + withCpp.reduce((sum, item) => sum + item.cppOrigem, 0));
  const positiveRows = withCpp.filter((item) => item.cppTotal > 0);
  const roundedPercents = positiveRows.map((item) => roundQuota(item.cppTotal / baseEconomicaInicial * 100));
  if (roundedPercents.length) {
    const diff = roundQuota(100 - roundedPercents.reduce((sum, value) => sum + value, 0));
    roundedPercents[roundedPercents.length - 1] = roundQuota(roundedPercents[roundedPercents.length - 1] + diff);
  }
  const percentByParticipant = new Map(positiveRows.map((item, index) => [item.participantId, roundedPercents[index]]));

  return {
    valorOrigem: roundQuota(valorOrigem),
    divisorMultiplicador,
    baseEconomicaInicial,
    pesoCapitalTotal,
    participantes: withCpp.map((item) => ({ ...item, mapPercentual: percentByParticipant.get(item.participantId) || 0 })),
  };
}

export function allocateQuotaTransferAmounts(total: number, percentages: number[]): number[] {
  const scale = 10 ** QUOTA_DECIMAL_PLACES;
  if (!Number.isFinite(total) || total <= 0 || percentages.length === 0) throw new Error("Valor total inválido");
  if (percentages.some((percent) => !Number.isFinite(percent) || percent <= 0 || percent > 100)) throw new Error("Percentual inválido");
  const percentTotal = percentages.reduce((sum, percent) => sum + percent, 0);
  if (percentTotal > 100.000001) throw new Error("A soma dos percentuais não pode exceder 100%");

  const requestedUnits = Math.round(total * scale * percentTotal / 100);
  const rawUnits = percentages.map((percent) => total * scale * percent / 100);
  const units = rawUnits.map(Math.floor);
  let remainder = requestedUnits - units.reduce((sum, value) => sum + value, 0);
  const order = rawUnits.map((value, index) => ({ index, fraction: value - units[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) units[order[index % order.length].index] += 1;
  if (units.some((value) => value <= 0)) throw new Error("Valor insuficiente para distribuir entre todos os destinatários");
  return units.map((value) => value / scale);
}

export function calculateMap(contributions: MapContribution[], transfers: MapTransfer[], originAllocations: MapOriginAllocation[] = [], strictTransfers = false) {
  const values = new Map<string, { memberId: string; name: string; value: number }>();
  const addValue = (contribution: MapOriginAllocation) => {
    if (!contribution.memberId || !Number.isFinite(contribution.value) || contribution.value <= 0) return;
    const current = values.get(contribution.memberId) || { memberId: contribution.memberId, name: contribution.name || "Membro", value: 0 };
    current.value += contribution.value;
    values.set(contribution.memberId, current);
  };
  for (const allocation of originAllocations) addValue(allocation);
  for (const contribution of contributions) {
    if (contribution.finalidade === "integralizacao_inicial" || contribution.natureza === "nao_caixa") continue;
    if (String(contribution.status).toLowerCase() !== "pago") continue;
    addValue(contribution);
  }
  for (const transfer of transfers) {
    if (transfer.status !== "aceita" || transfer.fromMemberId === transfer.toMemberId) continue;
    const source = values.get(transfer.fromMemberId);
    if (strictTransfers && (!Number.isFinite(transfer.value) || transfer.value <= 0 || Math.round((source?.value || 0) * 100000) < Math.round(transfer.value * 100000))) {
      throw new Error("A composição do MAP não cobre uma transferência aceita. Revise a base e as movimentações antes de continuar.");
    }
    if (!source) continue;
    const moved = Math.min(Math.max(0, transfer.value), Math.max(0, source.value));
    if (!moved) continue;
    source.value -= moved;
    const target = values.get(transfer.toMemberId) || { memberId: transfer.toMemberId, name: "Membro", value: 0 };
    target.value += moved;
    values.set(transfer.toMemberId, target);
  }
  const rows = Array.from(values.values())
    .map((row) => ({ ...row, value: Number(row.value.toFixed(QUOTA_DECIMAL_PLACES)) }))
    .filter((row) => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({ ...row, percent: total ? (row.value / total) * 100 : 0 }));
}

export function calculatePortfolioTotals(
  properties: Array<{ acquisitionValue?: number; currentValue?: number; debt?: number; liquidity?: string; ownershipPercent?: number }>,
  alliances: Array<{ invested?: number; participationValue?: number | null; liquidity?: string }>,
) {
  const share = (item: { ownershipPercent?: number }) => Math.min(100, Math.max(0, Number(item.ownershipPercent ?? 100))) / 100;
  const acquisitionValue = properties.reduce((sum, item) => sum + Number(item.acquisitionValue || 0) * share(item), 0);
  const propertyCurrentValue = properties.reduce((sum, item) => sum + Number(item.currentValue || 0) * share(item), 0);
  const debt = properties.reduce((sum, item) => sum + Number(item.debt || 0) * share(item), 0);
  const allianceInvested = alliances.reduce((sum, item) => sum + Number(item.invested || 0), 0);
  const allianceValue = alliances.reduce((sum, item) => sum + Number(item.participationValue || 0), 0);
  const netWorth = propertyCurrentValue - debt + allianceValue;
  const estimatedTotal = propertyCurrentValue + allianceValue;
  const acquisitionTotal = acquisitionValue + allianceInvested;
  const propertyAppreciation = properties.reduce((sum, item) => {
    const acquisition = Number(item.acquisitionValue || 0) * share(item);
    const current = Number(item.currentValue || 0) * share(item);
    return acquisition > 0 && current > 0 ? sum + current - acquisition : sum;
  }, 0);
  const allianceAppreciation = alliances.reduce((sum, item) => {
    const invested = Number(item.invested || 0);
    const current = item.participationValue == null ? 0 : Number(item.participationValue);
    return invested > 0 && current > 0 ? sum + current - invested : sum;
  }, 0);
  const lowLiquidityValue = properties.reduce((sum, item) => sum + (item.liquidity === "baixa" ? Number(item.currentValue || 0) * share(item) : 0), 0)
    + alliances.reduce((sum, item) => sum + (item.liquidity === "baixa" ? Number(item.participationValue || 0) : 0), 0);
  return {
    netWorth,
    estimatedTotal,
    acquisitionValue,
    acquisitionTotal,
    propertyCurrentValue,
    debt,
    allianceInvested,
    allianceValue,
    registeredAppreciation: propertyAppreciation + allianceAppreciation,
    valuationCoverage: {
      propertiesIncluded: properties.filter((item) => Number(item.acquisitionValue || 0) > 0 && Number(item.currentValue || 0) > 0).length,
      propertiesTotal: properties.length,
      alliancesIncluded: alliances.filter((item) => Number(item.invested || 0) > 0 && item.participationValue != null && Number(item.participationValue) > 0).length,
      alliancesTotal: alliances.length,
    },
    lowLiquidityPercent: netWorth > 0 ? (lowLiquidityValue / netWorth) * 100 : 0,
  };
}

export type PortfolioExchangeRate = { moeda: string; taxaBrl: number; data: string; fonte: string };

export function convertPortfolioAmountToBrl(
  value: number,
  currency: string | null | undefined,
  rates: Map<string, PortfolioExchangeRate>,
): number | null {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return null;
  const normalized = String(currency || "BRL").trim().toUpperCase();
  if (normalized === "BRL") return amount;
  const rate = rates.get(normalized);
  return rate && Number.isFinite(rate.taxaBrl) && rate.taxaBrl > 0 ? amount * rate.taxaBrl : null;
}

export function normalizeFinancingInstallments(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item: any) => ({
    parcela: Math.max(1, Number(item?.parcela || 0)),
    valor: Math.max(0, Number(item?.valor || 0)),
    data: String(item?.data_vencimento || item?.data || ""),
    status: ["pago", "agendado", "vencido", "pendente", "cancelado"].includes(String(item?.status)) ? String(item.status) : "pendente",
  })).filter((item) => item.valor > 0 && /^\d{4}-\d{2}-\d{2}$/.test(item.data));
}
