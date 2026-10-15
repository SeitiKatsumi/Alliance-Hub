import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerBiaBankHistory } from "./bia-bank-history";
import { publicBankResponse } from "./bank-response";

test("banco preserva consulta, escopo e privacidade; operações antigas nunca executam", async t => {
  const app = express();
  let reads = 0;
  let failedStorage = false;
  registerBiaBankHistory(app, {
    authorize: async (req, res, level) => {
      const role = req.get("x-role");
      if (!role) { res.status(401).json({ error: "Não autenticado" }); return null; }
      if (req.params.biaId !== "minha" || (level === "edit" && role !== "edit")) {
        res.status(403).json({ error: "Sem acesso" }); return null;
      }
      return { id: "id-canonico", nome_bia: "BIA de teste" };
    },
    readCharges: async id => {
      assert.equal(id, "id-canonico");
      reads++;
      if (failedStorage) throw Error("database credentials must not leak");
      return [{ id: "c1", status: "paid", valor: "123.45", descricao: "Histórico", provider_payload: { senha: "private" }, pagador_documento: "private", payload: "private" }];
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
  const address = server.address() as { port: number };
  const request = (path = "", method = "GET", role = "view", bia = "minha") => fetch(`http://127.0.0.1:${address.port}/api/bias/${bia}/banco${path}`, { method, headers: role ? { "x-role": role } : {} });
  assert.equal((await request("", "GET", "")).status, 401);
  assert.equal((await request("", "GET", "view", "outra")).status, 403);
  assert.equal(reads, 0);
  const history = await (await request()).json();
  assert.equal(history.providerConfigured, false);
  assert.equal(history.charges[0].valor, "123.45");
  assert.equal(history.charges[0].status, "paid");
  assert.equal(JSON.stringify(history).includes("private"), false);
  assert.equal((await request("/onboarding", "POST", "view")).status, 403);
  for (const route of ["/onboarding", "/aceite-termos", "/documentos", "/cobrancas", "/cobrancas/c1/cancelar", "/cobrancas/c1/status"]) {
    const response = await request(route, "POST", "edit");
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, "BANK_OPERATIONS_RETIRED");
  }
  for (const route of ["/saldo", "/extrato", "/termos", "/comprovante/c1", "/documentos/inventario"]) assert.equal((await request(route)).status, 410);
  assert.equal(reads, 1, "Operações aposentadas não consultam nem alteram o histórico");
  failedStorage = true;
  const failure = await request();
  assert.equal(failure.status, 503);
  assert.equal((await failure.text()).includes("credentials"), false);
});

test("sanitização bancária permanece independente do provedor", () => {
  const input = { total: 123, raw: "private", data: [{ status: "paid", access_token: "private", provider_payload: { cpf: "private" } }] };
  assert.deepEqual(publicBankResponse(input), { total: 123, data: [{ status: "paid" }] });
  assert.equal(input.raw, "private");
});
