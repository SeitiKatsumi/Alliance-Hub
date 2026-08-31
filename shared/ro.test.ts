import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoGuestPolicy, normalizeRoSchedule, roAlertCopy } from "./ro";

test("RO valida agenda, política de convidados e texto humano", () => {
  assert.deepEqual(normalizeRoSchedule({ date: "2026-08-27", time: "19:00", endAt: "2026-08-27T20:00" }), {
    date: "2026-08-27",
    time: "19:00",
    startAt: "2026-08-27T19:00:00",
    endAt: "2026-08-27T20:00",
  });
  assert.equal(normalizeRoGuestPolicy("external_by_invitation"), "external_by_invitation");
  assert.equal(roAlertCopy({ date: "2026-08-27", time: "19:00", cellName: "Valorização e Revenda" }), "RO da Célula Valorização e Revenda na quinta, 19h.");
  assert.throws(() => normalizeRoSchedule({ date: "2026-08-27", time: "19:00", endAt: "2026-08-27T18:00" }), /posterior/);
});
