import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { randomUUID } from "node:crypto";
import { EXPENSE_CONTRIBUTIONS_SQL, registerExpenseContributions, protectExpenseEntry } from "./expense-contributions";
import { splitExpense } from "../shared/expense-contributions";

test("lote pago projeta MAP antes de gravar e registra evento recuperável", async () => {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const section = source.slice(source.indexOf("registerExpenseContributions(app"));
  const start = section.indexOf("createBatch: async items => {");
  const body = section.slice(start + "createBatch: ".length, section.indexOf("\n    },\n  });", start) + 6).replace(/,\s*$/, "");
  const calls: string[] = []; let projectionFails = false;
  const tx = { execute: async () => { calls.push("complete"); return { rows: [] }; } };
  const db = { execute: async () => { calls.push("intent"); return { rows: [{ id: "event" }] }; } };
  const fn = new Function("mapOperationContext", "db", "loadInitialMapSnapshot", "directusFetchOne", "getBiaAllocationMap", "directusFetchScoped", "archiveMapBase", "sql", "mapActor", "fetch", "DIRECTUS_URL", "DIRECTUS_TOKEN", "mapContentHash", "captureCurrentMap",
    transformSync(`const create = ${body};`, { loader: "ts" }).code + ";return create;")(
      { getStore: () => ({ tx }) }, db, async () => ({ revisao: 1 }), async () => ({ id: "bia" }),
      async (_bia: any, _id: any, opts: any) => { if (opts.entries) { calls.push("projection"); if (projectionFails) throw new Error("MAP inválido"); return []; } return calls.includes("remote") ? [1] : []; },
      async () => [], async () => {}, sql, () => ({ userId: "test" }),
      async () => { calls.push("remote"); return { ok: true, json: async () => ({ data: [] }) }; }, "http://fixture.invalid", "fixture", JSON.stringify,
      async () => { calls.push("snapshot"); });
  await fn([{ bia: "bia", status: "pago" }]);
  assert.deepEqual(calls, ["projection", "intent", "remote", "snapshot", "complete"]);
  calls.length = 0; projectionFails = true;
  await assert.rejects(() => fn([{ bia: "bia", status: "pago" }]));
  assert.deepEqual(calls, ["projection"]);
  calls.length = 0;
  await fn([{ bia: "bia", status: "pendente" }]);
  assert.deepEqual(calls, ["remote"]);
  assert.match(section.slice(0, start), /reconcilePendingMapEvents/);
});

