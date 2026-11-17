import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql, and, eq } from 'drizzle-orm';
import { opaInteresses } from '../shared/schema';
import { OBA_GUEST_SQL, guestMouHash } from './oba-guest';
import { MOU_PERSON_FIELDS, MOU_ADDRESS_FIELDS, validateMouQualification, pickGuestQualification } from '../shared/bia-mou-qualification';
import { matchesMouRevision } from '../shared/agenda-action';
import { calculateInitialMap } from '../shared/member-portfolio';
import { assertMapRevision, mapBaseContent, mapContentHash } from './bia-map-history';
import { openMapVacancies } from './bia-vacancies';
import { guestPayments, guestPaymentTotals } from '../shared/oba-guest';

const qualification = Object.fromEntries([...MOU_PERSON_FIELDS, ...MOU_ADDRESS_FIELDS].map(([key]) => [key, 'Dado fictício']));
Object.assign(qualification, { estado_civil: 'solteiro', email: 'person@example.test' });

test('Qualificação comum inclui cônjuge e endereços sem aceitar evidência enviada como cadastro', () => {
  assert.equal(validateMouQualification(qualification).ok, true);
  assert.ok(validateMouQualification({ ...qualification, estado_civil: 'casado' }).missing.includes('CPF do cônjuge'));
  const spouse = Object.fromEntries(MOU_PERSON_FIELDS.map(([key]) => ['conjuge_' + key, 'Fictício']));
  const married = { ...qualification, ...spouse, estado_civil: 'casado', regime_comunhao: 'separacao_total', mesmo_endereco: true };
  assert.equal(validateMouQualification(married).ok, true);
  assert.ok(validateMouQualification({ ...married, mesmo_endereco: false }).missing.includes('Endereço do titular'));
  const clean = pickGuestQualification({ ...qualification, email: 'wrong@example.test', documento_texto: 'fake', aceite_localizacao: { status: 'capturada' }, map_inicial: 'fake' }, 'verified@example.test');
  assert.equal(clean.email, 'verified@example.test');
  assert.equal(clean.documento_texto, undefined); assert.equal(clean.aceite_localizacao, undefined); assert.equal(clean.map_inicial, undefined);
});

