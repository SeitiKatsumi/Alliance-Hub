import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PortfolioDashboard, PortfolioObservation } from "../shared/portfolio-dashboard";

/** Revocation/share changes start a new scope, so previous shared financial values cannot leak. */
export function portfolioHistoryScope(properties: any[], alliances: any[]) {
  const rows = [
    ...properties.map(p => `p:${p.id}:${p.participacao_percentual}:${p.access_level}:${p.moeda}:${!!p.consolidado_via_bia}`),
    ...alliances.map(b => `b:${b.id}:${b.map_percent}:${b.moeda}`),
  ].sort();
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
export async function portfolioHistory(db: any, actor: { userId: string | null; membroId: string | null }, scope: string, since: string | null, metrics?: PortfolioDashboard) {
  if (!actor.userId && !actor.membroId) throw Object.assign(new Error("Não autenticado"), { status: 401 });
  const check = await db.execute(sql`SELECT to_regclass('public.carteira_patrimonio_observacoes') AS name`);
  if (!check.rows?.[0]?.name) return { available: false, observations: [] as PortfolioObservation[] };
  if (metrics) await db.execute(sql`
    INSERT INTO carteira_patrimonio_observacoes (user_id, membro_id, scope, day, metrics)
    VALUES (${actor.userId || ""}, ${actor.membroId || ""}, ${scope}, (now() AT TIME ZONE 'America/Sao_Paulo')::date, ${JSON.stringify(metrics)}::jsonb)
    ON CONFLICT (user_id, membro_id, scope, day) DO UPDATE SET metrics = EXCLUDED.metrics, observed_at = now()
  `);
  const result = await db.execute(sql`
    SELECT day::text, observed_at AS "observedAt", metrics FROM carteira_patrimonio_observacoes
    WHERE user_id = ${actor.userId || ""} AND membro_id = ${actor.membroId || ""} AND scope = ${scope}
      AND (${since}::date IS NULL OR day >= ${since}::date)
    ORDER BY day
  `);
  return { available: true, observations: result.rows as PortfolioObservation[] };
}