test("despesa/aportes: autorização, lote atômico, resposta perdida, retomada e vínculos", async () => {
  const pg = new PGlite(), db = drizzle(pg);
  await pg.exec(EXPENSE_CONTRIBUTIONS_SQL);
  await pg.exec(`CREATE TABLE fluxo_caixa_historico (fluxo_caixa_id text,bia_id text,acao text,ator_user_id text,origem text,dados_depois jsonb,payload jsonb);`);
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { directusUserId: "user" }; next(); });
  const entries = new Map<string, any>(); let calls = 0, mode = "lost", tail = Promise.resolve();
  const map = [{ memberId: "a", percent: 60 }, { memberId: "b", percent: 40 }];
  registerExpenseContributions(app, { db,
    access: async (req, res, bia, level) => { if (bia !== "bia" || req.headers["x-access"] !== "edit" && !(level === "view" && req.headers["x-access"] === "view")) { res.status(403).json({ error: "Negado" }); return null; } return { bia: { id: bia } }; },
    phase: async () => {}, members: () => ["a", "b"], map: async () => map,
    lock: async (_id, work) => { const previous = tail; let release!: () => void; tail = new Promise<void>(r => release = r); await previous; try { return await work(); } finally { release(); } },
    one: async (collection, id) => collection === "fluxo_caixa" ? entries.get(id) || null : ["a", "b", "capital"].includes(id) ? { id } : null,
    createBatch: async items => { calls++; if (mode === "fail") throw new Error("rollback fixture"); for (const item of items) { assert.ok(!entries.has(item.id)); entries.set(item.id, structuredClone(item)); } if (mode === "lost") { mode = "ok"; throw new Error("lost response"); } },
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const input = { requestId: randomUUID(), bia: "bia", expense: { valor: 100, data: "2026-10-26", descricao: "Despesa", membro_responsavel: "a", status: "pago", data_vencimento: "2026-10-26", data_pagamento: "2026-10-26", Categoria: [], Favorecido: ["b"], anexos: [] }, mode: "equal", participants: [{ memberId: "a" }, { memberId: "b" }], dueDate: "2026-10-27", cppType: "capital", expected: [{ memberId: "a", amount: 50 }, { memberId: "b", amount: 50 }] };
  const post = async (body: any, access = "edit") => { const r = await fetch(`${base}/api/fluxo-caixa/despesa-aportes`, { method: "POST", headers: { "content-type": "application/json", "x-access": access }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  try {
    assert.equal((await post(input, "view")).status, 403); assert.equal(calls, 0);
    assert.equal((await post({ ...input, participants: [{ memberId: "stranger" }] })).status, 400);
    assert.equal((await post({ ...input, mode: "map" })).status, 409, "MAP divergiu da prévia");
    assert.equal((await post(input)).status, 503);
    assert.equal(entries.size, 3, "resposta perdida após commit remoto");
    const expense = [...entries.values()].find(e => e.tipo === "saida");
    await assert.rejects(() => protectExpenseEntry(db, expense.id, { status: "pago" }));
    const results = await Promise.all([post(input), post(input)]);
    assert.ok(results.every(r => r.status === 200)); assert.equal(calls, 1); assert.equal(entries.size, 3);
    assert.equal((await db.execute(sql`SELECT * FROM fluxo_caixa_historico`)).rows.length, 3);
    const contributions = [...entries.values()].filter(e => e.tipo === "entrada");
    assert.ok(contributions.every(e => e.status === "pago" && e.data_pagamento === "2026-10-26" && e.data_vencimento === "2026-10-27"));
    assert.equal((await post({ ...input, dueDate: "2026-11-01" })).status, 409);
    await assert.rejects(() => protectExpenseEntry(db, expense.id, null));
    await assert.rejects(() => protectExpenseEntry(db, contributions[0].id, { favorecido_id: "stranger" }));
    await protectExpenseEntry(db, contributions[0].id, { status: "pago", data_pagamento: "2026-10-27" });
    for (const entry of [expense, contributions[0]]) {
      const response = await fetch(`${base}/api/fluxo-caixa/${entry.id}/vinculos`, { headers: { "x-access": "view" } });
      const links = await response.json(); assert.equal(links.despesaId, expense.id); assert.equal(links.movimentos.length, 3);
      assert.equal((await fetch(`${base}/api/fluxo-caixa/${entry.id}/vinculos`)).status, 403);
    }
    mode = "fail";
    const retry = { ...input, requestId: randomUUID(), mode: "map", expected: splitExpense(100, "map", input.participants, map) };
    assert.equal((await post(retry)).status, 503); assert.equal(entries.size, 3);
    mode = "ok"; assert.equal((await post(retry)).status, 200); assert.equal(entries.size, 6);
    assert.deepEqual([...entries.values()].slice(4).map(e => Number(e.valor)), [60, 40]);
    const mirrored = { ...input, requestId: randomUUID(), mirrorExpenses: true, mode: "manual", participants: [{ memberId: "a", value: 30 }, { memberId: "b", value: 70 }], expected: [{ memberId: "a", amount: 30 }, { memberId: "b", amount: 70 }] };
    const created = await post(mirrored); assert.equal(created.status, 200);
    const pairs = created.body.movimentos;
    assert.equal(pairs.length, 4);
    for (const memberId of ["a", "b"]) {
      const outgoing = pairs.find((m: any) => m.tipo === "saida" && m.favorecido_id === memberId);
      const incoming = pairs.find((m: any) => m.tipo === "entrada" && m.favorecido_id === memberId);
      assert.equal(incoming.valor, outgoing.valor);
      assert.deepEqual(incoming.tipo_de_cpp, outgoing.tipo_de_cpp);
      assert.equal(incoming.despesa_origem_id, outgoing.id);
      assert.equal(incoming.status, "pago"); assert.equal(incoming.data_pagamento, "2026-10-26");
      assert.equal(outgoing.status, "pago");
      const links = await (await fetch(`${base}/api/fluxo-caixa/${incoming.id}/vinculos`, { headers: { "x-access": "view" } })).json();
      assert.equal(links.despesaId, outgoing.id); assert.equal(links.movimentos.length, 2);
      assert.equal(entries.get(incoming.id).despesa_origem_id, undefined, "metadata fica no lote, não em coluna Directus inexistente");
    }
    const beforeRetry = calls;
    assert.equal((await post(mirrored)).status, 200); assert.equal(calls, beforeRetry);
    const missingDate = await post({ ...mirrored, requestId: randomUUID(), expense: { ...input.expense, data_pagamento: null } });
    assert.equal(missingDate.status, 400); assert.equal(calls, beforeRetry);
    for (const status of ["pendente", "agendado", "vencido", "parcial"]) {
      const pending = { ...mirrored, requestId: randomUUID(), expense: { ...input.expense, status, data_pagamento: null } };
      const result = await post(pending); assert.equal(result.status, 200);
      assert.ok(result.body.movimentos.every((m: any) => m.status === status && m.data_pagamento === null));
    }
    // A previously persisted pending lot must never become paid when replayed after upgrade.
    const historical = { ...mirrored, requestId: randomUUID() };
    mode = "fail"; assert.equal((await post(historical)).status, 503);
    const saved = (await db.execute(sql`SELECT movimentos FROM bia_despesa_aportes WHERE id=${historical.requestId}`)).rows[0].movimentos as any[];
    for (const item of saved) if (item.tipo === "entrada") { item.status = "pendente"; item.data_pagamento = null; }
    await db.execute(sql`UPDATE bia_despesa_aportes SET movimentos=${JSON.stringify(saved)}::jsonb WHERE id=${historical.requestId}`);
    mode = "ok";
    const replay = await post(historical); assert.equal(replay.status, 200);
    assert.ok(replay.body.movimentos.filter((m: any) => m.tipo === "entrada").every((m: any) => m.status === "pendente" && m.data_pagamento === null));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await pg.close(); }
});
