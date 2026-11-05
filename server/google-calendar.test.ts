import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import session from 'express-session';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { builtCalendarEvent, calendarConfig, calendarEventId, calendarOwner, CalendarError, GOOGLE_CALENDAR_SCOPE, googleAgendaEntries, openCalendarToken, sealCalendarToken, resolveCalendarAccount } from './google-calendar-domain';
import { GoogleCalendarClient } from './google-calendar-client';
import { GOOGLE_CALENDAR_SCHEMA_SQL, GoogleCalendarStore } from './google-calendar-store';
import { GoogleCalendarService } from './google-calendar-service';
import { registerGoogleCalendarRoutes } from './google-calendar-routes';

const config = calendarConfig({ NODE_ENV: 'test', PORT: '3004', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-client-secret', GOOGLE_CALENDAR_ENCRYPTION_KEY: '12'.repeat(32) });
const token = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_at: Date.now() + 3600000 };
async function fixture() {
  const pg = new PGlite(), store = new GoogleCalendarStore(drizzle(pg));
  await pg.exec(`CREATE TABLE users(id text PRIMARY KEY,ativo boolean);INSERT INTO users VALUES('one',true),('two',true);
    CREATE TABLE agenda_tarefas(id text PRIMARY KEY,user_id text,titulo text,descricao text,data date,hora text,status text);
    INSERT INTO agenda_tarefas VALUES('task','one','Reunião BUILT','Descrição privada','2032-12-31','23:30','pendente'),('other','two','Outro usuário','','2032-12-31',NULL,'pendente');`);
  const migration = readFileSync('migrations/20261105_google_calendar.sql', 'utf8');
  assert.equal(migration.trim(), GOOGLE_CALENDAR_SCHEMA_SQL.trim());
  await pg.exec(migration); await pg.exec(migration);
  await store.connect('one', sealCalendarToken(token, config.key), 'sub-one', 'one@example.invalid', 'America/Sao_Paulo');
  const remote = new Map<string, any>(), calls: any[] = []; let failAfterCreate = false;
  const client: any = {
    refresh: async (t: any) => t,
    list: async () => ({ items: [...remote.values()], partial: false }),
    calendar: async (_token: any, path: string, method = 'GET', body?: any) => {
      calls.push({ path, method, body });
      const id = path.match(/^\/events\/([^?]+)/)?.[1];
      if (method === 'GET') { if (!id || !remote.has(id)) throw new CalendarError('not_found', 404); return remote.get(id); }
      if (method === 'POST') { if (remote.has(body.id)) throw new CalendarError('exists', 409); remote.set(body.id, body); if (failAfterCreate) { failAfterCreate = false; throw new CalendarError('unavailable'); } return body; }
      if (method === 'PATCH') { remote.set(id!, { ...remote.get(id!), ...body }); return remote.get(id!); }
      if (method === 'DELETE') { remote.delete(id!); return {}; }
    },
  };
  const service = new GoogleCalendarService(store, client, config);
  service.authorize = async user => (await pg.query<any>('SELECT ativo FROM users WHERE id=$1', [user])).rows[0]?.ativo === true;
  return { pg, store, client, service, remote, calls, failNextCreate: () => { failAfterCreate = true; } };
}

test('calendar: cofre autenticado, configuração isolada, dia inteiro e virada de data', () => {
  const encrypted = sealCalendarToken(token, config.key);
  assert.ok(!JSON.stringify(encrypted).includes('fixture-refresh'));
  assert.deepEqual(openCalendarToken(encrypted, config.key), token);
  assert.throws(() => openCalendarToken(encrypted, '34'.repeat(32)), /credential/);
  assert.equal(calendarConfig({ ...process.env, BUILT_ISOLATED_STAGE: '1' }).ready, false);
  assert.equal(calendarConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' }).ready, false);
  assert.equal(calendarConfig({ NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y', GOOGLE_CALENDAR_ENCRYPTION_KEY: config.key, GOOGLE_CALENDAR_REDIRECT_URI: 'http://evil.test/auth/google/callback' }).ready, false);
  const owner = calendarOwner('one', 'sub-one');
  assert.notEqual(calendarEventId(owner, 'x'), calendarEventId(calendarOwner('two', 'sub-one'), 'x'));
  const timed = builtCalendarEvent({ id: 'x', data: '2032-12-31', hora: '23:30', titulo: 'Reunião' }, owner, 'Asia/Tokyo', config.origin);
  assert.deepEqual(timed.end, { dateTime: '2033-01-01T00:30:00', timeZone: 'Asia/Tokyo' });
  assert.equal(timed.visibility, 'private'); assert.ok(!('attendees' in timed));
  assert.deepEqual(builtCalendarEvent({ id: 'x', data: '2032-02-29' }, owner, 'Asia/Tokyo', config.origin).end, { date: '2032-03-01' });
  assert.throws(() => builtCalendarEvent({ id: 'x', data: '2031-02-29' }, owner, 'UTC', config.origin), /invalid_task/);
});

test('calendar: eventos externos usam fuso, final exclusivo, origem e links seguros', () => {
  const owner = calendarOwner('one', 'sub-one');
  const entries = googleAgendaEntries([
    { id: 'timed', summary: 'Reunião Google', start: { dateTime: '2032-12-31T23:30:00-03:00' }, end: { dateTime: '2033-01-01T00:30:00-03:00' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=test' },
    { id: 'day', start: { date: '2032-12-30' }, end: { date: '2033-01-01' }, htmlLink: 'javascript:alert(1)' },
    { id: 'own', start: { date: '2032-12-31' }, extendedProperties: { private: { builtOwner: owner } } },
    { id: 'cancelled', status: 'cancelled', start: { date: '2032-12-31' } },
  ], owner, '2032-12-30', '2033-01-03', 'America/Sao_Paulo');
  assert.equal(entries.length, 4);
  assert.equal(entries.filter(e => e.id.startsWith('google:day')).length, 2);
  assert.equal(entries.find(e => e.id === 'google:timed:2032-12-31')?.hora, '23:30');
  assert.equal(entries.find(e => e.id === 'google:timed:2033-01-01')?.hora, null);
  assert.equal(entries.find(e => e.id.startsWith('google:day'))?.google_url, '');
  assert.ok(entries.every(e => e.google_event));
});

test('calendar: sincronização privada é idempotente e recupera resposta incerta sem duplicar', async () => {
  const f = await fixture();
  try {
    f.failNextCreate();
    await assert.rejects(() => f.service.sync('one'), /unavailable/);
    assert.equal(f.remote.size, 1);
    await f.service.sync('one'); assert.equal(f.remote.size, 1);
    const writes = f.calls.filter(c => c.method !== 'GET').length;
    await f.service.sync('one'); assert.equal(f.calls.filter(c => c.method !== 'GET').length, writes);
    assert.ok(![...f.remote.values()].some(e => e.summary === 'Outro usuário'));
    await f.pg.exec("UPDATE agenda_tarefas SET titulo='Título corrigido' WHERE id='task'");
    await f.service.sync('one'); assert.equal([...f.remote.values()][0].summary, 'Título corrigido');
    const events = await f.service.events('one', '2032-12-01', '2033-01-31'); assert.equal(events.entries.length, 0, 'exportados não se duplicam na tela');
    const publicStatus = await f.service.status('one'); assert.ok(!JSON.stringify(publicStatus).includes('fixture-'));
    await f.pg.exec("UPDATE agenda_tarefas SET status='cancelada' WHERE id='task'");
    await f.service.sync('one'); assert.equal(f.remote.size, 0);
    await f.pg.exec("UPDATE agenda_tarefas SET status='pendente' WHERE id='task'");
    await f.service.sync('one'); assert.equal(f.remote.size, 1);
    await f.pg.exec("DELETE FROM agenda_tarefas WHERE id='task'"); await f.service.sync('one'); assert.equal(f.remote.size, 0);
    await f.store.acquire('one', 'lease-test'); await assert.rejects(() => f.service.disconnect('one'), /busy/);
    await f.store.release('one', 'lease-test'); await f.service.disconnect('one');
    assert.equal(await f.store.get('one'), undefined); assert.equal((await f.store.links('one')).length, 0);
  } finally { await f.pg.close(); }
});

test('calendar: falha de origem, evento alheio e conta suspensa não liberam escrita', async () => {
  const f = await fixture();
  try {
    await f.service.sync('one');
    const event = [...f.remote.values()][0]; event.extendedProperties = { private: { builtOwner: 'someone-else' } };
    await f.pg.exec("UPDATE agenda_tarefas SET titulo='Mudança' WHERE id='task'");
    const before = f.calls.filter(c => c.method !== 'GET').length;
    await assert.rejects(() => f.service.sync('one'), /ownership/);
    assert.equal(f.calls.filter(c => c.method !== 'GET').length, before);
    await f.pg.exec("UPDATE users SET ativo=false WHERE id='one'");
    await assert.rejects(() => f.service.sync('one'), /access/);
    assert.equal(f.calls.filter(c => c.method !== 'GET').length, before);
    await f.pg.exec("UPDATE users SET ativo=true WHERE id='one'; DROP TABLE agenda_tarefas");
    await assert.rejects(() => f.service.sync('one'), /unavailable/);
    assert.equal(f.remote.size, 1, 'origem indisponível não apaga Google');
  } finally { await f.pg.close(); }
});

test('calendar: sessão legada exige conta única ativa e vínculo compatível, sem confiar em IDs externos', async () => {
  let matches: any[] = [{ id: 'one', ativo: true, membro_directus_id: 'member-one' }];
  const users = { getUser: async () => undefined, getUsersByEmail: async () => matches };
  const session = { directusUserId: 'legacy-one', email: 'one@example.invalid', membroId: 'member-one' };
  assert.deepEqual(await resolveCalendarAccount(session, users), { userId: 'one', agendaUserId: 'legacy-one' });
  assert.equal(await resolveCalendarAccount({ email: session.email }, users), null);
  assert.equal(await resolveCalendarAccount({ ...session, membroId: 'other-member' }, users), null);
  matches.push({ id: 'two', ativo: true });
  assert.equal(await resolveCalendarAccount(session, users), null);
  matches = [{ id: 'one', ativo: false }];
  assert.equal(await resolveCalendarAccount(session, users), null);
  assert.equal(await resolveCalendarAccount(session, { ...users, getUser: async () => ({ id: 'legacy-one', ativo: false }) }), null);
});

test('calendar: OAuth separado exige sessão, origem, PKCE, escopo e estado de uso único, inclusive sessão legada', async () => {
  const f = await fixture(); let exchanges = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input); assert.match(url, /^https:\/\/(oauth2\.googleapis\.com|openidconnect\.googleapis\.com|www\.googleapis\.com)\//);
    if (url.endsWith('/token')) { exchanges++; assert.match(String(init?.body), /code_verifier=/); return Response.json({ access_token: token.access_token, refresh_token: token.refresh_token, expires_in: 3600, scope: GOOGLE_CALENDAR_SCOPE }); }
    if (url.endsWith('/userinfo')) return Response.json({ sub: 'connected-google-account', email: 'connected@example.invalid', email_verified: true });
    return Response.json({ timeZone: 'Asia/Tokyo', items: [] });
  };
  const service = new GoogleCalendarService(f.store, new GoogleCalendarClient(config, fakeFetch), config); service.authorize = f.service.authorize;
  const app = express(); app.use(express.json()); app.use(session({ secret: 'fixture-only-test-session-secret', resave: false, saveUninitialized: false }));
  app.post('/test/login', (req, res) => { Object.assign(req.session, { directusUserId: 'legacy-one', email: 'one@example.invalid' }); res.json({ ok: true }); });
  const resolveAccount = (req: any) => resolveCalendarAccount(req.session, {
    getUser: async id => (await f.pg.query('SELECT * FROM users WHERE id=$1', [id])).rows[0],
    getUsersByEmail: async email => email === 'one@example.invalid' ? (await f.pg.query('SELECT * FROM users WHERE id=$1', ['one'])).rows : [],
  });
  registerGoogleCalendarRoutes(app, service, 'oauth', resolveAccount);
  app.get('/auth/google/callback', (_req, res) => res.status(418).send('existing-sign-in'));
  registerGoogleCalendarRoutes(app, service, 'api', resolveAccount);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal((await fetch(base + '/api/agenda/google/status')).status, 401);
    const login = await fetch(base + '/test/login', { method: 'POST' }); const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const request = (path: string, method = 'GET', origin = config.origin) => fetch(base + path, { method, headers: { cookie, origin }, redirect: 'manual' });
    assert.equal((await request('/api/agenda/google/connect', 'POST', 'https://evil.invalid')).status, 403);
    await request('/api/agenda/google/connect', 'POST');
    const consent = await request('/auth/google/calendar'); const location = new URL(consent.headers.get('location')!);
    assert.equal(location.hostname, 'accounts.google.com'); assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.match(location.searchParams.get('scope')!, /calendar.events/);
    const state = location.searchParams.get('state')!;
    assert.match((await request('/auth/google/callback?state=gcal.wrong&code=bad')).headers.get('location')!, /google=expired/);
    assert.equal(exchanges, 0, 'estado incorreto não troca código nem consome conexão válida');
    const callback = await request('/auth/google/callback?' + new URLSearchParams({ state, code: 'fixture-code' }));
    assert.match(callback.headers.get('location')!, /google=connected/);
    assert.equal((await f.store.get('one')).email, 'connected@example.invalid');
    assert.equal((await f.store.get('one')).time_zone, 'Asia/Tokyo');
    assert.equal((await f.store.get('one')).agenda_user_id, 'legacy-one');
    await f.pg.exec("UPDATE agenda_tarefas SET user_id='legacy-one' WHERE id='task'");
    await f.service.sync('one');
    assert.equal(f.remote.size, 1, 'agenda legada mantém proprietário, sem exportar ações de outra pessoa');
    assert.equal(exchanges, 1);
    await request('/auth/google/callback?' + new URLSearchParams({ state, code: 'fixture-code' })); assert.equal(exchanges, 1);
    assert.equal((await request('/auth/google/callback?state=normal-sign-in')).status, 418);
    assert.equal((await request('/api/agenda/google/events?from=2031-02-29&to=2032-01-01')).status, 400);
    assert.ok(!(await (await request('/api/agenda/google/status')).text()).includes('fixture-refresh'));
    assert.equal((await request('/api/agenda/google/connection', 'DELETE')).status, 200);
    assert.equal(await f.store.get('one'), undefined);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await f.pg.close(); }
});

test('calendar: cliente pagina eventos e renova token sem perder refresh token', async () => {
  const urls: string[] = [];
  const client = new GoogleCalendarClient(config, async (url, init) => {
    urls.push(String(url));
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'new-fixture-access', expires_in: 3600 });
    if (String(url).includes('pageToken=next')) return Response.json({ items: [{ id: 'b' }] });
    return Response.json({ items: [{ id: 'a' }], nextPageToken: 'next' });
  });
  const refreshed = await client.refresh({ ...token, expires_at: 0 }); assert.equal(refreshed.refresh_token, token.refresh_token);
  assert.equal((await client.list(refreshed, '2032-01-01', '2032-02-01', 'Asia/Tokyo')).items.length, 2);
  assert.ok(urls.some(u => u.includes('timeMin=2031-12-31')));
  const denied = new GoogleCalendarClient(config, async () => Response.json({ error: 'invalid_grant' }, { status: 400 }));
  await assert.rejects(() => denied.refresh({ ...token, expires_at: 0 }), /reconnect/);
});
