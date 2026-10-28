-- Additive only: original expenses and historical lots remain unchanged.
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS despesa_existente_id text;
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS origem_versao text;
ALTER TABLE bia_despesa_aportes ADD COLUMN IF NOT EXISTS rateio jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS bia_despesa_aportes_origem_unica
 ON bia_despesa_aportes(despesa_existente_id) WHERE despesa_existente_id IS NOT NULL;
