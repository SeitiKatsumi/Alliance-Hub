import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export interface CalendarAccount { userId: string; agendaUserId: string }
// Legacy signed sessions can own Agenda rows under a former Directus ID.
// Credentials belong to the current, unique local account; the source ID comes only from the session.
export async function resolveCalendarAccount(session: any, users: {
  getUser(id: string): Promise<any>; getUsersByEmail(email: string): Promise<any[]>;
}): Promise<CalendarAccount | null> {
  const source = String(session?.directusUserId || session?.userId || '');
  if (!source) return null;
  let user = await users.getUser(source);
  if (!user && session?.email) {
    const matches = await users.getUsersByEmail(String(session.email));
    if (matches.length !== 1) return null;
    user = matches[0];
    if (session.membroId && user.membro_directus_id && String(session.membroId) !== String(user.membro_directus_id)) return null;
  }
  return user?.ativo ? { userId: String(user.id), agendaUserId: source } : null;
}
export class CalendarError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export function calendarConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID || env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '';
  const key = env.GOOGLE_CALENDAR_ENCRYPTION_KEY || '';
  const redirect = env.GOOGLE_CALENDAR_REDIRECT_URI || (env.NODE_ENV === 'production'
    ? env.GOOGLE_CALLBACK_URL || `${(env.APP_URL || '').replace(/\/$/, '')}/auth/google/callback`
    : `http://localhost:${env.PORT || '3004'}/auth/google/callback`);
  let origin = '', validRedirect = false;
  try { const u = new URL(redirect); origin = u.origin; validRedirect = u.pathname === '/auth/google/callback' && !u.search && !u.hash && !u.username && !u.password && (u.protocol === 'https:' || (env.NODE_ENV !== 'production' && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))); } catch {}
  const ready = env.BUILT_ISOLATED_STAGE !== '1' && !!clientId && !!clientSecret && /^[a-f\d]{64}$/i.test(key) && validRedirect;
  return { clientId, clientSecret, key, redirect, origin, ready };
}
export function sealCalendarToken(value: unknown, key: string) {
  if (!/^[a-f\d]{64}$/i.test(key)) throw new CalendarError('configuration');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
}
export function openCalendarToken(value: any, key: string): CalendarToken {
  try {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(value.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
  } catch { throw new CalendarError('credential'); }
}
export interface CalendarToken { access_token: string; refresh_token: string; expires_at: number }
export const calendarOwner = (userId: string, sub: string) => createHash('sha256').update(`built-calendar:${userId}:${sub}`).digest('hex');
export const calendarEventId = (owner: string, taskId: string) => 'b' + createHash('sha256').update(`${owner}:${taskId}`).digest('hex');
export const calendarHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function nextCalendarDate(date: string, days = 1) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function builtCalendarEvent(task: any, owner: string, timeZone: string, origin: string) {
  const date = task.data instanceof Date ? task.data.toISOString().slice(0, 10) : String(task.data).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || nextCalendarDate(date, 0) !== date) throw new CalendarError('invalid_task', 422);
  const hora = String(task.hora || '').slice(0, 5);
  let start: any = { date }, end: any = { date: nextCalendarDate(date) };
  if (hora) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new CalendarError('invalid_task', 422);
    const minutes = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + 60;
    const endDate = minutes >= 1440 ? nextCalendarDate(date) : date;
    const endHour = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    start = { dateTime: `${date}T${hora}:00`, timeZone }; end = { dateTime: `${endDate}T${endHour}:00`, timeZone };
  }
  return {
    summary: String(task.titulo || 'Compromisso BUILT').slice(0, 1000),
    description: `${String(task.descricao || '').slice(0, 6000)}\n\nBUILT · ${task.status === 'concluida' ? 'Concluída' : 'Compromisso'}\nGerencie este compromisso na BUILT: ${origin}/agenda-alertas?view=agenda&task=${encodeURIComponent(task.id)}`,
    start, end, visibility: 'private', transparency: hora ? 'opaque' : 'transparent',
    extendedProperties: { private: { builtOwner: owner, builtTask: String(task.id) } },
  };
}
export interface GoogleAgendaEntry { id: string; titulo: string; descricao: string; data: string; hora: string | null; status: 'pendente'; prioridade: 'media'; google_url: string; google_event: true }
/** Display-only entries; never become shared platform tasks, alerts or financial obligations. */
export function googleAgendaEntries(items: any[], owner: string, from: string, to: string, timeZone: string): GoogleAgendaEntry[] {
  const entries: GoogleAgendaEntry[] = [];
  const parts = (value: string) => {
    const dt = new Date(value); if (Number.isNaN(dt.getTime())) return null;
    const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dt);
    const v = (name: string) => p.find(x => x.type === name)?.value;
    return { date: `${v('year')}-${v('month')}-${v('day')}`, hour: `${v('hour')}:${v('minute')}` };
  };
  for (const item of items) {
    if (!item.id || item.status === 'cancelled' || item.extendedProperties?.private?.builtOwner === owner) continue;
    const allDay = !!item.start?.date;
    const start = allDay ? { date: item.start.date, hour: null } : parts(item.start?.dateTime);
    const end = allDay ? item.end?.date : parts(item.end?.dateTime)?.date;
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start.date)) continue;
    let url = ''; try { const u = new URL(item.htmlLink); if (u.protocol === 'https:' && u.hostname === 'calendar.google.com') url = u.href; } catch {}
    let date = start.date < from ? from : start.date;
    // Google all-day end is exclusive. Timed events ending exactly at midnight are also exclusive.
    const endsAtMidnight = !allDay && parts(item.end?.dateTime)?.hour === '00:00';
    const last = end && (allDay || endsAtMidnight) ? nextCalendarDate(end, -1) : end || start.date;
    for (let i = 0; date < to && date <= last && i < 370; date = nextCalendarDate(date), i++) {
      entries.push({ id: `google:${item.id}:${date}`, titulo: `[Google] ${String(item.summary || 'Ocupado').slice(0, 1000)}`, descricao: String(item.description || '').replace(/<[^>]*>/g, '').slice(0, 3000), data: date, hora: date === start.date ? start.hour : null, status: 'pendente', prioridade: 'media', google_url: url, google_event: true });
    }
  }
  return entries;
}
