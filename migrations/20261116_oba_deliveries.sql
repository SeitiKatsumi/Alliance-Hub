CREATE TABLE IF NOT EXISTS oba_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL REFERENCES opportunity_registry(id),
  membro_id text NOT NULL,
  membro_nome text NOT NULL,
  escopo text NOT NULL,
  relato_entrega text,
  status text NOT NULL DEFAULT 'em_acompanhamento'
    CHECK (status IN ('em_acompanhamento', 'aguardando_aprovacao_cpp')),
  criado_por text NOT NULL,
  validado_por text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  validado_em timestamptz,
  UNIQUE (registry_id, membro_id, escopo)
);
CREATE INDEX IF NOT EXISTS oba_entregas_registry_idx ON oba_entregas (registry_id, criado_em);
