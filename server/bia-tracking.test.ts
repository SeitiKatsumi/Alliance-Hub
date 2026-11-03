import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { BIA_TRACKING_SQL, registerBiaTrackingRoutes, withBiaTracking, loadBiaTracking } from './bia-tracking';
import { readFileSync } from 'node:fs';

test('tracking persistence, revision conflicts, repeat after lost response, access checks and thesis preservation', async () => {
  const pg = new PGlite(), db = drizzle(pg), app = express(); app.use(express.json());
  const bia = { id: 'synthetic', objetivo_alianca: 'FLIPPING' };
  let revoked = false, checks = 0;
  registerBiaTrackingRoutes(app, { db, access: async (req, res, id, key, level) => {
    assert.equal(key, 'configuracao_bia'); assert.equal(level, 'edit'); checks++;
    if (req.headers['x-user'] !== 'editor' || revoked || !['synthetic','PUBLICCODE'].includes(id)) { res.status(403).json({ error: 'Denied' }); return null; }
    return { bia };
  } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/bias/PUBLICCODE/acompanhamento`;
  const put = (body: any, user = 'editor') => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify(body) });
  const body = { thesis: 'FLIPPING', revision: 0, changes: { FLIPPING: { stage: 'Em execução' } } };
  try {
    assert.equal((await put(body)).status, 503);
    await pg.exec(BIA_TRACKING_SQL);
    assert.equal((await put(body, 'viewer')).status, 403);
    assert.equal((await put({ ...body, changes: { FLIPPING: { stage: 'Anything' } } })).status, 400);
    checks = 0;
    const first = await put(body); assert.equal(first.status, 200); assert.equal((await first.json()).revision, 1); assert.equal(checks, 2);
    assert.equal((await (await put(body)).json()).revision, 1);
    assert.equal((await put({ ...body, changes: { FLIPPING: { stage: 'Concluída' } } })).status, 409);
    assert.equal((await put({ ...body, revision: 1, thesis: 'SHORT_STAY' })).status, 409);
    revoked = true; assert.equal((await put({ ...body, revision: 1 })).status, 403); revoked = false;
    bia.objetivo_alianca = 'SHORT_STAY';
    const rental = { thesis: 'SHORT_STAY', revision: 1, changes: { SHORT_STAY: { period: '2026-11', availableNights: 30, occupiedNights: 15, revenue: 400 } } };
    assert.equal((await put(rental)).status, 200);
    const full = (await withBiaTracking(db, [bia], true))[0].acompanhamento;
    assert.equal(full.byThesis.FLIPPING?.stage, 'Em execução'); assert.equal(full.byThesis.SHORT_STAY?.revenue, 400);
    assert.equal((await withBiaTracking(db, [bia]))[0].acompanhamento.byThesis.FLIPPING, undefined);
    bia.objetivo_alianca = 'FLIPPING';
    assert.equal((await withBiaTracking(db, [bia]))[0].acompanhamento.byThesis.FLIPPING?.stage, 'Em execução');
    assert.equal((await put({ ...body, revision: 2, changes: { FLIPPING: {} } })).status, 200);
    const restored = (await loadBiaTracking(db, ['synthetic'])).get('synthetic')!;
    assert.deepEqual(restored.byThesis.FLIPPING, {}); assert.equal(restored.byThesis.SHORT_STAY?.revenue, 400);
    const rows = await pg.query<any>('SELECT revisao,dados,autor_id FROM bia_acompanhamento_versoes ORDER BY revisao');
    assert.equal(rows.rows.length, 3); assert.equal(rows.rows[0].dados.FLIPPING.stage, 'Em execução');
  } finally { await new Promise<void>(r => server.close(() => r())); await pg.close(); }
});
test('tracking feeds list, dashboard and editor without a Directus tracking column or duplicate financial source', () => {
  const routes = readFileSync('server/routes.ts', 'utf8'), editor = readFileSync('client/src/pages/bias.tsx', 'utf8');
  assert.ok(routes.includes('withBiaTracking(db, withCodes)'));
  assert.ok(routes.includes('withBiaTracking(db, userBias)'));
  assert.ok(routes.includes('withBiaTracking(db, [item], hasBiaAccess'));
  assert.ok(editor.includes('<BiaTrackingFields'));
  assert.ok(editor.includes('return saveTracking(await apiRequest("PATCH"'));
  assert.ok(editor.includes("parseTrackingChanges(Object.fromEntries"));
  const sql = readFileSync('migrations/20261103_bia_tracking.sql', 'utf8').replace(/\s+/g, ' ').trim();
  assert.equal(sql, BIA_TRACKING_SQL.replace(/\s+/g, ' ').trim());
});
