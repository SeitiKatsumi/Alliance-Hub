-- Operator-only: install on the isolated consolidated copy, never at app startup.
-- Contains private row snapshots. No grants to application/browser roles.
BEGIN;
CREATE SCHEMA built_migration;
REVOKE ALL ON SCHEMA built_migration FROM PUBLIC;
CREATE TABLE built_migration.control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  state text NOT NULL CHECK (state = 'isolated-rehearsal')
);
INSERT INTO built_migration.control (state) VALUES ('isolated-rehearsal');
CREATE TABLE built_migration.changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id bigint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  schema_name text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  before_row jsonb,
  after_row jsonb
);
CREATE FUNCTION built_migration.capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO built_migration.changes
    (transaction_id, schema_name, table_name, operation, before_row, after_row)
  VALUES (txid_current(), TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN NULL;
END;
$$;
CREATE FUNCTION built_migration.forbid_destructive_operation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Migration rehearsal: destructive operation requires an explicit recovery procedure';
END;
$$;
REVOKE ALL ON FUNCTION built_migration.capture() FROM PUBLIC;
REVOKE ALL ON FUNCTION built_migration.forbid_destructive_operation() FROM PUBLIC;
CREATE TRIGGER preserve_changes BEFORE UPDATE OR DELETE OR TRUNCATE
  ON built_migration.changes FOR EACH STATEMENT
  EXECUTE FUNCTION built_migration.forbid_destructive_operation();
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('public', 'built_legacy', 'asaas_sandbox',
      'asaas_production', 'pinbank_dev', 'pinbank_production')
  LOOP
    EXECUTE format('CREATE TRIGGER built_migration_capture AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION built_migration.capture()', item.schemaname, item.tablename);
    EXECUTE format('CREATE TRIGGER built_migration_no_truncate BEFORE TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION built_migration.forbid_destructive_operation()', item.schemaname, item.tablename);
  END LOOP;
END;
$$;
COMMIT;
