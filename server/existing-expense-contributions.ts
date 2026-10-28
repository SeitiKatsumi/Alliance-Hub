import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { existingExpenseProblem, previewExistingExpense } from '../shared/existing-expense-contributions';
import type { ExpenseContributionDependencies } from './expense-contributions';

export const EXISTING_EXPENSE_SQL = `
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS despesa_existente_id text;
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS origem_versao text;
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS rateio jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS bia_despesa_aportes_origem_unica ON bia_despesa_aportes(despesa_existente_id) WHERE despesa_existente_id IS NOT NULL;`;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const distribution = z.object({ mode: z.enum(['manual', 'map']), unit: z.enum(['valor', 'percentual']),
  participants: z.array(z.object({ memberId: z.string().min(1), value: z.number().finite().optional() }).strict()).min(1).max(100),
  dueDate: day, sourceVersion: z.string().length(64), mapVersion: z.string().nullable() }).strict();
const confirmation = distribution.extend({ requestId: z.string().uuid(), expected: z.array(z.object({ memberId: z.string(), amount: z.number() })).min(1).max(100) });
const fault = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const relation = (value: any): string | null => value == null ? null : typeof value === 'object' ? relation(value.id) : String(value);
const ids = (values: any, key: string) => [...new Set((Array.isArray(values) ? values : []).map((v: any) => relation(v?.[key] ?? v)).filter(Boolean))].sort() as string[];
const date = (v: any) => v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null;
export function expenseSourceSnapshot(row: any) {
  return { id: String(row.id), bia: relation(row.bia), tipo: row.tipo, valor: Number(row.valor), descricao: row.descricao || '',
    status: row.status, data: date(row.data), data_vencimento: date(row.data_vencimento), data_pagamento: date(row.data_pagamento),
    membro_responsavel: relation(row.membro_responsavel), favorecido_id: relation(row.favorecido_id),
    Categoria: ids(row.Categoria, 'categorias_id'), tipo_de_cpp: ids(row.tipo_de_cpp, 'tipos_cpp_id'),
    Anexos: ids(row.Anexos ?? row.anexos, 'directus_files_id'), natureza: row.natureza ?? null,
    finalidade: row.finalidade ?? null, conciliacao_pendente: !!row.conciliacao_pendente };
}
export async function existingExpenseLot(db: any, id: string) {
  return (await db.execute(sql`SELECT * FROM bia_despesa_aportes WHERE despesa_existente_id=${id} OR movimentos @> ${JSON.stringify([{ id }])}::jsonb LIMIT 1`)).rows[0];
}
export async function linkedExpenseMovementIds(db: any, bia: string): Promise<Set<string>> {
  const lots = (await db.execute(sql`SELECT movimentos FROM bia_despesa_aportes WHERE bia_id=${bia}`)).rows;
  return new Set(lots.flatMap((lot: any) => lot.movimentos.map((m: any) => String(m.id))));
}

