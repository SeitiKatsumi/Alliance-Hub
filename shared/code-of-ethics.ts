// Texto aprovado: BUILT JUR - 1. Código de Ética BUILT.docx (recebido em 21/09/2026).
export const CODIGO_ETICA_BUILT_VERSAO = "BUILT JUR - 1 — 2026-09-21";
export const CODIGO_ETICA_BUILT = `CÓDIGO DE ÉTICA BUILT

01 Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.

02 Eu agirei com transparência, lealdade e respeito em todas as relações.

03 Eu protegerei a confiança construída e a reputação coletiva.

04 Eu assumirei responsabilidade integral por minhas ações, decisões, compromissos e conduta.

05 Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.

06 Eu honrarei os esforços, a confiança e a dignidade dos meus aliados acima do ganho individual de curto prazo.`;

// Conteúdo anterior preservado para comprovantes já aceitos; não substituir pelo texto vigente.
const CODIGO_ETICA_LEGADO = `CÓDIGO DE ÉTICA BUILT

Eu cumprirei minhas entregas, acordos e responsabilidades com excelência, ética e compromisso.

Eu agirei com transparência, lealdade e respeito em todas as relações.

Eu protegerei a confiança construída e a reputação coletiva.

Eu assumirei responsabilidade integral por minhas ações, decisões e conduta.

Eu demonstrarei postura construtiva, colaborativa e comprometida com a continuidade das alianças.

Eu honrarei os esforços e a dignidade dos meus aliados acima do lucro.`;

export function codigoEticaPorVersao(versao: string | null | undefined): string | undefined {
  if (versao === CODIGO_ETICA_BUILT_VERSAO) return CODIGO_ETICA_BUILT;
  if (versao === "BUILT JUR - 1") return CODIGO_ETICA_LEGADO;
  return undefined;
}
