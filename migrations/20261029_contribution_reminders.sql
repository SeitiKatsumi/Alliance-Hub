CREATE TABLE IF NOT EXISTS bia_aporte_reminder_settings (
 flow_id text PRIMARY KEY, bia_id text NOT NULL, settings jsonb NOT NULL,
 actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bia_aporte_reminder_deliveries (
 id uuid PRIMARY KEY, flow_id text NOT NULL REFERENCES bia_aporte_reminder_settings(flow_id),
 due_date date NOT NULL,payer_id text NOT NULL,kind text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','agenda')),
 state text NOT NULL DEFAULT 'queued',attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(flow_id,due_date,payer_id,kind,channel)
);
