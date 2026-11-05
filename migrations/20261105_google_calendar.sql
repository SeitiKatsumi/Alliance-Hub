CREATE TABLE IF NOT EXISTS google_calendar_connections (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, agenda_user_id text NOT NULL, credentials jsonb NOT NULL, google_sub text NOT NULL, email text NOT NULL,
 time_zone text NOT NULL, status text NOT NULL DEFAULT 'connected', error_code text,
 last_sync timestamptz, last_attempt timestamptz, lease_id text, lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS agenda_user_id text;
UPDATE google_calendar_connections SET agenda_user_id=user_id WHERE agenda_user_id IS NULL;
ALTER TABLE google_calendar_connections ALTER COLUMN agenda_user_id SET NOT NULL;
CREATE TABLE IF NOT EXISTS google_calendar_event_links (
 user_id text NOT NULL REFERENCES google_calendar_connections(user_id) ON DELETE CASCADE,
 task_id text NOT NULL, google_event_id text NOT NULL, fingerprint text NOT NULL DEFAULT '',
 PRIMARY KEY(user_id,task_id), UNIQUE(user_id,google_event_id)
);
