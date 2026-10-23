export type AgendaCalendarDisplay = "mes" | "semana";
export type AgendaViewMode = "calendario" | "lista";

export const DEFAULT_AGENDA_VIEW_MODE: AgendaViewMode = "calendario";
export const AGENDA_VIEW_ORDER: readonly AgendaViewMode[] = ["calendario", "lista"];
export const AGENDA_HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

export function toAgendaDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfAgendaWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function buildAgendaWeek(date: Date) {
  const start = startOfAgendaWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: day, key: toAgendaDateKey(day) };
  });
}

export function formatAgendaWeekTitle(date: Date) {
  const days = buildAgendaWeek(date);
  const first = days[0].date;
  const last = days[6].date;
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const sameYear = first.getFullYear() === last.getFullYear();
  const firstLabel = sameMonth
    ? String(first.getDate())
    : first.toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const lastLabel = last.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return `${firstLabel} – ${lastLabel}`;
}

export function agendaHourFromTime(value?: string | null) {
  const match = String(value || "").match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 23 ? hour : null;
}
