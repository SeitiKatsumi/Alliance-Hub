CREATE TABLE IF NOT EXISTS bia_acompanhamento_versoes (
  bia_id text NOT NULL,
  revisao integer NOT NULL,
  dados jsonb NOT NULL,
  autor_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bia_id, revisao)
);
