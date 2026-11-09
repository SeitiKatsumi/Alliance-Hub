-- Isolamento por ambiente; nenhuma conta, chave, pagamento ou backfill financeiro é criado.
CREATE TABLE IF NOT EXISTS bia_bank_choices (
  bia_id text NOT NULL, environment text NOT NULL CHECK(environment IN ('sandbox','production')),
  choice text NOT NULL CHECK(choice IN ('asaas','external')), actor_id text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(bia_id,environment)
);
CREATE TABLE IF NOT EXISTS bia_bank_connections (
  id uuid PRIMARY KEY, bia_id text NOT NULL, environment text NOT NULL CHECK(environment IN ('sandbox','production')),
  bank text NOT NULL, account_kind text NOT NULL CHECK(account_kind IN ('PF','PJ')), method text NOT NULL CHECK(method IN ('direct','pluggy')),
  actor_id text NOT NULL, state text NOT NULL CHECK(state IN ('authorizing','connected','attention','disconnected')),
  account_key text, masked_account text, secret jsonb, profile_id text, binding_hash text,
  activated_at timestamptz, auto_enabled boolean NOT NULL DEFAULT false, auto_actor text,
  last_success_at timestamptz, next_sync_at timestamptz NOT NULL DEFAULT now(), error_code text,
  lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_account_exclusive ON bia_bank_connections(environment,account_key) WHERE state<>'disconnected' AND account_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_connection_per_bia ON bia_bank_connections(environment,bia_id) WHERE state<>'disconnected';
CREATE TABLE IF NOT EXISTS bia_bank_receipts (
  id uuid PRIMARY KEY, connection_id uuid NOT NULL REFERENCES bia_bank_connections(id), bia_id text NOT NULL, environment text NOT NULL,
  transaction_key text NOT NULL, receipt jsonb NOT NULL, candidates jsonb NOT NULL DEFAULT '[]',
  state text NOT NULL CHECK(state IN ('unmatched','suggested','applying','reconciled','review')),
  flow_id text, decision_actor text, automatic boolean NOT NULL DEFAULT false, error_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment,transaction_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_flow_once ON bia_bank_receipts(environment,flow_id) WHERE state IN ('applying','reconciled');
CREATE TABLE IF NOT EXISTS bia_bank_events (
  id uuid PRIMARY KEY, environment text NOT NULL, provider text NOT NULL, event_key text NOT NULL,
  connection_id uuid REFERENCES bia_bank_connections(id), action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment,provider,event_key)
);
CREATE INDEX IF NOT EXISTS bank_receipts_bia ON bia_bank_receipts(environment,bia_id,created_at DESC);
ALTER TABLE bia_bank_connections ADD COLUMN IF NOT EXISTS sync_cursor text;
ALTER TABLE bia_bank_connections ADD COLUMN IF NOT EXISTS sync_from timestamptz;
ALTER TABLE bia_bank_connections ADD COLUMN IF NOT EXISTS sync_to timestamptz;
ALTER TABLE bia_bank_receipts ADD COLUMN IF NOT EXISTS previous_status text;
