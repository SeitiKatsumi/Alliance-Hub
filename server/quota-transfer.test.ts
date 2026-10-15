import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canProcessQuotaTransfer } from "../shared/quota-correction";
import { acceptQuotaTransfer } from "./quota-transfer";

test("aceitar transferencia altera somente o status da transferencia", async () => {
  const calls: Array<{ id: string; patch: unknown }> = [];
  const result = await acceptQuotaTransfer("transfer-1", async (id, patch) => {
    calls.push({ id, patch });
    return { id, ...patch };
  });

  assert.deepEqual(calls, [{ id: "transfer-1", patch: { status: "aceita" } }]);
  assert.deepEqual(result, { id: "transfer-1", status: "aceita" });
});

test("diretor, aliado ou administrador processa inclusive a própria transferência", () => {
  assert.equal(canProcessQuotaTransfer("user", "rodrigo", "rodrigo", null), true);
  assert.equal(canProcessQuotaTransfer("user", "rodrigo", null, { id: "rodrigo" }), true);
  assert.equal(canProcessQuotaTransfer("admin", "rodrigo", null, null), true);
  assert.equal(canProcessQuotaTransfer("user", "rodrigo", "outra-pessoa", null), false);

  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const endpoint = routes.slice(routes.indexOf('app.patch("/api/transferencia-cotas/:id"'), routes.indexOf("// ========== COMUNIDADES", routes.indexOf('app.patch("/api/transferencia-cotas/:id"')));
  assert.match(endpoint, /canProcessQuotaTransfer\(sessionRole, sessionMembroId, biaDiretorAlianca, biaAliadoBuilt\)/);
  assert.doesNotMatch(endpoint, /membro de origem nÃ£o pode aceitar/);
});

test("rota de aceite permite gestor de origem, mantém autorização e não altera valores", async () => {
  const source = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  let callback = "";
  function find(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.patch" &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/transferencia-cotas/:id") callback = node.arguments[1].getText(source);
    ts.forEachChild(node, find);
  }
  find(source);
  assert.ok(callback);
  for (const scenario of [
    { role: "user", director: "origem", ally: null, expected: 200 },
    { role: "user", director: null, ally: { id: "origem" }, expected: 200 },
    { role: "admin", director: null, ally: null, expected: 200 },
    { role: "superadmin", director: null, ally: null, expected: 200 },
    { role: "user", director: "outro", ally: null, expected: 403 },
    { role: "user", director: "origem", ally: null, moduleAccess: false, expected: 403 },
    { role: "admin", director: null, ally: null, authenticated: false, expected: 401 },
  ]) {
    let transfer = { id: "transfer-teste", bia_id: "bia-teste", membro_origem_id: "origem", membro_destino_id: "destino", status: "pendente", valor_total: "443.98938", percentual_transferencia: "1.11005" };
    const before = { ...transfer };
    const patches: unknown[] = [];
    let mapWrites = 0;
    const handler = runInNewContext(ts.transpileModule(`(${callback})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      storage: {
        getTransferenciaCotas: async () => transfer,
        updateTransferenciaCotas: async (_id: string, patch: any) => { patches.push(patch); transfer = { ...transfer, ...patch }; return transfer; },
      },
      requireBiaModuleAccess: async (_req: any, res: any, bia: string, module: string, level: string) => {
        assert.equal(bia, "bia-teste"); assert.equal(module, "capital_financeiro"); assert.equal(level, "edit");
        if (scenario.moduleAccess === false) { res.status(403).json({ error: "Sem acesso" }); return false; }
        return true;
      },
      directusFetchOne: async () => ({ diretor_alianca: scenario.director, aliado_built: scenario.ally }),
      canProcessQuotaTransfer, acceptQuotaTransfer,
      writeMapTransfer: async (_bia: string, _key: string, _reason: string, write: any) => {
        mapWrites++;
        return write({ execute: async () => ({ rows: [{ status: transfer.status }] }) });
      },
      sql: () => undefined,
    });
    const req = { session: { membroId: "origem", directusUserId: scenario.authenticated === false ? null : "usuario", role: scenario.role }, params: { id: transfer.id }, body: { action: "aceitar" } };
    const res = { code: 200, status(code: number) { this.code = code; return this; }, json(_value: unknown) { return this; } };
    await handler(req, res);
    assert.equal(res.code, scenario.expected);
    assert.deepEqual(transfer, { ...before, status: scenario.expected === 200 ? "aceita" : "pendente" });
    assert.equal(JSON.stringify(patches), scenario.expected === 200 ? '[{"status":"aceita"}]' : "[]");
    assert.equal(mapWrites, scenario.expected === 200 ? 1 : 0);
    if (scenario.expected === 200) {
      await handler(req, res);
      assert.equal(mapWrites, 1, "repetir aceite não reaplica transferência");
    }
  }
});
