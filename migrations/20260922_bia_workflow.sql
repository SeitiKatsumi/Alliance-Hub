CREATE TABLE IF NOT EXISTS bia_estruturacao_rascunhos (
 bia_id text PRIMARY KEY, autor_id text NOT NULL, revisao integer NOT NULL DEFAULT 1,
 dados jsonb NOT NULL, concluido boolean NOT NULL DEFAULT false,
 atualizado_em timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_fase_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text NOT NULL,
 evento_id text NOT NULL, fase_anterior text NOT NULL, fase text NOT NULL,
 motivo text NOT NULL, autor jsonb NOT NULL, aplicado boolean NOT NULL DEFAULT false,
 criado_em timestamp NOT NULL DEFAULT now(), UNIQUE(bia_id,evento_id)
);
ALTER TABLE bia_estruturacao_rascunhos ADD COLUMN IF NOT EXISTS conclusao_iniciada boolean NOT NULL DEFAULT false;
