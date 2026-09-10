import test from "node:test";
import assert from "node:assert/strict";
import { deleteFluxoBatch, fluxoDeleteError } from "./fluxo-delete";

test("aguarda sucesso tardio mesmo quando outro lançamento está protegido", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const result = deleteFluxoBatch(["blocked", "ok"], async (id) => {
    if (id === "blocked") throw new Error('409: {"error":"Lançamento protegido"}');
    await pending;
  });
  finish();
  assert.deepEqual(await result, {
    deleted: ["ok"],
    failed: [{ id: "blocked", message: "Lançamento protegido" }],
  });
});

test("preserva falhas de rede e não repete IDs", async () => {
  const calls: string[] = [];
  const result = await deleteFluxoBatch(["a", "a", "b"], async (id) => {
    calls.push(id);
    if (id === "b") throw new Error("Failed to fetch");
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.deepEqual(result.deleted, ["a"]);
  assert.deepEqual(result.failed, [{ id: "b", message: "Failed to fetch" }]);
  assert.equal(fluxoDeleteError(new Error("502: Bad Gateway")), "502: Bad Gateway");
});
