import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { matchesMouRevision } from "../shared/agenda-action";

// Execute the registered route with isolated collaborators, without real signatures or DB writes.
const source = fs.readFileSync("server/routes.ts", "utf8");
const route = source.slice(source.indexOf('  app.post("/api/bias/:id/mou/aceitar"'), source.indexOf('  app.get("/api/bia-mou/padrao"'));
async function request(body: any, options: { member?: string; authenticated?: boolean; accepted?: boolean; missingEvidence?: boolean; employee?: boolean } = {}) {
  let handler: any, previewCalls = 0, accepts = 0, activations = 0, locked = false;
  const deps = {
    app: { post(_path: string, fn: any) { handler = fn; } },
    resolveBiaByIdOrPublicCode: async () => ({ id: "bia" }),
    withMapLock: async (_id: string, work: () => Promise<any>) => { locked = true; try { return await work(); } finally { locked = false; } },
    loadInitialMapSnapshot: async () => ({ revisao: 3, participantes: [{ memberId: "member" }] }),
    biaFormalParticipantIds: () => [], matchesMouRevision,
    ensureMouAceitoOuRetornaPendencia: async (_bia: string, _member: string, accept: boolean) => {
      assert.equal(locked, true);
      if (options.accepted) return { ok: true };
      if (!accept) { previewCalls++; return { ok: false, response: { mou: { map_revisao: 3, texto: "Documento" } } }; }
      if (options.missingEvidence) return { ok: false, statusCode: 400, response: { error: "Localização obrigatória" } };
      accepts++; return { ok: true };
    },
    activatePropertyOriginIfReady: async () => { activations++; },
  };
  new Function(...Object.keys(deps), ts.transpileModule(route, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
  const res = { code: 200, body: null as any, status(code: number) { this.code = code; return this; }, json(value: any) { this.body = value; return this; } };
  await handler({ session: { directusUserId: options.authenticated === false ? null : "user", membroId: options.member || "member", companyEmployeeId: options.employee ? "employee" : null }, params: { id: "bia" }, body }, res);
  return { ...res, previewCalls, accepts, activations };
}
test("abrir MOU não aceita nem ativa, mesmo se já resolvido", async () => {
  const pending = await request({ map_revisao: 3 });
  assert.equal(pending.code, 200); assert.equal(pending.body.mou.map_revisao, 3);
  assert.equal(pending.previewCalls, 1); assert.equal(pending.accepts, 0); assert.equal(pending.activations, 0);
  const resolved = await request({ map_revisao: 3 }, { accepted: true });
  assert.deepEqual(resolved.body, { resolved: true }); assert.equal(resolved.activations, 0);
});
test("revisão substituída impede abertura e aceite antes de qualquer operação", async () => {
  for (const aceitar_mou of [false, true]) {
    const result = await request({ map_revisao: 2, aceitar_mou });
    assert.equal(result.code, 409); assert.equal(result.previewCalls + result.accepts + result.activations, 0);
  }
});
test("link não concede permissão e confirmação conserva validação de evidência", async () => {
  assert.equal((await request({ map_revisao: 3 }, { authenticated: false })).code, 401);
  assert.equal((await request({ map_revisao: 3 }, { member: "foreign" })).code, 403);
  assert.equal((await request({ map_revisao: 3 }, { employee: true })).code, 403);
  const invalid = await request({ map_revisao: 3, aceitar_mou: true }, { missingEvidence: true });
  assert.equal(invalid.code, 400); assert.equal(invalid.activations, 0);
  const valid = await request({ map_revisao: 3, aceitar_mou: true });
  assert.equal(valid.accepts, 1); assert.equal(valid.activations, 1);
});
