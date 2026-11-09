import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BUILT_METHOD_VERSION, builtCaseSchema, builtValidationMessage, calculateBuiltCase, calibrationSchema, validateBuiltCalibration } from '../shared/built-valuation';
import { builtReportHtml } from './built-valuation-report';
import { propertyMarketFingerprint } from './property-market-evidence';

const kind = 'metodo_built_v2';
type Actor = { userId: string | null; membroId: string | null; role: string | null; isPlatformAdmin: boolean };
type Dependencies = { db: any; actor: (req: any) => Actor; access: (id: string, actor: Actor, level: 'leitura' | 'administracao') => Promise<{ imovel: any }> };
const saveSchema = z.object({ casoId: z.string().uuid().optional(), anteriorId: z.string().uuid().nullable(),
  motivo: z.enum(['cadastro', 'referencias', 'metodo', 'obra', 'correcao']), entrada: builtCaseSchema });
const reviewSchema = z.object({ credencial: z.string().trim().min(3).max(200), escopo: z.string().trim().min(10).max(4000),
  parecer: z.string().trim().min(10).max(6000), documentoId: z.string().uuid(),
  conclusao: z.enum(['concorda', 'ressalvas', 'rejeita']), confirmoResponsabilidade: z.literal(true) });
const conflict = () => Object.assign(new Error('Esta análise mudou. Recarregue antes de salvar uma nova revisão.'), { status: 409 });
const safeResponse = (row: any) => row && ({ id: row.id, criadoEm: row.criado_em,
  casoId: row.entrada.casoId, anteriorId: row.entrada.anteriorId, motivo: row.entrada.motivo,
  entrada: row.entrada.dados, resultado: row.resultado });
function errorResponse(res: any, error: any) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: builtValidationMessage(error.issues) });
  return res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : 'Não foi possível processar a análise. Tente novamente.' });
}
function checkSize(body: unknown) {
  if (Buffer.byteLength(JSON.stringify(body ?? {})) > 750_000) throw Object.assign(new Error('Análise excede o limite de tamanho.'), { status: 413 });
}
async function assertEvidenceDocuments(executor: any, imovelId: string, input: unknown) {
  const ids = new Set<string>();
  const walk = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.documentoId) ids.add(value.documentoId);
    if (value.vistoriaDocumentoId) ids.add(value.vistoriaDocumentoId);
    Object.values(value).forEach(walk);
  };
  walk(input);
  if (!ids.size) return;
  const docs = await executor.execute(sql`SELECT id FROM carteira_documentos WHERE imovel_id = ${imovelId}
    AND id IN (${sql.join([...ids].map(id => sql`${id}::uuid`), sql`,`)})`);
  if (docs.rows.length !== ids.size) throw Object.assign(new Error('Uma evidência não pertence aos documentos deste imóvel ou foi removida.'), { status: 400 });
}
async function observedPerformance(db: any, id: string, currency: string) {
  const rows = (await db.execute(sql`SELECT data FROM inventario_lancamentos WHERE imovel_id = ${id}`)).rows;
  let income = 0, expense = 0, count = 0, excluded = 0;
  for (const row of rows) {
    const e = row.data || {}, n = Number(e.valor);
    if (e.status !== 'pago') continue;
    if (!Number.isFinite(n) || n < 0 || (e.moeda && e.moeda !== currency) || !['receita', 'despesa'].includes(e.tipo)) { excluded++; continue; }
    count++;
    if (e.tipo === 'receita') income += Math.round(n * 100); else expense += Math.round(n * 100);
  }
  return { status: count ? 'registrado' : 'sem_registros_pagos', receitas: income / 100, despesas: expense / 100,
    resultado: (income - expense) / 100, quantidade: count, excluidos: excluded, periodo: 'Histórico disponível de lançamentos pagos', moeda: currency };
}

