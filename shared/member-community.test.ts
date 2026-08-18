import assert from "node:assert/strict";
import test from "node:test";
import { orderedAdesaoCommunityIds, selectMemberCommunityOrigin } from "./member-community";

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
