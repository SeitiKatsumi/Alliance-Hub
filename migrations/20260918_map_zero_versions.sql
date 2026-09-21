ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS revisao integer NOT NULL DEFAULT 0;
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS ativado_em timestamp;
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
