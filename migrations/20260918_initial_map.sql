CREATE TABLE IF NOT EXISTS bia_map_inicial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bia_id text NOT NULL UNIQUE,
  origem_id uuid REFERENCES bia_imovel_origens(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'bloqueado')),
  valor_origem numeric(18,5) NOT NULL DEFAULT 0 CHECK (valor_origem >= 0),
  moeda text NOT NULL DEFAULT 'BRL',
  divisor_multiplicador numeric(12,5) NOT NULL DEFAULT 0 CHECK (divisor_multiplicador >= 0),
  base_economica_inicial numeric(18,5) NOT NULL DEFAULT 0 CHECK (base_economica_inicial >= 0),
  participantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_hash text,
  criado_por_user_id text,
  criado_por_membro_id text,
  bloqueado_por_user_id text,
  bloqueado_por_membro_id text,
  criado_em timestamp DEFAULT now() NOT NULL,
  atualizado_em timestamp DEFAULT now() NOT NULL,
  bloqueado_em timestamp
);

CREATE INDEX IF NOT EXISTS idx_bia_map_inicial_status ON bia_map_inicial_snapshots (bia_id, status);

ALTER TABLE bia_mou_aceites ADD COLUMN IF NOT EXISTS map_inicial_snapshot_id text;
ALTER TABLE bia_mou_aceites ADD COLUMN IF NOT EXISTS map_inicial_hash text;
