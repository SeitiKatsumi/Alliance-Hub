-- Explicit operator step on built_stage; not in the production auto-migration directory.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM built_migration.control WHERE state='isolated-rehearsal') THEN
    RAISE EXCEPTION 'An isolated migration copy is required';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS built_legacy.land_bank_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), local_id text NOT NULL UNIQUE,
  category text NOT NULL, bia_id text, bia_nome text, data jsonb, created_by_membro text,
  date_created timestamptz DEFAULT now(), date_updated timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS built_legacy.estudos_viabilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text, alianca_tipo text,
  tipo_documento text, descricao text, membro_responsavel text, arquivo_ids jsonb,
  date_created timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS built_legacy.nucleo_tecnico_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bia_id text, alianca_tipo text,
  tipo_documento text, descricao text, membro_responsavel text, arquivo_ids jsonb,
  date_created timestamptz DEFAULT now()
);
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT schemaname,tablename FROM pg_tables
    WHERE schemaname IN ('public','built_legacy','asaas_sandbox','asaas_production','pinbank_dev','pinbank_production')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('%I.%I',item.schemaname,item.tablename)::regclass AND tgname='built_migration_capture') THEN
      EXECUTE format('CREATE TRIGGER built_migration_capture AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION built_migration.capture()',item.schemaname,item.tablename);
      EXECUTE format('CREATE TRIGGER built_migration_no_truncate BEFORE TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION built_migration.forbid_destructive_operation()',item.schemaname,item.tablename);
    END IF;
  END LOOP;
END $$;
COMMIT;
