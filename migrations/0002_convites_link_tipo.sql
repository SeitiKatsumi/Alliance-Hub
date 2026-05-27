ALTER TABLE "convites_link"
ADD COLUMN IF NOT EXISTS "tipo" text DEFAULT 'vitrine' NOT NULL;
