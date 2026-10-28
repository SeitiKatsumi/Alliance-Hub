import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { EXPENSE_CONTRIBUTIONS_SQL, protectExpenseEntry, registerExpenseContributions } from './expense-contributions';
import { linkedExpenseMovementIds } from './existing-expense-contributions';

test('existing expense HTTP: previews, stale data, authorization, one source, durable retries and links', async () => {
  const pg = new PGlite(), db = drizzle(pg);
  await pg.exec(EXPENSE_CONTRIBUTIONS_SQL);
  await pg.exec('CREATE TABLE fluxo_caixa_historico (fluxo_caixa_id text,bia_id text,acao text,ator_user_id text,origem text,dados_depois jsonb,payload jsonb)');
  const entries = new Map<string, any>(), maps = [{ memberId: 'a', percent: 60 }, { memberId: 'b', percent: 40 }];
  let mode = 'ok', calls = 0, allowed = true, tail = Promise.resolve();
  const source = (overrides = {}) => { const row = { id: randomUUID(), bia: 'bia', tipo: 'saida', valor: '100.00', descricao: 'Valor de Origem da BIA - Parcela 1/1',
    data: '2026-10-28', data_vencimento: '2026-11-10', data_pagamento: null, status: 'agendado', Categoria: [{ categorias_id: 2 }], tipo_de_cpp: [{ tipos_cpp_id: 3 }], Anexos: [], ...overrides }; entries.set(row.id, row); return row; };
  const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.session = req.headers['x-session'] === 'no' ? {} : { directusUserId: 'actor' }; next(); });
  registerExpenseContributions(app, { db, access: async (req, res, bia) => { if (!allowed || bia !== 'bia' || req.headers['x-access'] === 'no') { res.status(403).json({ error: 'Negado' }); return null; } return { bia: { id: 'bia' } }; },
    phase: async () => {}, members: () => ['a', 'b'], map: async () => maps,
    one: async (collection, id) => collection === 'fluxo_caixa' ? structuredClone(entries.get(id) || null) : ['a', 'b'].includes(id) ? { id, nome: 'Fixture ' + id } : null,
    lock: async (_id, work) => { const before = tail; let release!: () => void; tail = new Promise<void>(r => release = r); await before; try { return await work(); } finally { release(); } },
    createBatch: async rows => { calls++; if (mode === 'fail') throw new Error('Before commit'); for (const row of rows) { assert.equal(row.tipo, 'entrada'); assert.ok(!entries.has(row.id)); entries.set(row.id, structuredClone(row)); } if (mode === 'lost') { mode = 'ok'; throw new Error('Response lost'); } },
  });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  async function call(path: string, body?: any, headers = {}) { const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const path = (id: string) => `/api/fluxo-caixa/${id}/aportes`;
  async function preview(id: string, splitMode = 'manual', unit = 'valor') {
    const ctx = await call(path(id)); assert.equal(ctx.status, 200, JSON.stringify(ctx.body));
    const input = { mode: splitMode, unit, sourceVersion: ctx.body.sourceVersion, mapVersion: splitMode === 'map' ? ctx.body.mapVersion : null,
      participants: [{ memberId: 'a', value: 60 }, { memberId: 'b', value: 40 }], dueDate: '2026-11-12' };
    const p = await call(path(id) + '/previa', input); assert.equal(p.status, 200, JSON.stringify(p.body));
    return { ...input, requestId: randomUUID(), expected: p.body.expected };
  }
  try {
    const original = source(), before = structuredClone(original);
    assert.equal((await call(path(original.id), undefined, { 'x-session': 'no' })).status, 401);
    assert.equal((await call(path(original.id), undefined, { 'x-access': 'no' })).status, 403);
    const input = await preview(original.id);
    assert.equal(calls, 0, 'Preview is read-only'); assert.equal(entries.size, 1);
    allowed = false; assert.equal((await call(path(original.id), input)).status, 403); allowed = true;
    original.valor = '101.00'; assert.equal((await call(path(original.id), input)).status, 409); original.valor = '100.00';
    mode = 'lost'; assert.equal((await call(path(original.id), input)).status, 503);
    assert.equal(entries.size, 3); assert.deepEqual(entries.get(original.id), before);
    assert.equal((await call(path(original.id))).body.resumeRequest.requestId, input.requestId);
    await assert.rejects(() => protectExpenseEntry(db, original.id, { status: 'pago' }));
    const retried = await Promise.all([call(path(original.id), input), call(path(original.id), input)]);
    assert.ok(retried.every(r => r.status === 200)); assert.equal(calls, 1);
    const movements = retried[0].body.movimentos;
    const incoming = movements.filter((m: any) => m.tipo === 'entrada');
    assert.deepEqual(incoming.map((m: any) => Number(m.valor)), [60, 40]);
    assert.ok(incoming.every((m: any) => m.status === 'agendado' && m.data_pagamento === null && m.data_vencimento === '2026-11-12' && m.tipo_de_cpp[0].tipos_cpp_id === '3'));
    assert.ok(incoming.every((m: any) => !('despesa_origem_id' in entries.get(m.id))));
    assert.equal((await call(path(original.id), { ...input, requestId: randomUUID() })).status, 409);
    assert.equal((await call(path(original.id), { ...input, dueDate: '2026-12-01' })).status, 409);
    const history = (await db.execute(sql`SELECT * FROM fluxo_caixa_historico`)).rows;
    assert.equal(history.length, 3); assert.equal(history.filter(h => h.acao === 'criado').length, 2);
    for (const m of movements) {
      const links = await call(`/api/fluxo-caixa/${m.id}/vinculos`); assert.equal(links.body.despesaId, original.id); assert.equal(links.body.movimentos.length, 3);
      assert.equal(links.body.movimentos.find((row: any) => row.id === incoming[0].id).participante, 'Fixture a', 'Use the member name when the username is absent');
      await assert.rejects(() => protectExpenseEntry(db, m.id, null)); await assert.rejects(() => protectExpenseEntry(db, m.id, { valor: 900 }));
    }
    assert.deepEqual(await linkedExpenseMovementIds(db, 'bia'), new Set(movements.map((m: any) => m.id)));
    await protectExpenseEntry(db, original.id, { status: 'pago', data_pagamento: '2026-11-12' });
    assert.equal((await call(path(original.id))).body.state, 'concluido');
    const next = source({ tipo_de_cpp: [] }), mapInput = await preview(next.id, 'map');
    maps[0].percent = 50; maps[1].percent = 50;
    assert.equal((await call(path(next.id), mapInput)).status, 409);
    const fresh = await preview(next.id, 'map'); mode = 'fail'; assert.equal((await call(path(next.id), fresh)).status, 503);
    maps[0].percent = 60; maps[1].percent = 40; mode = 'ok';
    const recovered = await call(path(next.id), fresh); assert.equal(recovered.status, 200);
    assert.deepEqual(recovered.body.movimentos.filter((m: any) => m.tipo === 'entrada').map((m: any) => [Number(m.valor), m.tipo_de_cpp.length]), [[50, 0], [50, 0]], 'Durable intent keeps approved distribution and empty CPP');
    const percent = source(); assert.equal((await call(path(percent.id), await preview(percent.id, 'manual', 'percentual'))).status, 200);
    for (const status of ['pago', 'parcial', 'cancelado']) {
      const bad = source({ status }); const ctx = await call(path(bad.id)); assert.ok(ctx.body.problem);
      assert.equal((await call(path(bad.id) + '/previa', { ...input, sourceVersion: ctx.body.sourceVersion })).status, 400, 'Unknown confirmation keys are refused in preview');
      const { requestId, expected, ...raw } = input;
      assert.equal((await call(path(bad.id) + '/previa', { ...raw, sourceVersion: ctx.body.sourceVersion })).status, 422);
    }
    const invalid = source(), raw = await preview(invalid.id);
    for (const participants of [[{ memberId: 'outsider', value: 100 }], [{ memberId: 'a', value: 50 }, { memberId: 'a', value: 50 }], [{ memberId: 'a', value: 90 }]])
      assert.equal((await call(path(invalid.id), { ...raw, requestId: randomUUID(), participants })).status, 400);
    assert.equal((await db.execute(sql`SELECT * FROM bia_despesa_aportes WHERE despesa_existente_id=${original.id}`)).rows.length, 1);
    const race = source(); const firstTab = await preview(race.id), secondTab = { ...firstTab, requestId: randomUUID() };
    const countBefore = entries.size, callsBefore = calls;
    const competing = await Promise.all([call(path(race.id), firstTab), call(path(race.id), secondTab)]);
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
    assert.equal(entries.size, countBefore + 2); assert.equal(calls, callsBefore + 1);
    const stale = source(), staleInput = await preview(stale.id);
    stale.tipo_de_cpp = [{ tipos_cpp_id: 9 }];
    assert.equal((await call(path(stale.id), staleInput)).status, 409, 'Changing CPP also invalidates the preview');
    const dueStale = await preview(stale.id); stale.data_vencimento = '2026-12-03';
    assert.equal((await call(path(stale.id), dueStale)).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await pg.close(); }
});
