CREATE TABLE IF NOT EXISTS bia_estrutura_versoes (
  id bigserial PRIMARY KEY, bia_id text NOT NULL, revisao integer NOT NULL,
  evento text NOT NULL, dados jsonb NOT NULL, contexto jsonb NOT NULL,
  motivo text NOT NULL, autor jsonb NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bia_id,revisao), UNIQUE(bia_id,evento)
);
CREATE OR REPLACE FUNCTION protect_bia_estrutura_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Histórico da estrutura da BIA é imutável'; END; $$;
DROP TRIGGER IF EXISTS bia_estrutura_immutable ON bia_estrutura_versoes;
CREATE TRIGGER bia_estrutura_immutable BEFORE UPDATE OR DELETE ON bia_estrutura_versoes
FOR EACH ROW EXECUTE FUNCTION protect_bia_estrutura_history();