export function registerExistingExpenseContributions(app: any, deps: ExpenseContributionDependencies) {
  const source = async (id: string) => deps.one('fluxo_caixa', id, 'fields=*,tipo_de_cpp.tipos_cpp_id.*,Categoria.categorias_id.*,Anexos.directus_files_id.*');
  async function access(req: any, res: any, level: 'view' | 'edit') {
    if (!req.session?.directusUserId) { res.status(401).json({ error: 'Não autenticado' }); return null; }
    const row = await source(String(req.params.id));
    if (!row) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return null; }
    const bia = relation(row.bia);
    if (!bia) { res.status(403).json({ error: 'Despesa sem BIA autorizada.' }); return null; }
    const auth = await deps.access(req, res, bia, level);
    return auth ? { row, auth, bia: String(auth.bia.id) } : null;
  }
  async function current(auth: any, bia: string, id: string, requireMap = false) {
    const row = await source(id); if (!row || relation(row.bia) !== bia) throw fault('A despesa mudou. Reabra o lançamento.');
    const expense = expenseSourceSnapshot(row);
    let map: { memberId: string; percent: number }[] = [], mapAvailable = true;
    try { map = (await deps.map(auth.bia, bia)).filter(m => m.memberId && m.percent > 0).sort((a, b) => a.memberId.localeCompare(b.memberId, 'en')); }
    catch { mapAvailable = false; }
    if (requireMap && (!mapAvailable || !map.length)) throw fault('Não foi possível consultar o MAP oficial. Tente novamente ou escolha a divisão manual.', 503);
    return { expense, sourceVersion: hash(expense), map, mapAvailable, mapVersion: mapAvailable ? hash(map) : null,
      allowed: new Set([...deps.members(auth.bia), ...map.map(m => m.memberId)]) };
  }
  async function prepare(auth: any, bia: string, id: string, input: z.infer<typeof distribution>) {
    await deps.phase(bia);
    const ctx = await current(auth, bia, id, input.mode === 'map');
    const problem = existingExpenseProblem(ctx.expense); if (problem) throw fault(problem, 422);
    if (ctx.sourceVersion !== input.sourceVersion || (input.mode === 'map' && input.mapVersion !== ctx.mapVersion))
      throw fault('A despesa ou o MAP mudou. Atualize os dados e confira uma nova prévia.');
    for (const p of input.participants) if (!ctx.allowed.has(p.memberId) || !await deps.one('cadastro_geral', p.memberId, 'fields=id'))
      throw fault('Participante indisponível nesta BIA.', 400);
    let expected;
    try { expected = previewExistingExpense(ctx.expense.valor, input.mode, input.unit, input.participants, ctx.map); }
    catch (e: any) { throw fault(e.message, 400); }
    if (!ctx.expense.data || !ctx.expense.data_vencimento || !ctx.expense.descricao.trim()) throw fault('Complete a descrição e as datas da despesa antes de gerar aportes.', 422);
    return { ...ctx, expected };
  }
  function failure(res: any, error: any, retry = false) {
    res.status(error instanceof z.ZodError ? 400 : error.statusCode || 503).json({ retry,
      error: error instanceof z.ZodError ? 'Revise a divisão, os participantes e o vencimento.' : error.statusCode ? error.message : 'Não foi possível concluir. Tente novamente com a mesma solicitação.' });
  }
  app.get('/api/fluxo-caixa/:id/aportes', async (req: any, res: any) => {
    try {
      const found = await access(req, res, 'edit'); if (!found) return;
      const lot = await existingExpenseLot(deps.db, String(req.params.id));
      if (lot) return res.json({ linked: true, state: lot.estado, resumeRequest: lot.despesa_existente_id && lot.autor === String(req.session.directusUserId) && lot.estado !== 'concluido' ? lot.rateio?.request : null });
      const ctx = await current(found.auth, found.bia, String(req.params.id));
      const participants = await Promise.all([...ctx.allowed].map(async memberId => {
        const m = await deps.one('cadastro_geral', memberId, 'fields=*');
        return { memberId, label: m?.Nome_de_usuario || m?.nome || m?.nome_completo || [m?.primeiro_nome, m?.sobrenome].filter(Boolean).join(' ') || memberId, percent: ctx.map.find(p => p.memberId === memberId)?.percent || 0 };
      }));
      res.json({ linked: false, expense: ctx.expense, sourceVersion: ctx.sourceVersion, mapVersion: ctx.mapVersion,
        mapAvailable: ctx.mapAvailable && ctx.map.length > 0, participants, problem: existingExpenseProblem(ctx.expense) });
    } catch (error) { failure(res, error); }
  });
  app.post('/api/fluxo-caixa/:id/aportes/previa', async (req: any, res: any) => {
    try {
      const input = distribution.parse(req.body), found = await access(req, res, 'edit'); if (!found) return;
      const result = await deps.lock(found.bia, async () => {
        const freshAuth = await deps.access(req, res, found.bia, 'edit'); if (!freshAuth) return null;
        if (await existingExpenseLot(deps.db, String(req.params.id))) throw fault('Esta despesa já possui aportes vinculados. Consulte os vínculos.');
        const ctx = await prepare(freshAuth, found.bia, String(req.params.id), input);
        return { expected: ctx.expected, sourceVersion: ctx.sourceVersion, mapVersion: ctx.mapVersion };
      });
      if (result) res.json(result);
    } catch (error) { failure(res, error); }
  });
  app.post('/api/fluxo-caixa/:id/aportes', async (req: any, res: any) => {
    let retry = false;
    try {
      const input = confirmation.parse(req.body), found = await access(req, res, 'edit'); if (!found) return;
      const actor = String(req.session.directusUserId), id = String(req.params.id), requestHash = hash({ id, ...input });
      const result = await deps.lock(found.bia, async () => {
        const freshAuth = await deps.access(req, res, found.bia, 'edit'); if (!freshAuth) return null;
        let lot = (await deps.db.execute(sql`SELECT * FROM bia_despesa_aportes WHERE id=${input.requestId}`)).rows[0];
        if (lot && (lot.despesa_existente_id !== id || lot.bia_id !== found.bia || lot.autor !== actor || lot.pedido_hash !== requestHash))
          throw fault('A solicitação foi usada com outros dados. Retome a geração original.');
        if (lot?.estado === 'concluido') return { id: lot.id, estado: lot.estado, movimentos: lot.movimentos };
        if (!lot) {
          if (await existingExpenseLot(deps.db, id)) throw fault('Esta despesa já possui aportes vinculados. Consulte os vínculos.');
          const ctx = await prepare(freshAuth, found.bia, id, input), expense = ctx.expense;
          if (JSON.stringify(ctx.expected) !== JSON.stringify(input.expected)) throw fault('A divisão mudou. Confira uma nova prévia.');
          const movements = [expense, ...ctx.expected.map(p => ({ id: randomUUID(), bia: found.bia, tipo: 'entrada', valor: String(p.amount),
            descricao: `Aporte para: ${expense.descricao}`, data: expense.data, data_vencimento: input.dueDate, status: expense.status,
            data_pagamento: null, membro_responsavel: p.memberId, favorecido_id: p.memberId, Categoria: [],
            tipo_de_cpp: expense.tipo_de_cpp.map(tipos_cpp_id => ({ tipos_cpp_id })), Anexos: [], despesa_origem_id: id }))];
          await deps.db.execute(sql`INSERT INTO bia_despesa_aportes (id,bia_id,autor,pedido_hash,movimentos,despesa_existente_id,origem_versao,rateio)
            VALUES (${input.requestId},${found.bia},${actor},${requestHash},${JSON.stringify(movements)}::jsonb,${id},${ctx.sourceVersion},${JSON.stringify({ request: input, map: input.mode === 'map' ? ctx.map : null })}::jsonb)`);
          lot = { id: input.requestId, bia_id: found.bia, movimentos: movements };
        }
        retry = true;
        await deps.phase(found.bia);
        const entries = lot.movimentos.filter((m: any) => m.tipo === 'entrada');
        const present = await Promise.all(entries.map((m: any) => deps.one('fluxo_caixa', m.id, 'fields=id,bia,valor')));
        if (present.some(Boolean) && !present.every(Boolean)) throw fault('Criação incompleta. Mantenha esta solicitação para conciliação; não crie outro lote.', 503);
        if (present.some((row: any, i: number) => row && (relation(row.bia) !== found.bia || Number(row.valor) !== Number(entries[i].valor)))) throw fault('Os registros do lote divergiram. Solicite a conferência dos vínculos.', 503);
        if (!present.some(Boolean)) {
          const latest = await source(id);
          const original = lot.movimentos.find((m: any) => m.id === id);
          if (!latest || hash(expenseSourceSnapshot(latest)) !== hash(expenseSourceSnapshot(original))) throw fault('A despesa de origem mudou durante a geração. Solicite a conferência deste lote.', 409);
          await deps.createBatch(entries.map(({ despesa_origem_id, ...entry }: any) => entry));
        }
        await deps.db.transaction(async (tx: any) => {
          for (const m of lot.movimentos) await tx.execute(sql`INSERT INTO fluxo_caixa_historico (fluxo_caixa_id,bia_id,acao,ator_user_id,origem,dados_depois,payload)
            VALUES (${m.id},${found.bia},${m.id === id ? 'aportes_gerados' : 'criado'},${actor},'despesa-existente-aportes',${JSON.stringify(m)}::jsonb,${JSON.stringify({ lote: lot.id, despesa: id, rateio: input.mode })}::jsonb)`);
          await tx.execute(sql`UPDATE bia_despesa_aportes SET estado='concluido' WHERE id=${lot.id}`);
        });
        return { id: lot.id, estado: 'concluido', movimentos: lot.movimentos };
      });
      if (result) res.json(result);
    } catch (error) { failure(res, error, retry); }
  });
}
