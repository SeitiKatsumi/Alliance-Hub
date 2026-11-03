import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { biaBusinessTypeCode } from '../shared/bia-business-type';
import { emptyBiaTracking, parseTrackingChanges, sameTrackingValues, type BiaTracking } from '../shared/bia-tracking';

export const BIA_TRACKING_SQL = `CREATE TABLE IF NOT EXISTS bia_acompanhamento_versoes (
  bia_id text NOT NULL, revisao integer NOT NULL, dados jsonb NOT NULL,
  autor_id text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (bia_id, revisao)
);`;

export async function loadBiaTracking(db: any, ids: string[]): Promise<Map<string, BiaTracking>> {
  if (!ids.length) return new Map();
  const exists = (await db.execute(sql`SELECT to_regclass('public.bia_acompanhamento_versoes') AS tabela`)).rows[0]?.tabela;
  if (!exists) return new Map();
  const rows = (await db.execute(sql`SELECT DISTINCT ON (bia_id) bia_id,revisao,dados,criado_em
    FROM bia_acompanhamento_versoes WHERE bia_id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)}) ORDER BY bia_id,revisao DESC`)).rows;
  return new Map(rows.map((r: any) => [String(r.bia_id), { revision: Number(r.revisao), byThesis: r.dados, updatedAt: r.criado_em }]));
}
export async function withBiaTracking<T extends { id: unknown }>(db: any, items: T[], includeOtherTheses = false) {
  const tracking = await loadBiaTracking(db, items.map(b => String(b.id)));
  return items.map(b => {
    const stored = tracking.get(String(b.id)) || emptyBiaTracking();
    const code = biaBusinessTypeCode(b as any) as keyof typeof stored.byThesis;
    return { ...b, acompanhamento: includeOtherTheses ? stored : { ...stored, byThesis: code && stored.byThesis[code] ? { [code]: stored.byThesis[code] } : {} } };
  });
}

export function registerBiaTrackingRoutes(app: Express, deps: { db: any; access: (req: any, res: any, id: string, key: any, level: any) => Promise<any> }) {
  app.put('/api/bias/:id/acompanhamento', async (req: any, res) => {
    try {
      const allowed = await deps.access(req, res, req.params.id, 'configuracao_bia', 'edit');
      if (!allowed) return;
      const { revision, thesis, changes } = req.body || {};
      if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ error: 'Revisão de acompanhamento inválida.' });
      const parsed = parseTrackingChanges(changes);
      if (!thesis || thesis !== biaBusinessTypeCode(allowed.bia)) return res.status(409).json({ error: 'A tese da BIA mudou. Confira os dados antes de salvar o acompanhamento.' });
      const id = String(allowed.bia.id);
      if (!(await deps.db.execute(sql`SELECT to_regclass('public.bia_acompanhamento_versoes') AS tabela`)).rows[0]?.tabela) return res.status(503).json({ error: 'O acompanhamento ainda não está disponível neste ambiente.' });
      const result = await deps.db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`bia-tracking:${id}`}))`);
        const live = await deps.access(req, res, id, 'configuracao_bia', 'edit');
        if (!live) return null;
        if (thesis !== biaBusinessTypeCode(live.bia)) throw Object.assign(new Error('A tese da BIA mudou. Reabra a edição para conferir.'), { statusCode: 409 });
        const current = (await loadBiaTracking(tx, [id])).get(id) || emptyBiaTracking();
        const merged = { ...current.byThesis, ...parsed };
        // A lost response can be retried without another revision or losing the other thesis data.
        if (revision !== current.revision) {
          if (Object.keys(parsed).every(code => sameTrackingValues(current.byThesis[code as keyof typeof parsed] || {}, parsed[code as keyof typeof parsed]!))) return current;
          throw Object.assign(new Error('O acompanhamento foi alterado em outra aba. Reabra a edição para conferir a versão atual.'), { statusCode: 409 });
        }
        if (!Object.keys(parsed).length) return current;
        const inserted = (await tx.execute(sql`INSERT INTO bia_acompanhamento_versoes (bia_id,revisao,dados,autor_id)
          VALUES (${id},${revision + 1},${JSON.stringify(merged)}::jsonb,${String(req.session?.directusUserId || req.session?.userId || req.session?.membroId || 'authenticated')}) RETURNING criado_em`)).rows[0];
        return { revision: revision + 1, byThesis: merged, updatedAt: inserted.criado_em };
      });
      if (result) res.json(result);
    } catch (error: any) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Não foi possível salvar o acompanhamento. Tente novamente.' }); }
  });
}
