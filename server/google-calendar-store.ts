import { sql } from 'drizzle-orm';
import { CalendarError } from './google-calendar-domain';

export const GOOGLE_CALENDAR_SCHEMA_SQL = `
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
);`;
export class GoogleCalendarStore {
  private initialized?: Promise<void>;
  constructor(private db: { execute: (query: any) => Promise<any> }) {}
  async ensure() {
    this.initialized ||= (async () => {
      for (const statement of GOOGLE_CALENDAR_SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean)) await this.db.execute(sql.raw(statement));
    })().catch(error => { this.initialized = undefined; throw error; });
    return this.initialized;
  }
  async get(user: string) { await this.ensure(); return (await this.db.execute(sql`SELECT * FROM google_calendar_connections WHERE user_id=${user}`)).rows[0]; }
  async connect(user: string, credentials: unknown, sub: string, email: string, zone: string, agendaUser = user) {
    await this.ensure();
    const result = await this.db.execute(sql`INSERT INTO google_calendar_connections(user_id,agenda_user_id,credentials,google_sub,email,time_zone)
      VALUES(${user},${agendaUser},${JSON.stringify(credentials)}::jsonb,${sub},${email},${zone})
      ON CONFLICT(user_id) DO UPDATE SET agenda_user_id=EXCLUDED.agenda_user_id,credentials=EXCLUDED.credentials,google_sub=EXCLUDED.google_sub,email=EXCLUDED.email,
      time_zone=EXCLUDED.time_zone,status='connected',error_code=NULL,updated_at=now()
      WHERE google_calendar_connections.lease_until IS NULL OR google_calendar_connections.lease_until<now() RETURNING user_id`);
    if (!result.rows.length) throw new CalendarError('busy', 409);
  }
  async acquire(user: string, lease: string) {
    await this.ensure();
    const row = (await this.db.execute(sql`UPDATE google_calendar_connections SET lease_id=${lease},lease_until=now()+interval '5 minutes',last_attempt=now()
      WHERE user_id=${user} AND (lease_until IS NULL OR lease_until<now()) RETURNING *`)).rows[0];
    if (!row) throw new CalendarError('busy', 409); return row;
  }
  async release(user: string, lease: string) { await this.db.execute(sql`UPDATE google_calendar_connections SET lease_id=NULL,lease_until=NULL WHERE user_id=${user} AND lease_id=${lease}`); }
  async credentials(user: string, lease: string, value: unknown) { await this.db.execute(sql`UPDATE google_calendar_connections SET credentials=${JSON.stringify(value)}::jsonb,updated_at=now() WHERE user_id=${user} AND lease_id=${lease}`); }
  async result(user: string, lease: string, code: string | null, completed = false) {
    await this.db.execute(sql`UPDATE google_calendar_connections SET error_code=${code},status=${code === 'reconnect' ? 'reconnect' : 'connected'},last_sync=CASE WHEN ${completed} THEN now() ELSE last_sync END WHERE user_id=${user} AND lease_id=${lease}`);
  }
  async disconnect(user: string, lease: string) { await this.db.execute(sql`DELETE FROM google_calendar_connections WHERE user_id=${user} AND lease_id=${lease}`); }
  async tasks(user: string) {
    const rows = (await this.db.execute(sql`SELECT id,titulo,descricao,data,hora,status FROM agenda_tarefas WHERE user_id=${user} ORDER BY data DESC,id LIMIT 5001`)).rows;
    if (rows.length > 5000) throw new CalendarError('limit', 422); return rows;
  }
  async links(user: string) { return (await this.db.execute(sql`SELECT * FROM google_calendar_event_links WHERE user_id=${user}`)).rows; }
  async saveLink(user: string, task: string, event: string, hash: string) {
    await this.db.execute(sql`INSERT INTO google_calendar_event_links(user_id,task_id,google_event_id,fingerprint) VALUES(${user},${task},${event},${hash})
      ON CONFLICT(user_id,task_id) DO UPDATE SET google_event_id=EXCLUDED.google_event_id,fingerprint=EXCLUDED.fingerprint`);
  }
  async removeLink(user: string, task: string) { await this.db.execute(sql`DELETE FROM google_calendar_event_links WHERE user_id=${user} AND task_id=${task}`); }
  async attempted(user: string) { await this.db.execute(sql`UPDATE google_calendar_connections SET last_attempt=now() WHERE user_id=${user}`); }
  async users() { await this.ensure(); return (await this.db.execute(sql`SELECT user_id FROM google_calendar_connections WHERE status='connected' ORDER BY last_attempt NULLS FIRST LIMIT 100`)).rows.map((r: any) => r.user_id as string); }
}
