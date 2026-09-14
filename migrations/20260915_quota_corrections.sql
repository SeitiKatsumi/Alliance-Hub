ALTER TABLE transferencias_cotas ADD COLUMN IF NOT EXISTS correcoes jsonb NOT NULL DEFAULT '[]'::jsonb;
