import type { InitialMapParticipantInput } from "../shared/member-portfolio";

export function openMapVacancies(participants: unknown) {
  return (Array.isArray(participants) ? participants as InitialMapParticipantInput[] : [])
    .map((slot, index) => ({slot,index}))
    .filter(({slot}) => slot.titular === "vaga" && !slot.memberId && slot.participantId);
}

export function assignMapVacancy(participants: InitialMapParticipantInput[], vacancyId: string, member: {id:string; nome:string}, allowAdditional=false) {
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
