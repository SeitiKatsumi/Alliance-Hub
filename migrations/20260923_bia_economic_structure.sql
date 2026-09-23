-- Additive only: existing snapshots and signed documents remain unchanged.
ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS estrutura_economica jsonb;
