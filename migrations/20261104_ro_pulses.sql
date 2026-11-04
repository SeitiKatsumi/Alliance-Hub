CREATE TABLE IF NOT EXISTS ro_pulse_flows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL UNIQUE REFERENCES opportunity_meetings(id),
 creator_user_id text NOT NULL, creator_member_id text, intervalo_horas integer NOT NULL CHECK(intervalo_horas BETWEEN 1 AND 168),
 config jsonb NOT NULL, status text NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','pausado','concluido')),
 next_at timestamptz, reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ro_pulse_waves (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flow_id uuid NOT NULL REFERENCES ro_pulse_flows(id),
 ordem integer NOT NULL, stage text NOT NULL CHECK(stage IN ('origem','regional','nacional','global')),
 community_ids jsonb NOT NULL, status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','processando','executada','cancelada')),
 lease_id uuid, executed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(flow_id,ordem)
);
CREATE TABLE IF NOT EXISTS ro_pulse_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wave_id uuid NOT NULL REFERENCES ro_pulse_waves(id),
 meeting_id uuid NOT NULL REFERENCES opportunity_meetings(id), user_id text, member_id text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('interna','email')), state text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(wave_id,member_id,channel)
);
CREATE INDEX IF NOT EXISTS ro_pulse_due ON ro_pulse_flows(next_at) WHERE status='ativo';
CREATE INDEX IF NOT EXISTS ro_pulse_inbox ON ro_pulse_deliveries(user_id,member_id) WHERE channel='interna';
