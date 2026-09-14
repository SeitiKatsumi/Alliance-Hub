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

test("segunda confirmação seleciona somente conflitos explícitos, preservando outras falhas", async () => {
  const result = await deleteFluxoBatch(["protected", "forbidden", "ok"], async id => {
    if (id === "protected") throw new Error('409: {"code":"FLUXO_DELETE_CONFIRMATION_REQUIRED","error":"Confirme a exclusão"}');
    if (id === "forbidden") throw new Error('403: {"error":"Sem permissão"}');
  });
  assert.deepEqual(result.deleted, ["ok"]);
  assert.deepEqual(result.failed.filter(item => item.confirmationRequired).map(item => item.id), ["protected"]);
});