test('Candidatura aprovada exige qualificação e MOU canônico antes do painel; revisões e evidências são preservadas', async () => {
  const pg = new PGlite(); const db = drizzle(pg); const context = new AsyncLocalStorage<any>();
  const access = { id: randomUUID(), membro_id: randomUUID(), bia_id: 'bia', opa_id: 'oba', nome: 'Pessoa fictícia', email: 'person@example.test', perfil_criado: true, convite_id: 'fixture', revogado: false };
  const participant = { memberId: access.membro_id, nome: access.nome, tipo: 'guardiao', indiceContribuicao: 0, pesoCapital: 100 };
  const calculation = calculateInitialMap(1000, [participant] as any);
  const bia = { id: 'bia', nome_bia: 'BIA fictícia', situacao: 'em_estruturacao' };
  let callbacks: any, acceptedProfile: any, financialReads = 0, activations = 0;
  try {
    await pg.exec(OBA_GUEST_SQL);
    await pg.exec(`CREATE TABLE opa_interesses (id text PRIMARY KEY DEFAULT gen_random_uuid(), opa_id text, user_id text, membro_id text, membro_nome text, mensagem text, multiplicador text, status_crm text DEFAULT 'interesse_recebido', observacao_crm text, criado_em timestamp DEFAULT now(), atualizado_em timestamp DEFAULT now());
      CREATE TABLE bia_estruturacao_rascunhos (bia_id text PRIMARY KEY, concluido boolean);
      CREATE TABLE bia_map_inicial_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text UNIQUE, status text DEFAULT 'rascunho', valor_origem numeric, moeda text, participantes jsonb, revisao integer DEFAULT 1, ativado_em timestamp, modelo_calculo integer DEFAULT 1, estrutura_economica jsonb, snapshot_hash text, divisor_multiplicador numeric, base_economica_inicial numeric, bloqueado_em timestamp, atualizado_em timestamp, bloqueado_por_user_id text, bloqueado_por_membro_id text);
      CREATE TABLE bia_mou_aceites (id uuid DEFAULT gen_random_uuid(), bia_id text, membro_id text, mou_versao text, mou_titulo text, dados_contratuais jsonb, aceite_localizacao jsonb, map_inicial_snapshot_id text, map_inicial_hash text, map_revisao integer, aceito_em timestamp DEFAULT now(), UNIQUE (bia_id,membro_id,mou_versao,map_revisao));`);
    await pg.exec(readFileSync('migrations/20261116_oba_vacancies.sql', 'utf8'));
    await pg.query('INSERT INTO oba_guest_access(id,bia_id,opa_id,email,nome,membro_id,convite_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [access.id, 'bia', 'oba', access.email, access.nome, access.membro_id, 'fixture']);
    await pg.query("INSERT INTO bia_map_inicial_snapshots(bia_id,valor_origem,moeda,participantes) VALUES ('bia',1000,'BRL',$1)", [JSON.stringify(calculation.participantes)]);
    await pg.exec("INSERT INTO bia_estruturacao_rascunhos VALUES('bia',false)");
    await db.insert(opaInteresses).values({ opa_id: 'oba', user_id: 'guest:' + access.id, membro_id: access.membro_id, vaga_id: 'q1', vaga_bia_id: 'bia', vaga_status: 'pendente' });
    const source = readFileSync('server/routes.ts', 'utf8');
    const parsed = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true);
    const functions = new Map<string, string>();
    const visit = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(parsed)); ts.forEachChild(node, visit); }; visit(parsed);
    const start = source.indexOf('  registerObaGuestRoutes(app, {');
    const block = source.slice(start, source.indexOf('  app.patch("/api/rede/oportunidades/:codigo/disparo"', start));
    const executor = () => context.getStore()?.tx || db;
    const load = async () => (await executor().execute(sql`SELECT * FROM bia_map_inicial_snapshots WHERE bia_id='bia'`)).rows[0];
    const scope = {
      app: {}, db, sql, and, eq, opaInteresses, createHash, guestMouHash, matchesMouRevision,
      registerObaGuestRoutes: (_app: any, deps: any) => { callbacks = deps; },
      offerError: (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode }),
      mapOperationContext: context, loadInitialMapSnapshot: load,
      withMapLock: async (_id: string, work: any) => context.getStore()?.tx ? work(executor(), await load()) : db.transaction(tx => context.run({ ...context.getStore(), tx }, async () => work(tx, await load()))),
      readObaDraftBase: async () => ({ participantes: calculation.participantes }),
      resolveBiaByIdOrPublicCode: async () => bia, getOpportunityRegistry: async () => ({ id: 'registry', bia_id: 'bia' }),
      obaOfferHead: async () => ({ revisao: 1, oferta: { quotas: [], documentos: [] } }),
      openMapVacancies, guestPayments, guestPaymentTotals,
      directusFetchOne: async () => bia,
      directusFetchScoped: async () => { financialReads++; return [{ id: 'payment', bia: 'bia', membro_responsavel: access.membro_id, tipo: 'Entrada', valor: 100, status: 'pago', Anexos: [{ directus_files_id: 'receipt' }] }]; },
      directusRelationId: () => null, loadBiaTracking: async () => new Map(), biaBusinessTypeCode: () => 'venda',
      ensureBiaMapInicialSnapshotsTable: async () => {}, ensureVitrineFields: async () => {},
      calculateInitialMap, assertMapRevision, mapBaseContent, mapContentHash,
      mapIsActive: () => bia.situacao === 'em_execucao',
      BIA_MOU_VERSAO: 'fixture-v1', BIA_MOU_TITULO: 'MOU fictício',
      getBiaMouTextoPersonalizado: async () => 'Documento fictício revisão ' + (await load()).revisao,
      getCapturedAcceptanceLocation: (value: any) => value?.status === 'capturada' ? value : null,
      ACCEPTANCE_LOCATION_REQUIRED_ERROR: 'Localização obrigatória',
      validateBiaMouDadosContratuais: validateMouQualification, pickGuestQualification,
      pickBiaDadosContratuaisCadastro: (data: any) => data, directusUpdate: async (_c: string, _id: string, data: any) => { acceptedProfile = data; },
      activatePropertyOriginIfReady: async () => { activations++; },
    };
    const names = ['initialMapHash', 'createMouAcceptanceWithInitialMap', 'hasBiaMouAceito', 'ensureMouAceitoOuRetornaPendencia', 'loadObaGuestFormalization'];
    new Function(...Object.keys(scope), transformSync(names.map(n => functions.get(n)).join('\n') + block, { loader: 'ts' }).code)(...Object.values(scope));
    const accept = (input: any) => context.run({ req: { body: input } }, () => callbacks.mou(access, input));
    await assert.rejects(() => callbacks.formalize(access, { dados: qualification }), /aprovada/);
    await assert.rejects(() => accept({ aceitar_mou: true }), /aprovada/);
    await pg.exec("UPDATE opa_interesses SET vaga_status='aprovada'");
    let portal = await callbacks.portal(access);
    assert.equal(portal.aprovado, true); assert.equal(portal.liberado, false); assert.equal(portal.pagamentos, undefined); assert.equal(financialReads, 0);
    await assert.rejects(() => accept({}), /dados de formalização/);
    await assert.rejects(() => callbacks.formalize(access, { dados: {} }), /obrigatórios/);
    await callbacks.formalize(access, { dados: qualification });
    assert.equal((await callbacks.portal(access)).formalizacao.dados.nome_completo, qualification.nome_completo);
    await assert.rejects(() => accept({}), /preparando o MOU/);
    bia.situacao = 'em_captacao'; await pg.exec("UPDATE bia_estruturacao_rascunhos SET concluido=true");
    const review = await accept({});
    assert.equal(review.mou.map_revisao, 1); assert.equal(activations, 0);
    const input = { aceitar_mou: true, map_revisao: 1, mou_hash: review.mou.hash };
    await assert.rejects(() => accept(input), /Localização/);
    await callbacks.formalize(access, { dados: { ...qualification, profissao: 'Revisado' } });
    await assert.rejects(() => accept(input), /mudaram/);
    const refreshed = await accept({}); input.mou_hash = refreshed.mou.hash;
    const signedInput = { ...input, aceite_localizacao: { status: 'capturada', latitude: 0, longitude: 0, captured_at: '2026-11-17T00:00:00Z' } };
    await accept(signedInput); await accept(signedInput);
    const evidence = (await pg.query<any>('SELECT * FROM bia_mou_aceites')).rows;
    assert.equal(evidence.length, 1); assert.equal(activations, 1);
    assert.equal(evidence[0].membro_id, access.membro_id); assert.equal(evidence[0].dados_contratuais.profissao, 'Revisado');
    assert.equal(evidence[0].dados_contratuais.documento_texto, refreshed.mou.texto);
    assert.equal(evidence[0].aceite_localizacao.status, 'capturada'); assert.ok(evidence[0].map_inicial_hash);
    assert.equal(acceptedProfile.email, access.email);
    portal = await callbacks.portal(access); assert.equal(portal.liberado, true); assert.equal(portal.pagamentos[0].id, 'payment');
    await pg.exec('UPDATE bia_map_inicial_snapshots SET revisao=2');
    assert.equal((await callbacks.portal(access)).liberado, false);
    await assert.rejects(() => accept(signedInput), /mudaram/);
    assert.deepEqual((await pg.query<any>('SELECT * FROM bia_mou_aceites')).rows, evidence);
    await pg.exec("UPDATE opa_interesses SET vaga_status='recusada'");
    await assert.rejects(() => accept({}), /aprovada/);
    assert.equal((await callbacks.portal(access)).liberado, false);
  } finally { await pg.close(); }
});
