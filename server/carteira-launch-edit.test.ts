import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { diagnosticarCarteira } from "../shared/carteira";

test("PATCH real atualiza uma linha, preserva origem/anexos e audita antes/depois; nega acesso e imóvel forjado", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('  app.patch("/api/carteira/lancamentos/:id"'), source.indexOf('  app.delete("/api/carteira/lancamentos/:id"'));
  const sanitizer = source.slice(source.indexOf("  function sanitizeInventarioLancamento("), source.indexOf('  app.get("/api/inventario/imoveis"'));
  const pg = new PGlite();
  try {
    await pg.exec("CREATE TABLE inventario_lancamentos (id text PRIMARY KEY, imovel_id text, data jsonb, updated_at timestamptz)");
    const before = { id: "entry", imovel_id: "property", tipo: "despesa", valor: 450, descricao: "Limpeza", data: "2026-10-23", status: "pago", origem: "ia_arquivo", anexos: ["file-1"], observacao: "Recibo", createdAt: "2026-10-01" };
    await pg.query("INSERT INTO inventario_lancamentos VALUES ('entry', 'property', $1::jsonb, now())", [JSON.stringify(before)]);
    let handler: any; let allowed = true;
    const events: any[] = [];
    const code = transformSync(sanitizer + route, { loader: "ts", target: "es2022" }).code;
    new Function("app", "db", "sql", "requireCarteiraActor", "normalizeInventarioRow", "requireCarteiraAccess", "carteiraOwnerActor", "recordCarteiraEvent", code)(
      { patch: (_: string, fn: any) => { handler = fn; } }, drizzle(pg), sql,
      () => ({ userId: "owner", membroId: "member" }), (row: any) => row.data,
      async (id: string, _: any, level: string) => {
        assert.equal(id, "property"); assert.equal(level, "colaboracao");
        if (!allowed) throw Object.assign(new Error("Sem permissão"), { status: 403 });
        return { imovel: { owner_user_id: "owner" } };
      }, () => ({ userId: "owner", membroId: "member" }), async (...event: any[]) => events.push(event),
    );
    const invoke = async (id: string, body: any) => {
      let status = 200; let result: any;
      const res = { status: (value: number) => { status = value; return res; }, json: (value: any) => { result = value; } };
      await handler({ params: { id }, body }, res);
      return { status, result };
    };
    allowed = false;
    assert.equal((await invoke("entry", { valor: 900 })).status, 403);
    assert.equal(events.length, 0);
    allowed = true;
    assert.equal((await invoke("missing", {})).status, 404);
    const saved = await invoke("entry", { valor: 500, descricao: "Limpeza corrigida", imovel_id: "someone-else", owner_user_id: "someone-else" });
    assert.equal(saved.status, 200);
    assert.equal(saved.result.imovel_id, "property");
    assert.equal(saved.result.owner_user_id, "owner");
    assert.equal(saved.result.origem, "ia_arquivo");
    assert.deepEqual(saved.result.anexos, ["file-1"]);
    assert.equal(saved.result.createdAt, before.createdAt);
    const rows = (await pg.query<any>("SELECT data FROM inventario_lancamentos")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].data.valor, 500);
    assert.equal(events[0][2], "lancamento_atualizado");
    assert.equal(events[0][4].antes.valor, 450); assert.equal(events[0][4].depois.valor, 500);
    const context = { imovel: { ocupacao: "vazio", area_m2: 100, valor_atual: 400000 }, documentos: [], now: new Date("2026-10-23") };
    assert.equal(diagnosticarCarteira({ ...context, lancamentos: rows.map((r: any) => r.data) }).indicadores.resultado_liquido, -500);
  } finally { await pg.close(); }
});
