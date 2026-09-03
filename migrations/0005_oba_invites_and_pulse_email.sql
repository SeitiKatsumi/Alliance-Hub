ALTER TABLE convites_link ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE convites_link ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE convites_link ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS convites_link_token_hash_uniq
  ON convites_link (token_hash)
  WHERE token_hash IS NOT NULL;

DROP INDEX IF EXISTS idx_opportunity_delivery_dedupe;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_delivery_dedupe
  ON opportunity_distribution_deliveries (wave_id, membro_id, canal)
  WHERE membro_id IS NOT NULL;
