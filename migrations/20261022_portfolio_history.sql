CREATE TABLE IF NOT EXISTS carteira_patrimonio_observacoes (
  user_id text NOT NULL,
  membro_id text NOT NULL DEFAULT '',
  scope text NOT NULL,
  day date NOT NULL,
  metrics jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, membro_id, scope, day)
);
