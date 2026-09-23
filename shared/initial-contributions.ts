import type { InitialMapParticipant, InitialMapParticipantInput } from "./member-portfolio";
import { BIA_PARTICIPANT_ROLE_LABELS } from "./bia-access";

export function economicRightName(cargo: string, natureza?: string): string | undefined {
  const roles = BIA_PARTICIPANT_ROLE_LABELS;
  if ([roles.autor, roles.aliado].includes(cargo)) return "Origem";
  if ([roles.diretor_alianca, roles.diretor_tecnico, roles.diretor_obra, roles.diretor_comercial, roles.diretor_capital].includes(cargo)) return "Liderança";
  if (cargo === "Contribuição individual") return natureza === "caixa" ? "Capital" : natureza === "nao_caixa" ? "Propriedade" : undefined;
  return undefined;
}

// Only apply to editable model-5 compositions, never to historical snapshot reads.
export function withAutomaticEconomicRights(participants: InitialMapParticipantInput[], types: Array<{id: string | number; Nome: string}>): InitialMapParticipantInput[] {
  const normalize = (name: string) => name.replace(/^CPP\s*(?:de\s+)?/i, "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let changed = false;
  const result = participants.map(p => {
    let personChanged = false;
    const contribuicoes = p.contribuicoes?.map(c => {
      const individual = p.modeloCalculo === 5 && c.cargo === "Contribuição individual";
      const indice = individual ? 0 : c.indice;
      const name = individual ? undefined : economicRightName(c.cargo, p.naturezaCapital);
      const type = name ? types.find(t => normalize(t.Nome) === normalize(name)) : undefined;
      const tipoCpp = type ? {id: String(type.id), nome: type.Nome} : undefined;
      if (Object.is(c.indice, indice) && c.tipoCpp?.id === tipoCpp?.id && c.tipoCpp?.nome === tipoCpp?.nome) return c;
      personChanged = changed = true;
      return {...c, indice, tipoCpp};
    });
    return personChanged ? {...p, contribuicoes} : p;
  });
  return changed ? result : participants;
}

export type ScheduleSeries = { total: number; quantidade: number; primeiroVencimento: string; meses: number };
export type InitialCommitment = {
  chave: string; participanteId: string | null; componente: "ativo" | "capital" | "contribuicao";
  nome: string; valor: number; natureza: "caixa" | "nao_caixa";
  tipoCpp?: { id: string; nome: string }; beneficiario: string; series: ScheduleSeries[];
};
export type ScheduledInstallment = { numero: number; valor: number; vencimento: string };
export function validateInitialClassifications(participants: InitialMapParticipant[]) {
  for (const p of participants) {
    if (!["caixa","nao_caixa"].includes(String(p.naturezaCapital))) throw new Error("Informe a natureza do capital na estruturação.");
    const missingContribution = Number(p.modeloCalculo) >= 4
      ? p.contribuicoes?.some(c => c.indice > 0 && !c.tipoCpp?.id)
      : p.cppOrigem > 0 && !p.tipoCppContribuicao?.id;
    const missingCapital = (p.modeloCalculo===5 ? Number(p.capitalComprometido) : p.cppCapital)>0 && !p.tipoCppCapital?.id;
    if (p.modeloCalculo===5 && missingCapital) throw new Error(`Selecione a Natureza do aporte de ${p.nome} no bloco 5, em Funções e natureza, para gerar o MAP Inicial.`);
    if (p.modeloCalculo===5 && missingContribution) throw new Error(`A classificação automática dos direitos econômicos de ${p.nome} está indisponível. Confira o cadastro de tipos de CPP para gerar o MAP Inicial.`);
    if (missingCapital || missingContribution) throw new Error("Selecione os tipos de CPP e salve o MAP Zero antes do aceite.");
  }
}
export const isCashEntry = (entry: { natureza?: string; conciliacao_pendente?: boolean }) => entry.natureza !== "nao_caixa" && !entry.conciliacao_pendente;
export const isAdditionalContribution = (entry: { finalidade?: string; natureza?: string }) =>
  entry.finalidade !== "integralizacao_inicial" && isCashEntry(entry);

const cents = (value: number) => Math.round(value * 100);
export function copyParticipantSchedule(value: number, capital: number, series: ScheduleSeries[]): ScheduleSeries[] {
  if (!(capital > 0) || !series.length) return [];
  const copied = series.map(s => ({...s,total:cents(s.total / capital * value) / 100}));
  const expected = cents(series.reduce((sum,s)=>sum+s.total,0) / capital * value);
  copied[copied.length-1].total = (cents(copied[copied.length-1].total) + expected - copied.reduce((sum,s)=>sum+cents(s.total),0)) / 100;
  return copied;
}
export function buildNominalSchedule(total: number, series: ScheduleSeries[]): ScheduledInstallment[] {
  if (!Number.isSafeInteger(cents(total)) || total <= 0 || !Array.isArray(series) || !series.length || series.length > 360) throw new Error("Preencha o cronograma nominal.");
  const result: ScheduledInstallment[] = [];
  let sum = 0;
  for (const s of series) {
    if (!Number.isSafeInteger(cents(s.total)) || s.total <= 0 || !Number.isInteger(s.quantidade) || s.quantidade < 1 || s.quantidade > 360 || ![0,1,2,3,6,12].includes(s.meses) || (s.meses === 0 && s.quantidade !== 1)) throw new Error("Série inválida: informe valor, quantidade e periodicidade.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.primeiroVencimento)) throw new Error("Informe o primeiro vencimento de cada série.");
    const date = new Date(`${s.primeiroVencimento}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== s.primeiroVencimento) throw new Error("Vencimento inválido.");
    const base = Math.round(cents(s.total) / s.quantidade);
    for (let n = 0; n < s.quantidade; n++) {
      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n * s.meses, 1, 12));
      const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
      start.setUTCDate(Math.min(date.getUTCDate(), last));
      const amount = n === s.quantidade - 1 ? cents(s.total) - base * n : base;
      if (amount <= 0) throw new Error("O valor não comporta a quantidade de parcelas.");
      result.push({ numero: result.length + 1, valor: amount / 100, vencimento: start.toISOString().slice(0,10) });
    }
    sum += cents(s.total);
  }
  if (result.length > 720 || sum !== cents(total)) throw new Error("A soma das séries deve fechar o compromisso, com no máximo 720 parcelas.");
  return result;
}

export function commitmentsFromMap(valorOrigem: number, participants: InitialMapParticipant[]): InitialCommitment[] {
  const rows: InitialCommitment[] = [{ chave: "ativo", participanteId: null, componente: "ativo", nome: "Pagamento do ativo", valor: valorOrigem, natureza: "caixa", beneficiario: "", series: [] }];
  for (const p of participants) {
    const capital = p.modeloCalculo === 5 ? Number(p.capitalComprometido) : p.cppCapital;
    if (capital > 0) rows.push({ chave: `${p.participantId}:capital`, participanteId: p.participantId, componente: "capital", nome: p.nome, valor: capital, natureza: p.naturezaCapital || "caixa", tipoCpp: p.tipoCppCapital, beneficiario: p.memberId || "", series: [] });
    if (Number(p.modeloCalculo) >= 4) {
      for (const c of p.contribuicoes || []) if (Number(c.valor) > 0) rows.push({ chave: `${p.participantId}:contribuicao:${c.cargo}`, participanteId:p.participantId, componente:"contribuicao", nome:`${p.nome} — ${c.cargo}`, valor:Number(c.valor), natureza:"nao_caixa", tipoCpp:c.tipoCpp, beneficiario:p.memberId || "", series:[] });
    } else if (p.cppOrigem > 0) rows.push({ chave: `${p.participantId}:contribuicao`, participanteId: p.participantId, componente: "contribuicao", nome: p.nome, valor: p.cppOrigem, natureza: "nao_caixa", tipoCpp: p.tipoCppContribuicao, beneficiario: p.memberId || "", series: [] });
  }
  return rows;
}

export function validateCommitments(expected: InitialCommitment[], input: InitialCommitment[]) {
  if (!Array.isArray(input) || input.length !== expected.length || new Set(input.map(p => p.chave)).size !== expected.length) throw new Error("Os compromissos devem corresponder à revisão vigente do MAP Zero.");
  return expected.map(e => {
    const item = input.find(p => p.chave === e.chave);
    if (!item || !String(item.beneficiario || "").trim() || !Array.isArray(item.series)) throw new Error("Informe o beneficiário e as séries de cada compromisso.");
    if (e.componente !== "ativo" && e.beneficiario && item.beneficiario !== e.beneficiario) throw new Error("O beneficiário deve ser o participante do MAP Zero.");
    const parcelas = buildNominalSchedule(e.valor, item.series);
    return { ...e, beneficiario: String(item.beneficiario).trim(), series: item.series, parcelas };
  });
}
