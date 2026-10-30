import assert from "node:assert/strict";
import test from "node:test";
import { memberCommunityMembership, orderedAdesaoCommunityIds, selectMemberCommunityOrigin } from "./member-community";

test("participação considera todos os vínculos e a principal fora da primeira posição", () => {
  const membership = memberCommunityMembership([
    { id: 1, papel: "membro" },
    { id: { id: "2" }, papel: "aliado", is_mae: true },
    { id: "3", papel: "ambos" },
    { id: "2", papel: "membro" },
  ]);
  assert.deepEqual([...membership], [["1", { isPrimary: false }], ["2", { isPrimary: true }], ["3", { isPrimary: false }]]);
});

test("origem, convite e pendência não confirmam participação nem principal", () => {
  assert.equal(memberCommunityMembership([]).size, 0);
  assert.equal(memberCommunityMembership([
    { id: "origem", papel: "origem", is_mae: true },
    { id: "convite", papel: "convidado" },
    { id: "pendente", papel: "pendente" },
    { id: null, papel: "membro" },
    { id: "sem-papel" },
  ]).size, 0);
});

test("usa a comunidade do convite original quando o candidato ainda não está no M2M", () => {
  const origin = selectMemberCommunityOrigin([
    { comunidade_id: "4", criado_em: "2026-08-18T08:00:00.000Z", tipo: "onboarding_inicial" },
  ], []);

  assert.equal(origin?.communityId, "4");
  assert.equal(origin?.source, "convite");
});

test("preserva o convite mais antigo como origem quando há vários convites", () => {
  const origin = selectMemberCommunityOrigin([
    { comunidade_id: "recente", criado_em: "2026-08-18T10:00:00.000Z" },
    { comunidade_id: "original", criado_em: "2026-08-17T10:00:00.000Z" },
  ], [{ id: "vinculo-atual", papel: "membro" }]);

  assert.equal(origin?.communityId, "original");
});

test("considera comunidade mãe e todos os vínculos sem depender apenas do primeiro", () => {
  const ids = orderedAdesaoCommunityIds("mae", [
    { id: "regional", papel: "membro" },
    { id: "mae", papel: "membro", is_mae: true },
    { id: "nacional", papel: "ambos" },
  ]);

  assert.deepEqual(ids, ["mae", "regional", "nacional"]);
});

test("usa vínculo de membro como fallback para cadastros legados sem convite", () => {
  const origin = selectMemberCommunityOrigin([], [
    { id: "aliado", papel: "aliado" },
    { id: "membro", papel: "membro" },
  ]);

  assert.deepEqual(origin, { communityId: "membro", source: "legacy_first_link" });
});
