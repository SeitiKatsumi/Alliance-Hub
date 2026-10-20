-- Additive. Not applied by a read/status request; existing obligations and financial snapshots remain intact.
CREATE TABLE IF NOT EXISTS bia_contribution_settings (
 bia_id text PRIMARY KEY, settings jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 actor_id text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_contribution_charges (
 id uuid PRIMARY KEY, environment text NOT NULL CHECK(environment IN ('sandbox','production')),
 parcel_id uuid NOT NULL REFERENCES bia_aportes_parcelas(id), bia_id text NOT NULL, payer_id text NOT NULL,
 flow_id text NOT NULL, account_id uuid, external_account_id text, external_id text,
 original_cents bigint NOT NULL CHECK(original_cents>0), amount_cents bigint NOT NULL CHECK(amount_cents>0 AND amount_cents<=9007199254740991),
 due_date date NOT NULL, version integer NOT NULL DEFAULT 1,
 job_state text NOT NULL DEFAULT 'queued' CHECK(job_state IN ('queued','creating','unknown','ready','blocked','sync')),
 payment_state text NOT NULL DEFAULT 'none', details jsonb NOT NULL DEFAULT '{}', pending_revision uuid,
 error_code text, paid_at date, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(environment,parcel_id), UNIQUE(environment,account_id,external_id)
);
CREATE INDEX IF NOT EXISTS bia_contribution_charges_queue ON bia_contribution_charges(environment,job_state,updated_at);
CREATE TABLE IF NOT EXISTS bia_contribution_customers (
 environment text NOT NULL, account_id uuid NOT NULL, payer_id text NOT NULL,
 external_id text, attempted boolean NOT NULL DEFAULT false, PRIMARY KEY(environment,account_id,payer_id)
);
CREATE TABLE IF NOT EXISTS bia_contribution_revisions (
 id uuid PRIMARY KEY, batch_id uuid NOT NULL, charge_id uuid NOT NULL REFERENCES bia_contribution_charges(id),
 bia_id text NOT NULL, environment text NOT NULL, actor_id text NOT NULL, reason text NOT NULL,
 before_cents bigint NOT NULL, after_cents bigint NOT NULL CHECK(after_cents>0), expected_version integer NOT NULL,
 request_hash text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','applied','failed','unknown')),
 error_code text, notified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
 UNIQUE(batch_id,charge_id)
);
CREATE TABLE IF NOT EXISTS bia_contribution_notices (
 id uuid PRIMARY KEY, charge_id uuid NOT NULL REFERENCES bia_contribution_charges(id), version integer NOT NULL,
 kind text NOT NULL, channel text NOT NULL CHECK(channel IN ('email','agenda')),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','unknown','suppressed')),
 attempts integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(charge_id,version,kind,channel)
);
