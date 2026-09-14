--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS pinbank_dev;
CREATE SCHEMA IF NOT EXISTS pinbank_production;
CREATE TABLE IF NOT EXISTS pinbank_dev.operations (
  id uuid PRIMARY KEY, origin_nsu bigint GENERATED ALWAYS AS IDENTITY UNIQUE, actor_id text NOT NULL, scope_id text NOT NULL,
  method text NOT NULL, idempotency_key text NOT NULL, request_hash text NOT NULL,
  request jsonb NOT NULL, confirmation_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('preparing','completed','prepared','sending','pending','unknown','settled','rejected','cancelled','refunded')),
  quote jsonb, preview jsonb, origin_client bigint, origin_channel bigint,
  provider_id text, result jsonb, sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS pinbank_dev.events (
  event_id text PRIMARY KEY, event_type text NOT NULL, entity_id text NOT NULL,
  occurred_at timestamptz NOT NULL, body bytea NOT NULL, body_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0, error_code text
);
CREATE TABLE IF NOT EXISTS pinbank_production.operations (LIKE pinbank_dev.operations INCLUDING ALL);
CREATE TABLE IF NOT EXISTS pinbank_production.events (LIKE pinbank_dev.events INCLUDING ALL);
ALTER TABLE pinbank_dev.operations ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
ALTER TABLE pinbank_dev.operations ADD COLUMN IF NOT EXISTS reconciliation_error text;
ALTER TABLE pinbank_production.operations ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
ALTER TABLE pinbank_production.operations ADD COLUMN IF NOT EXISTS reconciliation_error text;
CREATE TABLE IF NOT EXISTS pinbank_dev.operation_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id uuid NOT NULL, actor_id text NOT NULL, previous_state text,
  next_state text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pinbank_production.operation_history (LIKE pinbank_dev.operation_history INCLUDING ALL);
CREATE OR REPLACE FUNCTION pinbank_dev.record_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
    EXECUTE format('INSERT INTO %I.operation_history(operation_id,actor_id,previous_state,next_state) VALUES ($1,$2,$3,$4)', TG_TABLE_SCHEMA)
      USING NEW.id, NEW.actor_id, CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.state END, NEW.state;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pinbank_transition ON pinbank_dev.operations;
CREATE TRIGGER pinbank_transition AFTER INSERT OR UPDATE ON pinbank_dev.operations FOR EACH ROW EXECUTE FUNCTION pinbank_dev.record_transition();
DROP TRIGGER IF EXISTS pinbank_transition ON pinbank_production.operations;
CREATE TRIGGER pinbank_transition AFTER INSERT OR UPDATE ON pinbank_production.operations FOR EACH ROW EXECUTE FUNCTION pinbank_dev.record_transition();
CREATE INDEX IF NOT EXISTS pinbank_dev_pending ON pinbank_dev.operations(updated_at) WHERE state IN ('sending','pending','unknown');
CREATE INDEX IF NOT EXISTS pinbank_dev_inbox ON pinbank_dev.events(received_at) WHERE processed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pinbank_dev_unresolved_payout ON pinbank_dev.operations(scope_id,request_hash)
  WHERE method LIKE 'payout_%' AND state IN ('preparing','prepared','sending','pending','unknown');
CREATE UNIQUE INDEX IF NOT EXISTS pinbank_production_unresolved_payout ON pinbank_production.operations(scope_id,request_hash)
  WHERE method LIKE 'payout_%' AND state IN ('preparing','prepared','sending','pending','unknown');
CREATE TABLE IF NOT EXISTS pinbank_production.execution_grants (
  bia_id text NOT NULL, member_id text NOT NULL, granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  PRIMARY KEY(bia_id,member_id)
);
CREATE TABLE IF NOT EXISTS pinbank_production.permission_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, bia_id text NOT NULL,
  member_id text NOT NULL, actor_id text NOT NULL, enabled boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pinbank_production.account_bindings (
  bia_id text PRIMARY KEY, codigo_cliente bigint NOT NULL UNIQUE,
  classified_by text NOT NULL, classified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pinbank_dev.term_acceptances (
  id uuid NOT NULL, actor_id text NOT NULL, version text NOT NULL, content_hash text NOT NULL,
  content text NOT NULL, accepted_at timestamptz NOT NULL, PRIMARY KEY(id,actor_id)
);
CREATE TABLE IF NOT EXISTS pinbank_production.term_acceptances (LIKE pinbank_dev.term_acceptances INCLUDING ALL);
-- Never infer the environment of financial evidence from hostnames or current credentials.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['bia_bank_accounts','bia_bank_documents','bia_bank_charges'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS bank_environment text NOT NULL DEFAULT ''unknown''',t);
    END IF;
  END LOOP;
END $$;
