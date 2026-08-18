ALTER TABLE "user_account_purposes"
ADD COLUMN IF NOT EXISTS "objectives" jsonb DEFAULT '[]'::jsonb NOT NULL;
