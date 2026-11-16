ALTER TABLE opa_interesses
  ADD COLUMN IF NOT EXISTS vaga_id text,
  ADD COLUMN IF NOT EXISTS vaga_bia_id text,
  ADD COLUMN IF NOT EXISTS vaga_status text,
  ADD COLUMN IF NOT EXISTS oferta_revisao integer;

CREATE INDEX IF NOT EXISTS opa_interesses_vaga_idx
  ON opa_interesses (vaga_bia_id, vaga_id, vaga_status)
  WHERE vaga_id IS NOT NULL;
