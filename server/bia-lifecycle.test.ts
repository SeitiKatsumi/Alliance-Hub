import assert from "node:assert/strict";
import test from "node:test";
import {
  biaActivationRequirements,
  biaFormalParticipantIds,
  canCreateObaForBia,
  isBiaDirector,
} from "./bia-lifecycle";

const bia = {
  situacao: "em_formacao",
  aliado_built: { id: "ally-1" },
  diretor_alianca: "director-1",
  diretor_nucleo_tecnico: { id: "director-2" },
  socios_guardioes: [{ cadastro_geral_id: { id: "partner-1" } }],
};

test("normaliza os participantes formais sem duplicação", () => {
  assert.deepEqual(biaFormalParticipantIds(bia), ["director-1", "director-2", "partner-1"]);
  assert.equal(isBiaDirector(bia, "director-2"), true);
  assert.equal(isBiaDirector(bia, "partner-1"), false);
});

test("bloqueia a ativação enquanto houver convite ou MOU pendente", () => {
  const result = biaActivationRequirements({
    bia,
    pendingPartnerInvites: 1,
    acceptedMouMemberIds: ["director-1"],
  });
  assert.equal(result.canActivate, false);
  assert.deepEqual(result.missingMou, ["director-2", "partner-1"]);
  assert.ok(result.missing.some((item) => item.includes("convite(s) de sócio")));
});

test("libera a ativação somente após todos os aceites", () => {
  const result = biaActivationRequirements({
    bia,
    acceptedMouMemberIds: ["director-1", "director-2", "partner-1"],
  });
  assert.deepEqual(result, { canActivate: true, missing: [], missingMou: [] });
});

test("OBAs exigem BIA ativa e um diretor", () => {
  assert.equal(canCreateObaForBia(bia, "director-1"), false);
  assert.equal(canCreateObaForBia({ ...bia, situacao: "ativa" }, "partner-1"), false);
  assert.equal(canCreateObaForBia({ ...bia, situacao: "ativa" }, "director-1"), true);
});
