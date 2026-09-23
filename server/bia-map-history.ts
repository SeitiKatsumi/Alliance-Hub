import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

export type MapHistoryRow = { memberId: string; name: string; value: number; percent: number; group?: string };
export type MapHistoryActor = { userId?: string | null; memberId?: string | null; name?: string | null };

export const MAP_HISTORY_SQL = `
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS revisao integer NOT NULL DEFAULT 0;
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS ativado_em timestamp;
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS estrutura_economica jsonb;
CREATE TABLE IF NOT EXISTS bia_map_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('zero','atual')), numero integer NOT NULL,
  revisao_base integer NOT NULL, snapshot jsonb NOT NULL, hash text NOT NULL,
  evento_id text NOT NULL, motivo text NOT NULL, autor jsonb NOT NULL,
  criado_em timestamp NOT NULL DEFAULT now(),
  UNIQUE (bia_id, tipo, numero), UNIQUE (bia_id, evento_id, tipo)
);
CREATE TABLE IF NOT EXISTS bia_map_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL,
  motivo text NOT NULL, autor jsonb NOT NULL, antes jsonb NOT NULL,
  concluido_em timestamp, criado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bia_map_eventos_pendentes ON bia_map_eventos (bia_id) WHERE concluido_em IS NULL;
ALTER TABLE bia_mou_aceites ADD COLUMN IF NOT EXISTS map_revisao integer NOT NULL DEFAULT 0;
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'bia_mou_aceites'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (bia_id, membro_id, mou_versao)'
  LOOP EXECUTE format('ALTER TABLE bia_mou_aceites DROP CONSTRAINT %I', constraint_name); END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS bia_mou_aceites_revisao_unique
  ON bia_mou_aceites (bia_id, membro_id, mou_versao, map_revisao);
CREATE OR REPLACE FUNCTION preserve_bia_map_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Versoes do MAP sao imutaveis'; END $$;
DROP TRIGGER IF EXISTS bia_map_versoes_immutable ON bia_map_versoes;
CREATE TRIGGER bia_map_versoes_immutable BEFORE UPDATE OR DELETE ON bia_map_versoes
  FOR EACH ROW EXECUTE FUNCTION preserve_bia_map_version();
`;

// Stable ordering makes a reordered form a no-op, while preserving explicit zeroes.
export function mapContentHash(value: unknown): string {
  const canonical = (item: any): any => {
    if (Array.isArray(item)) return item.map(canonical).sort((a, b) =>
      String(a?.participantId || a?.memberId || JSON.stringify(a)).localeCompare(String(b?.participantId || b?.memberId || JSON.stringify(b))));
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])]));
    return item;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function mapRowsFromBase(base: any): MapHistoryRow[] {
  return (base.participantes || []).map((p: any) => ({
    memberId: String(p.memberId || p.participantId), name: String(p.nome),
    group: p.tipo === "guardiao" ? "Sócios Guardiões" : "Sócios Multiplicadores",
    value: Number(p.cppTotal || 0), percent: Number(p.mapPercentual || 0),
  }));
}

export function mapBaseContent(base: any) {
  return { valor_origem: Number(base.valor_origem), moeda: base.moeda,
    divisor_multiplicador: Number(base.divisor_multiplicador), base_economica_inicial: Number(base.base_economica_inicial),
    participantes: base.participantes || [], ...(Number(base.modelo_calculo) === 5 ? { modelo_calculo: 5, estrutura_economica: base.estrutura_economica } : {}) };
}

export function canCorrectMapBase(bia: any, memberId: unknown): boolean {
  const id = (v: any) => String(v?.id || v || "");
  return !!memberId && [id(bia.diretor_alianca), id(bia.aliado_built)].includes(String(memberId));
}

export function assertMapRevision(current: number, expected: unknown) {
  if (!Number.isInteger(expected) || expected !== current) {
    throw Object.assign(new Error("O MAP mudou. Atualize a página antes de continuar."), { statusCode: 409 });
  }
}

export function canReviewLegacyMapBase(bia: any, memberId: unknown, role: unknown): boolean {
  return String(role || "").toLowerCase() === "superadmin" || canCorrectMapBase(bia, memberId);
}

export async function appendMapVersion(tx: any, input: {
  biaId: string; tipo: "zero" | "atual"; base: any; rows: MapHistoryRow[];
  eventId: string; reason: string; actor: MapHistoryActor; biaName: string; footer: string;
}) {
  const { biaId, tipo, base, rows, eventId, reason, actor } = input;
  const prior = (await tx.execute(sql`SELECT * FROM bia_map_versoes WHERE bia_id = ${biaId} AND tipo = ${tipo} ORDER BY numero DESC LIMIT 1`)).rows[0];
  const content = tipo === "zero" ? mapBaseContent(base) : { base: mapBaseContent(base), rows };
  const hash = mapContentHash(content);
  if (prior?.hash === hash) return prior;
  const existing = (await tx.execute(sql`SELECT * FROM bia_map_versoes WHERE bia_id = ${biaId} AND evento_id = ${eventId} AND tipo = ${tipo}`)).rows[0];
  if (existing) return existing;
  const numero = Number(prior?.numero || 0) + 1;
  const snapshot = { base: mapBaseContent(base), rows, biaName: input.biaName, footer: tipo === "zero" ? "" : input.footer };
  const result = await tx.execute(sql`
    INSERT INTO bia_map_versoes (bia_id, tipo, numero, revisao_base, snapshot, hash, evento_id, motivo, autor)
    VALUES (${biaId}, ${tipo}, ${numero}, ${tipo === "zero" ? numero : Number(base.revisao)}, ${JSON.stringify(snapshot)}::jsonb,
      ${hash}, ${eventId}, ${reason}, ${JSON.stringify(actor)}::jsonb) RETURNING *`);
  return result.rows[0];
}
