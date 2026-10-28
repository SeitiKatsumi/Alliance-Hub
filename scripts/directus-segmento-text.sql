-- Apply only to the Directus database, not the application database.
-- Widening preserves every existing selection and leaves phone/acceptances intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF current_database() <> 'appbuiltalliances_directus' THEN
    RAISE EXCEPTION 'Wrong database: expected appbuiltalliances_directus';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cadastro_geral'
      AND column_name='segmento' AND data_type IN ('character varying','text')) THEN
    RAISE EXCEPTION 'Unexpected segmento schema';
  END IF;
END $$;
ALTER TABLE public.cadastro_geral ALTER COLUMN segmento TYPE text;
COMMIT;
