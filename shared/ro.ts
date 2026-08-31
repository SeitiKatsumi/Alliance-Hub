export const RO_EVENT_TYPE = "RO";
export const RO_GUEST_TERMS_VERSION = "BUILT-RO-GUEST-1";

export type RoLocationType = "online" | "presencial" | "hibrida";
export type RoGuestPolicy = "members_only" | "external_by_invitation";

export function normalizeRoLocationType(value: unknown): RoLocationType {
  const normalized = String(value || "online").trim().toLowerCase();
  if (normalized === "online" || normalized === "presencial" || normalized === "hibrida") return normalized;
  throw new Error("Formato da RO inválido.");
}

export function normalizeRoGuestPolicy(value: unknown): RoGuestPolicy {
  const normalized = String(value || "members_only").trim().toLowerCase();
  if (normalized === "members_only" || normalized === "external_by_invitation") return normalized;
  throw new Error("Política de convidados da RO inválida.");
}

export function normalizeRoTimeZone(value: unknown): string {
  const normalized = String(value || "America/Sao_Paulo").trim();
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: normalized }).format();
    return normalized;
  } catch {
    throw new Error("Fuso horário da RO inválido.");
  }
}

export function normalizeRoSchedule(input: { date: unknown; time?: unknown; endAt?: unknown }) {
  const date = String(input.date || "").trim();
  const time = String(input.time || "").trim();
  const endAt = String(input.endAt || "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error("Informe data e horário válidos para a RO.");
  }
  const startAt = `${date}T${time || "00:00"}:00`;
  if (endAt && (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(endAt) || endAt <= startAt)) {
    throw new Error("O término da RO deve ser posterior ao início.");
  }
  return { date, time: time || null, startAt, endAt };
}

export function roAlertCopy(input: { date: string; time?: string | null; cellName?: string | null; communityName?: string | null }) {
  const weekday = new Date(`${input.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  const focus = input.cellName ? `Célula ${input.cellName}` : input.communityName ? `Comunidade ${input.communityName}` : "sua Comunidade";
  return `RO da ${focus} na ${weekday}${input.time ? `, ${input.time.slice(0, 5).replace(":00", "")}h` : ""}.`;
}
