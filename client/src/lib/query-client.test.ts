import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest } from "./queryClient";

test("resposta 503 não é tratada como dados válidos", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Serviço indisponível" }), { status: 503 });

  try {
    await assert.rejects(apiRequest("GET", "/api/membros/teste"), /503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
