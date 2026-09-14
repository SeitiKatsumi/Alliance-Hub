import test from "node:test";
import assert from "node:assert/strict";
import { readPinbankResponse, validatePinbankStatus } from "./pinbank-response";

test("Pinbank rejeita HTML/JSON inválido e preserva respostas e erros da API", async () => {
  const response = (body: string, status = 200, type = "application/json") => new Response(body, { status, headers: { "content-type": type } });
  for (const res of [response("<!DOCTYPE html>", 200, "text/html"), response("<!DOCTYPE html>"), response("{"), response("null"), response('"ok"')]) {
    await assert.rejects(readPinbankResponse(res), { message: "Serviço Pinbank DEV indisponível" });
  }
  for (const status of [401, 403, 503]) {
    await assert.rejects(readPinbankResponse(response('{"error":"Mensagem da API"}', status)), { message: "Mensagem da API" });
    await assert.rejects(readPinbankResponse(response("<html>Erro</html>", status, "text/html")), { message: "Serviço Pinbank DEV indisponível" });
  }
  assert.deepEqual(await readPinbankResponse(response('{"accepted":true}', 200, "application/json; charset=utf-8")), { accepted: true });
  assert.deepEqual(await readPinbankResponse(response("[]")), []);
  const status = { environment: "dev", enabled: true, storageReady: true, newOperationsEnabled: false, credentialsPresent: true, methods: [{ id: "balance", label: "Saldo", enabled: true }], pending: [] };
  assert.equal(validatePinbankStatus(status), status);
  for (const invalid of [{}, { ...status, environment: "production" }, { ...status, methods: null }, { ...status, enabled: "true" }]) assert.throws(() => validatePinbankStatus(invalid), /Serviço Pinbank DEV indisponível/);
});