export function registerBuiltValuationRoutes(app: Express, deps: Dependencies) {
  const { db, actor, access } = deps;
  const readRevision = async (id: string, revision: string) => {
    if (!z.string().uuid().safeParse(revision).success) throw Object.assign(new Error('Revisão inválida.'), { status: 400 });
    const row = (await db.execute(sql`SELECT * FROM carteira_analises WHERE id = ${revision}::uuid AND imovel_id = ${id} AND tipo = ${kind}`)).rows[0];
    if (!row) throw Object.assign(new Error('Análise não encontrada.'), { status: 404 });
    return row;
  };
  app.get('/api/carteira/imoveis/:id/metodo-built', async (req, res) => {
    try {
      const who = actor(req), { imovel } = await access(String(req.params.id), who, 'leitura');
      const cursor = req.query.antes ? z.string().uuid().parse(req.query.antes) : null;
      if (cursor) await readRevision(String(req.params.id), cursor);
      const rows = await db.execute(sql`SELECT * FROM carteira_analises WHERE imovel_id = ${req.params.id}
        AND tipo = ${kind} ${cursor ? sql`AND (criado_em,id) < (SELECT criado_em,id FROM carteira_analises WHERE id = ${cursor}::uuid AND imovel_id = ${req.params.id} AND tipo = ${kind})` : sql``}
        ORDER BY criado_em DESC, id DESC LIMIT 200`);
      const reviews = await db.execute(sql`SELECT id, criado_em, entrada, resultado FROM carteira_analises WHERE imovel_id = ${req.params.id}
        AND tipo = 'metodo_built_revisao' ORDER BY criado_em DESC LIMIT 200`);
      const docs = await db.execute(sql`SELECT id, nome FROM carteira_documentos WHERE imovel_id = ${req.params.id} ORDER BY criado_em DESC LIMIT 300`);
      const validations = await db.execute(sql`SELECT id,criado_em,resultado FROM carteira_analises WHERE imovel_id = ${req.params.id}
        AND tipo = 'metodo_built_validacao' ORDER BY criado_em DESC LIMIT 20`);
      res.json({ versao: BUILT_METHOD_VERSION, imovel: { id: imovel.id, nome: imovel.nome, tipo: imovel.tipo, moeda: imovel.moeda || 'BRL',
        objetivo: imovel.objetivo, participacaoPercentual: imovel.participacao_percentual ?? 100, cib: imovel.cib || '',
        valorAtual: imovel.valor_atual ?? '',
        endereco: [imovel.endereco, imovel.numero, imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(', ') },
        analises: rows.rows.map(safeResponse), maisAntigasCursor: rows.rows.length === 200 ? rows.rows.at(-1).id : null,
        documentos: docs.rows, validacoes: validations.rows,
        revisoes: reviews.rows.map((r: any) => ({ id: r.id, criadoEm: r.criado_em, analiseId: r.entrada.analiseId, ...r.resultado })),
        desempenho: await observedPerformance(db, String(req.params.id), imovel.moeda || 'BRL') });
    } catch (error) { errorResponse(res, error); }
  });
  app.post('/api/carteira/imoveis/:id/metodo-built', async (req, res) => {
    try {
      const who = actor(req), imovelId = String(req.params.id);
      await access(imovelId, who, 'administracao'); checkSize(req.body);
      const parsed = saveSchema.parse(req.body), caseId = parsed.casoId || randomUUID();
      const result = calculateBuiltCase(parsed.entrada);
      const saved = await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`built:${imovelId}`}))`);
        // Recheck authorization after waiting for the write lock; never modify property or financial values.
        const current = await access(imovelId, who, 'administracao');
        if ((current.imovel.moeda || 'BRL') !== parsed.entrada.moeda) throw Object.assign(new Error('Use a moeda do imóvel; conversões precisam de uma análise separada documentada.'), { status: 400 });
        const previous = (await tx.execute(sql`SELECT id FROM carteira_analises WHERE imovel_id = ${imovelId} AND tipo = ${kind}
          AND entrada->>'casoId' = ${caseId} ORDER BY criado_em DESC, id DESC LIMIT 1`)).rows[0];
        if ((previous?.id || null) !== parsed.anteriorId) throw conflict();
        await assertEvidenceDocuments(tx, imovelId, parsed.entrada);
        const capturedAt = new Date().toISOString();
        const observed = await observedPerformance(tx, imovelId, parsed.entrada.moeda);
        const snapshot = { versao: BUILT_METHOD_VERSION, imovel: current.imovel, dados: parsed.entrada, resultado: result, desempenho: observed, capturadoEm: capturedAt };
        const snapshotHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
        const entrada = { casoId: caseId, anteriorId: parsed.anteriorId, motivo: parsed.motivo, dados: parsed.entrada };
        const resultado = { ...result, imovelSnapshot: current.imovel, capturadoEm: capturedAt, hash: snapshotHash,
          desempenhoSnapshot: observed };
        return (await tx.execute(sql`INSERT INTO carteira_analises (imovel_id,tipo,versao_regra,entrada,resultado,criado_por_user_id,criado_por_membro_id)
          VALUES (${imovelId},${kind},${BUILT_METHOD_VERSION},${JSON.stringify(entrada)}::jsonb,${JSON.stringify(resultado)}::jsonb,${who.userId || null},${who.membroId || null}) RETURNING *`)).rows[0];
      });
      res.status(201).json(safeResponse(saved));
    } catch (error) { errorResponse(res, error); }
  });
  app.post('/api/carteira/imoveis/:id/metodo-built/:analiseId/revisao', async (req, res) => {
    try {
      const who = actor(req), id = String(req.params.id);
      await access(id, who, 'administracao'); checkSize(req.body);
      const review = reviewSchema.parse(req.body), revision = await readRevision(id, String(req.params.analiseId));
      await assertEvidenceDocuments(db, id, review);
      // This records a signed-in person's declaration and report attachment, not verification of a professional licence.
      const resultado = { ...review, registradoPor: who.userId || who.membroId, registradoEm: new Date().toISOString(),
        situacao: 'revisao_documentada_nao_certificada', hashAnalise: revision.resultado.hash };
      const row = (await db.execute(sql`INSERT INTO carteira_analises (imovel_id,tipo,versao_regra,entrada,resultado,criado_por_user_id,criado_por_membro_id)
        VALUES (${id},'metodo_built_revisao',${BUILT_METHOD_VERSION},${JSON.stringify({ analiseId: revision.id })}::jsonb,
          ${JSON.stringify(resultado)}::jsonb,${who.userId || null},${who.membroId || null}) RETURNING id,criado_em`)).rows[0];
      res.status(201).json({ ...row, ...resultado });
    } catch (error) { errorResponse(res, error); }
  });
  app.post('/api/carteira/imoveis/:id/metodo-built/:analiseId/adotar', async (req, res) => {
    try {
      const who = actor(req), id = String(req.params.id);
      await access(id, who, 'administracao');
      const confirmation = z.object({ confirmo: z.literal(true), valorAnterior: z.union([z.number(), z.string()]) }).parse(req.body);
      const revision = await readRevision(id, String(req.params.analiseId));
      if (revision.versao_regra !== BUILT_METHOD_VERSION) throw Object.assign(new Error('Recalcule e salve uma nova revisão com a versão atual do método antes de adotar o valor.'), { status: 409 });
      const result = calculateBuiltCase(revision.entrada.dados);
      if (revision.entrada.dados.contexto !== 'atual' || result.valorAtual == null || result.valorAtual < 0)
        throw Object.assign(new Error('Somente um valor atual calculado e não negativo pode ser adotado. Valores condicionados permanecem separados.'), { status: 400 });
      await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM inventario_imoveis WHERE id = ${id} FOR UPDATE`);
        const current = await access(id, who, 'administracao');
        if (String(current.imovel.valor_atual ?? '') !== String(confirmation.valorAnterior)
          || propertyMarketFingerprint(current.imovel) !== propertyMarketFingerprint(revision.resultado.imovelSnapshot)) throw conflict();
        const update = { valor_atual: result.valorAtual, valor_data_base: revision.entrada.dados.dataBase,
          valor_origem: 'metodo_built_referencia_confirmada', avaliacao_built_referencia: { analiseId: revision.id, classificacao: result.classificacao, metodo: revision.entrada.dados.calculo.metodo } };
        await tx.execute(sql`UPDATE inventario_imoveis SET data = data || ${JSON.stringify(update)}::jsonb,updated_at = now() WHERE id = ${id}`);
        await tx.execute(sql`INSERT INTO carteira_analises (imovel_id,tipo,versao_regra,entrada,resultado,criado_por_user_id,criado_por_membro_id)
          VALUES (${id},'metodo_built_referencia',${BUILT_METHOD_VERSION},${JSON.stringify({ analiseId: revision.id, valorAnterior: confirmation.valorAnterior })}::jsonb,
            ${JSON.stringify(update)}::jsonb,${who.userId || null},${who.membroId || null})`);
        await tx.execute(sql`INSERT INTO carteira_eventos (imovel_id,tipo,origem,titulo,payload,criado_por_user_id,criado_por_membro_id)
          VALUES (${id},'valor_referencia_metodo_built','metodo_built_referencia_confirmada','Referência atual confirmada',
            ${JSON.stringify({ analiseId: revision.id, antes: confirmation.valorAnterior, depois: result.valorAtual, dataBase: revision.entrada.dados.dataBase })}::jsonb,${who.userId || null},${who.membroId || null})`);
      });
      res.json({ success: true });
    } catch (error) { errorResponse(res, error); }
  });
  app.post('/api/carteira/imoveis/:id/metodo-built/validacao', async (req, res) => {
    try {
      const who = actor(req), id = String(req.params.id);
      await access(id, who, 'administracao'); checkSize(req.body);
      const input = calibrationSchema.parse(req.body);
      let result;
      try { result = validateBuiltCalibration(input); } catch (error: any) { throw Object.assign(error, { status: 400 }); }
      await db.execute(sql`INSERT INTO carteira_analises (imovel_id,tipo,versao_regra,entrada,resultado,criado_por_user_id,criado_por_membro_id)
        VALUES (${id},'metodo_built_validacao',${BUILT_METHOD_VERSION},${JSON.stringify(input)}::jsonb,${JSON.stringify(result)}::jsonb,${who.userId || null},${who.membroId || null})`);
      res.json(result);
    } catch (error) { errorResponse(res, error); }
  });
  app.get('/api/carteira/imoveis/:id/metodo-built/:analiseId/relatorio', async (req, res) => {
    try {
      const who = actor(req), id = String(req.params.id);
      await access(id, who, 'leitura');
      const revision = await readRevision(id, String(req.params.analiseId));
      const reviews = (await db.execute(sql`SELECT criado_em,resultado FROM carteira_analises WHERE imovel_id = ${id}
        AND tipo = 'metodo_built_revisao' AND entrada->>'analiseId' = ${String(revision.id)} ORDER BY criado_em DESC`)).rows;
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.type('html').send(builtReportHtml(safeResponse(revision), reviews));
    } catch (error) { errorResponse(res, error); }
  });
}
