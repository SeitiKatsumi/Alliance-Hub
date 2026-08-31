import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest, cacheAuthenticatedUser, queryClient } from "./queryClient";

test("resposta 503 não é tratada como dados válidos", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Serviço indisponível" }), { status: 503 });

  try {
    await assert.rejects(apiRequest("GET", "/api/membros/teste"), /503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login libera a sessão no cliente sem aguardar uma nova consulta", () => {
  const user = { id: "user-1", role: "user" };

  cacheAuthenticatedUser(user);

  assert.deepEqual(queryClient.getQueryData(["/api/me"]), user);
  queryClient.removeQueries({ queryKey: ["/api/me"] });
});
