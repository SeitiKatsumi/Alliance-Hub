import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { RoPulse } from './ro-pulse';
import { normalizeRoSchedule, normalizeRoLocationType, normalizeRoGuestPolicy, normalizeRoTimeZone, roAlertCopy, RO_EVENT_TYPE } from '../shared/ro';

test('criação real da RO salva Pulso, pauta, participantes e Agenda na mesma transação; sem Pulso preserva fluxo anterior', async () => {
  const pg = new PGlite(), db = drizzle(pg);
  await pg.exec(`CREATE TABLE opportunity_meetings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),codigo text,titulo text,event_type text,community_id text,data date,hora text,start_at timestamp,end_at timestamp,timezone text,link text,location_type text,address text,guest_policy text,pauta text,strategic_cell_id text,publico text,organizador_user_id text,organizador_membro_id text,status text DEFAULT 'agendada');
  CREATE TABLE users(id text,role text,ativo boolean,membro_directus_id text);
  CREATE TABLE opportunity_meeting_items(meeting_id uuid,registry_id text,papel text,UNIQUE(meeting_id,registry_id));
  CREATE TABLE opportunity_meeting_participants(meeting_id uuid,user_id text,membro_id text,nome text,papel text);
  CREATE TABLE agenda_tarefas(user_id text,membro_id text,titulo text,descricao text,data date,hora text,prioridade text,contexto_tipo text,contexto_id text,atribuido_por_user_id text,atribuido_por_membro_id text,atribuido_por_nome text);
  INSERT INTO users VALUES('owner','membro',true,'owner-member');`);
  await pg.exec(readFileSync('migrations/20261104_ro_pulses.sql', 'utf8'));
  const communities = [{ id: 'o', nome: 'Origem', pais: 'Brasil', territorio: 'Sudeste' }, { id: 'r', nome: 'Regional', pais: 'Brasil', territorio: 'Sudeste' }];
  const actor = { userId: 'owner', membroId: 'owner-member', isPlatformAdmin: false };
  const pulseActor = { userId: 'owner', memberId: 'owner-member', admin: false };
  let mails = 0, allowed = true, failQueue = false, codes = 0;
  const service = new RoPulse({ db, communities: async () => communities, members: async () => [], meeting: async () => null, send: async () => { mails++; return { ok: true }; } });
  const enqueue = service.enqueue.bind(service);
  service.enqueue = async (...args: Parameters<RoPulse['enqueue']>) => { await enqueue(...args); if (failQueue) throw Error('Falha controlada na fila'); };
  const source = readFileSync('server/routes.ts', 'utf8');
  const start = source.indexOf('  app.post("/api/reunioes-oportunidades",');
  const route = source.slice(start, source.indexOf('  app.patch("/api/reunioes-oportunidades/:id",', start));
  let handler: any;
  const scope = {
    app: { post: (_: string, fn: any) => { handler = fn; } }, db, sql, roPulse: service,
    requireCarteiraActor: () => actor,
    roPulseActor: (req: any) => { if (req.session.companyEmployeeId) throw Object.assign(Error('Perfil pessoal'), { status: 403 }); return pulseActor; },
    normalizeRoSchedule, normalizeRoLocationType, normalizeRoGuestPolicy, normalizeRoTimeZone, roAlertCopy, RO_EVENT_TYPE,
    normalizedOptionalRoUrl: () => null, ensureBusinessOpportunityTables: async () => {},
    getCommunityForCells: async () => communities[0], isAdminRequest: () => false,
    isCommunityMemberIncludingAnchor: async () => allowed, scheduleOpportunityRegistryBackfill: () => {},
    getOpportunityRegistry: async () => ({ id: 'registry', tipo: 'oportunidade', source_id: 'economic', codigo: 'OP-1', autor_user_id: 'owner', autor_membro_id: 'owner-member' }),
    getEconomicOpportunity: async () => ({}), economicOpportunityAccess: async () => ({ canManage: true }),
    createUniqueMeetingCode: async () => 'RO-' + (++codes), attachObjectToRegistryTraces: async () => {}, recordOpportunityEvent: async () => {},
  };
  new Function(...Object.keys(scope), ts.transpileModule(route, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(scope));
  const body = { titulo: 'RO de teste', data: '2035-12-31', hora: '10:00', timezone: 'America/Sao_Paulo', community_id: 'o', oportunidades: ['OP-1'] };
  const config = { intervalo_horas: 9, comunidades: { regional: ['r'], nacional: [], global: [] } };
  const run = async (values: any, employee = false) => {
    let code = 200, data: any;
    await handler({ body: values, session: { nome: 'Pessoa teste', companyEmployeeId: employee ? 'employee' : null } }, { status(n: number) { code = n; return this; }, json(v: any) { data = v; return this; } });
    return { code, data };
  };
  const counts = async () => (await pg.query<any>(`SELECT (SELECT count(*)::int FROM opportunity_meetings) AS ros, (SELECT count(*)::int FROM ro_pulse_flows) AS flows, (SELECT count(*)::int FROM opportunity_meeting_items) AS items, (SELECT count(*)::int FROM opportunity_meeting_participants) AS participants, (SELECT count(*)::int FROM agenda_tarefas) AS agenda`)).rows[0];
  try {
    assert.equal((await run(body)).code, 201);
    assert.deepEqual(await counts(), { ros: 1, flows: 0, items: 1, participants: 1, agenda: 1 });
    const created = await run({ ...body, pulso: config });
    assert.equal(created.code, 201, JSON.stringify(created.data));
    assert.equal(created.data.participantes.length, 1);
    assert.deepEqual(await counts(), { ros: 2, flows: 1, items: 2, participants: 2, agenda: 2 });
    assert.equal((await pg.query<any>('SELECT intervalo_horas FROM ro_pulse_flows')).rows[0].intervalo_horas, 9);
    assert.deepEqual((await pg.query<any>('SELECT stage FROM ro_pulse_waves ORDER BY ordem')).rows.map(r => r.stage), ['origem', 'regional']);
    assert.equal(mails, 0, 'criação apenas agenda a fila, sem SMTP');
    const baseline = await counts();
    assert.equal((await run({ ...body, pulso: { ...config, intervalo_horas: 0 } })).code, 400);
    assert.equal((await run({ ...body, pulso: { ...config, comunidades: { ...config.comunidades, regional: ['inexistente'] } } })).code, 400);
    assert.equal((await run({ ...body, data: '2000-01-01', pulso: config })).code, 409);
    assert.equal((await run({ ...body, pulso: config }, true)).code, 403);
    assert.deepEqual(await counts(), baseline);
    failQueue = true;
    assert.equal((await run({ ...body, pulso: config })).code, 500);
    assert.deepEqual(await counts(), baseline, 'falha na fila reverte também RO, pauta, participantes e Agenda');
    allowed = false;
    assert.equal((await run({ ...body, pulso: config })).code, 403);
    assert.deepEqual(await counts(), baseline);
  } finally { await pg.close(); }
});

test('catálogo de criação exige identidade e comunidade permitida antes de consultar destinos', async () => {
  const source = readFileSync('server/routes.ts', 'utf8');
  const start = source.indexOf('  app.get("/api/comunidades/:id/ro-pulso",');
  const route = source.slice(start, source.indexOf('  app.use("/api/reunioes-oportunidades",', start));
  let handler: any, calls = 0, authenticated = true, member = true, failed = false;
  const scope = {
    app: { get: (_: string, fn: any) => { handler = fn; } },
    roPulseActor: () => { if (!authenticated) throw Object.assign(Error('Login'), { status: 401 }); },
    getCommunityForCells: async () => ({ id: 'o' }), isAdminRequest: () => false,
    isCommunityMemberIncludingAnchor: async () => member,
    roPulse: { catalog: async () => { calls++; if (failed) throw Error('Provider'); return [{ id: 'o', stage: 'origem' }]; } },
  };
  new Function(...Object.keys(scope), ts.transpileModule(route, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(scope));
  const run = async () => { let status = 200; await handler({ params: { id: 'o' } }, { status(n: number) { status = n; return this; }, json() { return this; } }); return status; };
  authenticated = false; assert.equal(await run(), 401); assert.equal(calls, 0);
  authenticated = true; member = false; assert.equal(await run(), 403); assert.equal(calls, 0);
  member = true; assert.equal(await run(), 200); assert.equal(calls, 1);
  failed = true; assert.equal(await run(), 503);
});
