-- Base aditiva; não modifica registros ou migrações dos provedores anteriores.
CREATE SCHEMA IF NOT EXISTS asaas_sandbox;
CREATE SCHEMA IF NOT EXISTS asaas_production;
DO $$
DECLARE namespace text;
BEGIN
  FOREACH namespace IN ARRAY ARRAY['asaas_sandbox', 'asaas_production'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.accounts (
      id uuid PRIMARY KEY,
      label text NOT NULL,
      ownership text NOT NULL DEFAULT ''undetermined'' CHECK (ownership IN (''undetermined'',''platform'',''company'',''bia'')),
      owner_id text,
      external_account_id text UNIQUE,
      wallet_id text UNIQUE,
      credential_reference text,
      state text NOT NULL DEFAULT ''draft'' CHECK (state IN (''draft'',''pending'',''in_review'',''approved'',''rejected'',''blocked'')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )', namespace);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.bia_accounts (
      bia_id text PRIMARY KEY, account_id uuid NOT NULL REFERENCES %I.accounts(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )', namespace, namespace);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.operations (
      id uuid PRIMARY KEY, scope_key text NOT NULL, bia_id text,
      account_id uuid REFERENCES %I.accounts(id), actor_id text NOT NULL,
      kind text NOT NULL, amount_cents bigint NOT NULL CHECK (amount_cents >= 0 AND amount_cents <= 9007199254740991),
      external_reference text NOT NULL, external_id text,
      idempotency_key text NOT NULL, request_hash text NOT NULL,
      state text NOT NULL DEFAULT ''prepared'' CHECK (state IN (''prepared'',''sent'',''pending'',''unknown'',''completed'',''rejected'',''cancelled'')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(scope_key,idempotency_key)
    )', namespace, namespace);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.events (
      event_id text PRIMARY KEY, event_type text NOT NULL, source_account_id text,
      entity_type text, entity_id text, body_hash text NOT NULL, summary jsonb NOT NULL,
      state text NOT NULL DEFAULT ''received'' CHECK (state IN (''received'',''processed'',''failed'')),
      attempts integer NOT NULL DEFAULT 0, received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz, error_code text
    )', namespace);
  END LOOP;
END $$;
