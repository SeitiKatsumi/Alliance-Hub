import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import session from 'express-session';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { externalBiaMemberIds, OBA_GUEST_SQL, registerObaGuestRoutes } from './oba-guest';
import { guestPayments, guestPaymentTotals } from '../shared/oba-guest';

test('Portal externo projeta apenas os próprios pagamentos de caixa vigentes', () => {
  const row = { id: 'a', bia: 'bia', membro_responsavel: 'me', tipo: 'Entrada', valor: '10.01', status: 'Pago', email: 'private', documento: 'private', Anexos: [{ directus_files_id: 'receipt' }] };
  const projected = guestPayments([row, { ...row, id: 'other', membro_responsavel: 'other' },
    { ...row, id: 'bia2', bia: 'other' }, { ...row, id: 'out', tipo: 'Saída' }, { ...row, id: 'cancel', status: 'cancelado' },
    { ...row, id: 'old', parcela_vigente: false }, { ...row, id: 'noncash', natureza: 'nao_caixa' },
    { ...row, id: 'pending', conciliacao_pendente: true }, { ...row, id: 'due', valor: '2.14', status: 'agendado' }], 'bia', 'me');
  assert.deepEqual(projected.map(item => item.id), ['a', 'due']);
  assert.deepEqual(guestPaymentTotals(projected), { pago: 10.01, aPagar: 2.14 });
  assert.doesNotMatch(JSON.stringify(projected), /private/);
});

