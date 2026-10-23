import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENDA_HOURS,
  AGENDA_VIEW_ORDER,
  DEFAULT_AGENDA_VIEW_MODE,
  agendaHourFromTime,
  buildAgendaWeek,
  formatAgendaWeekTitle,
  toAgendaDateKey,
} from "./agenda-calendar";

test("calendario e a primeira visualizacao da Agenda", () => {
  assert.equal(DEFAULT_AGENDA_VIEW_MODE, "calendario");
  assert.deepEqual(AGENDA_VIEW_ORDER, ["calendario", "lista"]);
});

test("semana preserva sete dias consecutivos de domingo a sabado", () => {
  const days = buildAgendaWeek(new Date(2026, 9, 22));
  assert.deepEqual(days.map((day) => day.key), [
    "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
  ]);
  assert.equal(formatAgendaWeekTitle(new Date(2026, 9, 22)), "18 – 24 de outubro de 2026");
});

test("semana atravessa mes e ano sem perder o contexto", () => {
  assert.equal(formatAgendaWeekTitle(new Date(2026, 11, 31)), "27 de dez. de 2026 – 2 de janeiro de 2027");
});

test("grade cobre as 24 horas e agrupa horarios validos", () => {
  assert.equal(AGENDA_HOURS.length, 24);
  assert.equal(AGENDA_HOURS[0], "00:00");
  assert.equal(AGENDA_HOURS[23], "23:00");
  assert.equal(agendaHourFromTime("11:30"), 11);
  assert.equal(agendaHourFromTime("23:59:00"), 23);
  assert.equal(agendaHourFromTime("24:00"), null);
  assert.equal(agendaHourFromTime(null), null);
  assert.equal(toAgendaDateKey(new Date(2026, 9, 5)), "2026-10-05");
});
