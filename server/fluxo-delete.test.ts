import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import { transformSync } from "esbuild";
import { isProtectedValorOrigemEntry } from "./valor-origem-sync";

// Executa a rota real com persistência Directus e auditoria isoladas em memória.
test("exclusão protegida exige confirmação booleana, autorização e auditoria", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const start = source.indexOf('  app.delete("/api/fluxo-caixa/:id"');
  const route = source.slice(start, source.indexOf("  // ========== TIPOS CPP", start));
  const app = express();
  app.use(express.json());
  const original = { id: "fixture", status: "vencido", Anexos: ["arquivo-ç.pdf"], descricao: "João d'Ávila & Cia + \"A\"\nação", valor: 165.71 };
  let stored: any = structuredClone(original);
  const history: any[] = [];
  let auditUnavailable = false;
  new Function("app", "requireFluxoAccess", "isProtectedValorOrigemEntry", "registrarFluxoHistorico", "directusUpdate", "directusDelete", transformSync(route, { loader: "ts" }).code)(
    app,
    async (req: any, res: any) => {
      if (req.headers["x-test-editor"] !== "yes") { res.status(403).json({ error: "Sem permissão" }); return null; }
      if (!stored) { res.status(404).json({ error: "Não encontrado" }); return null; }
      return { snapshot: structuredClone(stored) };
    },
    isProtectedValorOrigemEntry,
    async ({ req, ...record }: any) => { if (auditUnavailable) throw new Error("Audit unavailable"); history.push({ ...record, actor: req.headers["x-test-editor"] }); },
    async (_collection: string, _id: string, patch: any) => { Object.assign(stored, patch); },
    async () => { stored = null; },
  );
  app.get("/fixture", (_req, res) => res.json(stored));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const remove = (body: any, authorized = true) => fetch(`${base}/api/fluxo-caixa/fixture`, {
    method: "DELETE", headers: { "Content-Type": "application/json", ...(authorized ? { "x-test-editor": "yes" } : {}) }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await remove({ confirmar_exclusao_protegida: true }, false)).status, 403);
    for (const value of [undefined, false, "true", 1]) {
      const response = await remove({ confirmar_exclusao_protegida: value });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "FLUXO_DELETE_CONFIRMATION_REQUIRED");
      assert.deepEqual(await (await fetch(`${base}/fixture`)).json(), original);
    }
    auditUnavailable = true;
    assert.equal((await remove({ confirmar_exclusao_protegida: true })).status, 500);
    assert.deepEqual(stored, original);
    auditUnavailable = false;
    assert.equal((await remove({ confirmar_exclusao_protegida: true })).status, 200);
    assert.equal(await (await fetch(`${base}/fixture`)).json(), null);
    assert.deepEqual(history.at(-1).antes, original);
    assert.equal(history.at(-1).payload.exclusao_protegida_confirmada, true);
    assert.equal(history.at(-1).actor, "yes");
    stored = { id: "fixture", status: "agendado" };
    assert.equal((await remove({})).status, 200);
    assert.equal(history.at(-1).payload.exclusao_protegida_confirmada, false);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
