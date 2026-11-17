import type { OfferQuota } from "../shared/bia-offer";
import { quotePaymentShare } from "../shared/bia-payment-plan";
import type { InitialMapParticipantInput } from "../shared/member-portfolio";

export function openMapVacancies(participants: unknown) {
  return (Array.isArray(participants) ? participants as InitialMapParticipantInput[] : [])
    .map((slot, index) => ({slot,index}))
    .filter(({slot}) => slot.titular === "vaga" && !slot.memberId && slot.participantId);
}

// Keep unusually large legacy positions bounded: a published offer stores up to 120 payments per unit.
const MAX_UNITS_PER_POSITION = 1000;

function quotaUnitId(parentId: string, offset: number) {
  return parentId + ":ci:" + (offset + 1);
}

function splitQuotaVacancy(slot: InitialMapParticipantInput): InitialMapParticipantInput[] {
  const quantity = slot.cotasInvestimento ?? 0;
  // A position with dedicated duties must remain a single assignment of those duties.
  if (!Number.isSafeInteger(quantity) || quantity < 2 || quantity > MAX_UNITS_PER_POSITION || slot.cargos?.length || slot.indiceContribuicao > 0 ||
      slot.contribuicoes?.some(row => row.cargo !== "Contribuição individual" || row.indice > 0)) return [slot];
  return Array.from({length:quantity}, (_, offset) => ({
    ...slot, participantId:quotaUnitId(slot.participantId!,offset), cotasInvestimento:1,
    capitalComprometido:slot.capitalComprometido === undefined ? undefined : slot.capitalComprometido / quantity,
    pesoCapital:slot.pesoCapital / quantity,
  }));
}

export function openMapQuotaUnits(participants: unknown, includeLegacyGroups = false) {
  return openMapVacancies(participants).flatMap(({slot,index}) => {
    const units = splitQuotaVacancy(slot);
    return (includeLegacyGroups && units.length > 1 ? [slot,...units] : units)
      .map(unit => ({slot:unit,index,parentId:slot.participantId!}));
  });
}

export function liveOfferQuotas(quotas: readonly OfferQuota[], participants: unknown): OfferQuota[] {
  const vacancies = new Map(openMapQuotaUnits(participants, true).map(item => [item.slot.participantId,item.slot]));
  return quotas.flatMap(quota => {
    const original = vacancies.get(quota.id);
    if (original && (original.tipo !== quota.tipo || Number(original.cotasInvestimento) !== quota.quantidade)) return [];
    const slots = quota.quantidade > 1 && quota.quantidade <= MAX_UNITS_PER_POSITION
      ? Array.from({length:quota.quantidade}, (_, offset) => vacancies.get(quotaUnitId(quota.id,offset)))
      : [];
    if (slots.some(slot => slot?.tipo === quota.tipo && slot.cotasInvestimento === 1)) {
      return slots.flatMap((slot,offset) => slot?.tipo === quota.tipo && slot.cotasInvestimento === 1 ? [{
        ...quota, id:slot.participantId!, numero:quota.numero + offset, quantidade:1,
        pagamentos:quotePaymentShare(quota.pagamentos,quota.quantidade,offset,1),
      }] : []);
    }
    return original ? [quota] : [];
  }).map((quota,index) => ({...quota,numero:index+1}));
}

export function competingVacancyIds(participants: unknown, vacancyId: string) {
  const vacancies = openMapQuotaUnits(participants,true);
  const selected = vacancies.find(({slot}) => slot.participantId === vacancyId);
  if (!selected) return [vacancyId];
  return selected.parentId === vacancyId
    ? vacancies.filter(item => item.parentId === vacancyId).map(({slot}) => slot.participantId!)
    : [vacancyId,selected.parentId];
}

export function assignMapVacancy(participants: InitialMapParticipantInput[], vacancyId: string, member: {id:string; nome:string}, allowAdditional=false) {
  const choice = openMapQuotaUnits(participants,true).find(({slot})=>slot.participantId === vacancyId);
  if (choice && choice.parentId !== vacancyId) {
    const slots = participants.flatMap((slot,index) => index === choice.index ? splitQuotaVacancy(slot) : [slot]);
    return assignExistingVacancy(slots,vacancyId,member,allowAdditional);
  }
  return assignExistingVacancy(participants,vacancyId,member,allowAdditional);
}

function assignExistingVacancy(participants: InitialMapParticipantInput[], vacancyId: string, member: {id:string; nome:string}, allowAdditional: boolean) {
  const vacancy = openMapVacancies(participants).find(({slot})=>slot.participantId === vacancyId);
  if (!vacancy) throw Object.assign(new Error("A vaga não está aberta."),{statusCode:409});
  const current = participants.find(slot=>slot.memberId === member.id);
  if (!member.id || (current && !allowAdditional))
    throw Object.assign(new Error("O candidato já consta no MAP ou não possui um perfil vinculado."),{statusCode:409});
  if(current){
    const extra = vacancy.slot;
    if(current.tipo!==extra.tipo || current.naturezaCapital!==extra.naturezaCapital ||
      current.tipoCppCapital?.id!==extra.tipoCppCapital?.id || !Number.isFinite(current.cotasInvestimento) || !Number.isFinite(extra.cotasInvestimento))
      throw Object.assign(new Error("As cotas têm condições diferentes e não podem ser atribuídas à mesma ficha."),{statusCode:409});
    return participants.filter((_,index)=>index!==vacancy.index).map(slot=>slot===current
      ? {...slot,cotasInvestimento:current.cotasInvestimento!+extra.cotasInvestimento!}
      : slot);
  }
  return participants.map((slot,index)=>index === vacancy.index
    ? {...slot,titular:undefined,memberId:member.id,nome:member.nome}
    : slot);
}
