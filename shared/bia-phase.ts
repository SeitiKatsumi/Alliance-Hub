export const BIA_PHASES = {
  em_estruturacao: "Em estruturação", em_captacao: "Em captação", em_execucao: "Em execução",
  em_operacao: "Em operação", em_distribuicao: "Em distribuição", encerrada: "Encerrada",
} as const;
export type BiaPhase = keyof typeof BIA_PHASES;
export function biaPhaseLabel(value: unknown): string {
  const phase=BIA_PHASES[value as BiaPhase];
  return phase ? `${["em_execucao","em_operacao","em_distribuicao"].includes(String(value))?"Ativa · ":""}${phase}` : (value === "em_formacao" ? "Em estruturação" : value === "ativa" ? "Ativa · fase a revisar" : "Fase a revisar");
}
export function biaAllowsFinance(value: unknown) {
  return ["ativa", "em_execucao", "em_operacao", "em_distribuicao"].includes(String(value));
}
export function nextBiaPhase(phase: BiaPhase, event: "estrutura_concluida" | "aceites_concluidos" | "imovel_associado" | "resultado_aprovado" | "encerramento", ready: boolean): BiaPhase {
  if (!ready) throw new Error("Há requisitos pendentes para mudar a fase da BIA.");
  if (event === "encerramento") return "encerrada";
  const transitions = { estrutura_concluida:["em_estruturacao","em_captacao"], aceites_concluidos:["em_captacao","em_execucao"], imovel_associado:["em_execucao","em_operacao"], resultado_aprovado:["em_operacao","em_distribuicao"] } as const;
  const [from,to] = transitions[event];
  if (phase === to) return phase;
  if (phase !== from) throw new Error("A BIA não está na fase necessária para este evento.");
  return to;
}