test('Código por e-mail exige posse, limita tentativas e isola a BIA, inclusive arquivos e reaproveitamento', async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'only-for-isolated-test', resave: false, saveUninitialized: false }));
  const codes: string[] = [];
  let applied = 0;
  let claimed = 0;
  let approved = false;
  let accepted = false;
  registerObaGuestRoutes(app, {
    db, accountExists: async email => email === 'member@example.test',
    invite: async token => { assert.equal(token, 'fixture'); return { id: 'invite', biaId: 'bia' }; },
    sendCode: async (_email, code) => { codes.push(code); return { ok: true }; },
    claim: async () => { claimed++; },
    apply: async () => { applied++; return { ok: true }; },
    formalize: async () => ({ ok: true }), mou: async () => ({ ok: true }),
    portal: async access => ({ nome: access.nome, aprovado: approved, liberado: approved && accepted, pagamentos: [{ arquivos: ['receipt'] }], documentos: [{ id: 'offer-doc' }] }),
    file: async (_req, res) => res.send('receipt-body'),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/oba-guest`;
  const call = (path: string, body?: any, cookie?: string) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    const data = { email: 'guest@example.test', nome: 'Pessoa convidada', opaId: 'oba', inviteToken: 'fixture' };
    const response = await call('/code', data);
    assert.equal(response.status, 200);
    const challenge = await response.json();
    assert.match(codes[0], /^\d{4}$/);
    assert.doesNotMatch(JSON.stringify(challenge), /digest|email|nome/);
    assert.equal((await call('/code', data)).status, 429);
    assert.equal((await call('/' + challenge.accessId)).status, 401);
    assert.equal((await call('/' + challenge.accessId + '/interesse', {})).status, 401);
    assert.equal((await call('/' + challenge.accessId + '/formalizacao', {})).status, 401);
    assert.equal((await call('/' + challenge.accessId + '/mou', { aceitar_mou: true })).status, 401);
    const wrong = codes[0] === '0000' ? '0001' : '0000';
    for (let i = 0; i < 5; i++) assert.equal((await call('/verify', { challengeId: challenge.challengeId, code: wrong })).status, 401);
    assert.equal((await call('/verify', { challengeId: challenge.challengeId, code: codes[0] })).status, 401);
    await pg.exec("UPDATE oba_guest_codes SET criado_em=now()-interval '2 minutes'");
    const fresh = await (await call('/code', data)).json();
    const verified = await call('/verify', { challengeId: fresh.challengeId, code: codes.at(-1) });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie')!.split(';')[0];
    assert.equal(claimed, 1);
    assert.equal((await call('/verify', { challengeId: fresh.challengeId, code: codes.at(-1) })).status, 401);
    assert.equal((await call('/' + fresh.accessId, undefined, cookie)).status, 200);
    assert.equal((await call('/00000000-0000-0000-0000-000000000000', undefined, cookie)).status, 401);
    assert.equal((await call('/' + fresh.accessId + '/files/receipt', undefined, cookie)).status, 404);
    assert.equal((await call('/' + fresh.accessId + '/files/offer-doc', undefined, cookie)).status, 200);
    approved = true;
    assert.equal((await call('/' + fresh.accessId + '/files/receipt', undefined, cookie)).status, 404, 'Aprovação sem MOU não libera comprovantes');
    accepted = true;
    assert.equal(await (await call('/' + fresh.accessId + '/files/receipt', undefined, cookie)).text(), 'receipt-body');
    assert.equal((await call('/' + fresh.accessId + '/files/someone-else', undefined, cookie)).status, 404);
    assert.equal((await call('/' + fresh.accessId + '/interesse', {}, cookie)).status, 200);
    assert.equal(applied, 1);
    await pg.exec("UPDATE oba_guest_codes SET criado_em=now()-interval '2 minutes'");
    const reentry = await (await call('/code', { accessId: fresh.accessId, email: data.email })).json();
    await pg.query("UPDATE oba_guest_codes SET expira_em=now()-interval '1 second' WHERE id=$1", [reentry.challengeId]);
    assert.equal((await call('/verify', { challengeId: reentry.challengeId, code: codes.at(-1) })).status, 401);
    assert.equal((await call('/code', { accessId: fresh.accessId, email: 'someone-else@example.test' })).status, 404);
    assert.equal((await call('/code', { ...data, email: 'member@example.test' })).status, 409);
    await pg.query('UPDATE oba_guest_access SET revogado=true WHERE id=$1', [fresh.accessId]);
    assert.equal((await call('/' + fresh.accessId, undefined, cookie)).status, 403);
  } finally { server.close(); await pg.close(); }
});

test('Candidatura externa usa a composição real, revisão publicada e identidade estável, sem duplicar cotas ou criar conta', async () => {
  const [{readFileSync},{transformSync},{and,eq,sql},{opaInteresses},{openMapVacancies},{randomUUID}] = await Promise.all([
    import('node:fs'), import('esbuild'), import('drizzle-orm'), import('../shared/schema'), import('./bia-vacancies'), import('node:crypto'),
  ]);
  const pg = new PGlite(); const db = drizzle(pg);
  try {
    assert.equal((await externalBiaMemberIds(db, 'bia')).size, 0);
    await pg.exec(OBA_GUEST_SQL);
    await pg.exec("CREATE TABLE opa_interesses (id text primary key default gen_random_uuid(), opa_id text, user_id text, membro_id text, membro_nome text, mensagem text, multiplicador text, status_crm text default 'interesse_recebido', observacao_crm text, criado_em timestamp default now(), atualizado_em timestamp default now())");
    await pg.exec(readFileSync(new URL('../migrations/20261116_oba_vacancies.sql',import.meta.url),'utf8'));
    const access = { id: randomUUID(), membro_id: randomUUID(), bia_id: 'bia', opa_id: 'oba', nome: 'Pessoa externa', email: 'external@example.test', perfil_criado: false };
    await pg.query('INSERT INTO oba_guest_access(id,bia_id,opa_id,email,nome,membro_id,convite_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [access.id,access.bia_id,access.opa_id,access.email,access.nome,access.membro_id,'invite']);
    let callbacks: any, profiles = 0, status = 'ativa';
    const slots = ['q1','q2'].map(id => ({ participantId: id, titular: 'vaga', memberId: null, tipo: 'guardiao', cotasInvestimento: 1 }));
    const source = readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
    const start = source.indexOf('  registerObaGuestRoutes(app, {');
    const block = source.slice(start,source.indexOf('  app.patch("/api/rede/oportunidades/:codigo/disparo"',start));
    const scope = { app: {}, db, sql, and, eq, opaInteresses, registerObaGuestRoutes: (_app: any, deps: any) => { callbacks = deps; },
      offerError: (message: string) => new Error(message), openMapVacancies,
      withMapLock: (_id: string, work: any) => db.transaction(tx => work(tx,{participantes:slots})),
      getOpportunityRegistry: async () => ({id:'registry',bia_id:'bia',status}),
      resolveBiaByIdOrPublicCode: async () => ({situacao:'em_estruturacao'}),
      isOpportunityEditable: (value: string) => value === 'ativa', quotaApplicationsOpen: () => true,
      obaOfferHead: async () => ({bia_id:'bia',revisao:3,oferta:{quotas:slots.map(slot=>({id:slot.participantId,tipo:slot.tipo,quantidade:slot.cotasInvestimento}))}}),
      directusFetchOne: async () => null, directusCreate: async (_collection: string, input: any) => {
        profiles++; assert.equal(input.id,access.membro_id); assert.equal(input.na_vitrine,false); assert.equal(input.em_membros_built,false);
      },
    };
    new Function(...Object.keys(scope),transformSync(block,{loader:'ts'}).code)(...Object.values(scope));
    await assert.rejects(()=>callbacks.apply(access,{vaga_ids:['q1'],mensagem:'',oferta_revisao:2}),/oferta mudou/);
    await assert.rejects(()=>callbacks.apply(access,{vaga_ids:['other'],mensagem:'',oferta_revisao:3}),/oferta mudou/);
    assert.equal(profiles,0);
    await callbacks.apply(access,{vaga_ids:['q1','q2'],mensagem:'Quero duas cotas',oferta_revisao:3});
    await callbacks.apply(access,{vaga_ids:['q1','q2'],mensagem:'Quero duas cotas',oferta_revisao:3});
    assert.equal(profiles,1);
    const rows = await db.select().from(opaInteresses);
    assert.equal(rows.length,2);
    assert.ok(rows.every(row=>row.user_id==='guest:'+access.id && row.membro_id===access.membro_id && row.vaga_status==='pendente'));
    assert.ok((await externalBiaMemberIds(db,'bia')).has(access.membro_id));
    assert.equal((await externalBiaMemberIds(db,'other')).size,0);
    status='encerrada';
    await assert.rejects(()=>callbacks.apply(access,{vaga_ids:['q1'],mensagem:'',oferta_revisao:3}),/encerrada/);
  } finally { await pg.close(); }
});
