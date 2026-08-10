export const CARTEIRA_ALERT_STATUSES = [
  "aberto",
  "em_andamento",
  "adiado",
  "delegado",
  "resolvido",
  "ignorado",
] as const;

export type CarteiraAlertStatus = (typeof CARTEIRA_ALERT_STATUSES)[number];

export type CarteiraAlertUpdate = {
  status: CarteiraAlertStatus;
  acaoRegistrada?: string;
  registrarAcao: boolean;
  ignorar: boolean;
};

export function normalizeCarteiraAlertUpdate(body: Record<string, unknown> | null | undefined): CarteiraAlertUpdate {
  const rawStatus = String(body?.status || "").trim();
  const action = String(body?.acao_registrada || "").trim().slice(0, 1000);
  const validStatus = CARTEIRA_ALERT_STATUSES.includes(rawStatus as CarteiraAlertStatus)
    ? rawStatus as CarteiraAlertStatus
    : "aberto";

  if (validStatus === "ignorado") {
    return { status: "ignorado", registrarAcao: false, ignorar: true };
  }

  if (action) {
    return {
      status: validStatus === "resolvido" ? "resolvido" : "em_andamento",
      acaoRegistrada: action,
      registrarAcao: true,
      ignorar: false,
    };
  }

  return {
    status: validStatus,
    registrarAcao: false,
    ignorar: false,
  };
}
