import type { Express, Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { CalendarError, GOOGLE_CALENDAR_SCOPE, nextCalendarDate, sealCalendarToken, type CalendarAccount } from './google-calendar-domain';
import { calendarMessages, GoogleCalendarService } from './google-calendar-service';

const agendaReturn = '/agenda-alertas?view=agenda';
const userId = (req: Request) => String((req as any).googleCalendarAccount?.userId || '');
const defaultAccount = async (req: Request): Promise<CalendarAccount | null> => {
  const id = String((req.session as any)?.directusUserId || (req.session as any)?.userId || '');
  return id ? { userId: id, agendaUserId: id } : null;
};
function errorResponse(res: Response, error: unknown) {
  const safe = error instanceof CalendarError ? error : new CalendarError('unavailable');
  res.status(safe.status).json({ error: calendarMessages[safe.code] || calendarMessages.unavailable, code: safe.code });
}
export function registerGoogleCalendarRoutes(app: Express, service: GoogleCalendarService, part: 'oauth' | 'api' = 'api', resolveAccount: (req: Request) => Promise<CalendarAccount | null> = defaultAccount) {
  const config = service.config;
  if (part === 'api') {
  app.use('/api/agenda/google', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { (req as any).googleCalendarAccount = await resolveAccount(req); } catch (e) { return errorResponse(res, e); }
    if (!userId(req)) return res.status(401).json({ error: 'Não autenticado' });
    if (!['GET', 'HEAD'].includes(req.method) && req.get('origin') !== config.origin) return res.status(403).json({ error: 'Origem da solicitação inválida.' });
    next();
  });
  app.get('/api/agenda/google/status', async (req, res) => {
    try { res.json(await service.status(userId(req))); } catch (e) { errorResponse(res, e); }
  });
  app.post('/api/agenda/google/connect', async (req, res) => {
    try {
      if (!config.ready) throw new CalendarError('configuration');
      if (!await service.authorize(userId(req))) throw new CalendarError('access', 403);
      const verifier = randomBytes(48).toString('base64url');
      (req.session as any).googleCalendar = { state: `gcal.${randomBytes(32).toString('base64url')}`, verifier, user: userId(req), agendaUser: (req as any).googleCalendarAccount.agendaUserId, expires: Date.now() + 10 * 60000 };
      req.session.save(error => error ? errorResponse(res, new CalendarError('unavailable')) : res.json({ redirect: '/auth/google/calendar' }));
    } catch (e) { errorResponse(res, e); }
  });
  }
  if (part === 'oauth') {
  app.get('/auth/google/calendar', async (req, res) => {
    try { (req as any).googleCalendarAccount = await resolveAccount(req); } catch { return res.redirect(`${agendaReturn}&google=unavailable`); }
    const pending = (req.session as any)?.googleCalendar;
    if (!config.ready || !userId(req) || pending?.user !== userId(req) || pending.agendaUser !== (req as any).googleCalendarAccount.agendaUserId || pending.expires < Date.now()) return res.redirect(`${agendaReturn}&google=expired`);
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirect, response_type: 'code', scope: `openid email ${GOOGLE_CALENDAR_SCOPE}`, access_type: 'offline', prompt: 'consent select_account', state: pending.state, code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'), code_challenge_method: 'S256' });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
  });
  // Registered BEFORE the Google sign-in callback: calendar consent never logs into or links another BUILT account.
  app.get('/auth/google/callback', async (req, res, next) => {
    const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
    if (!returnedState.startsWith('gcal.')) return next();
    res.set('Cache-Control', 'no-store');
    try { (req as any).googleCalendarAccount = await resolveAccount(req); } catch { return res.redirect(`${agendaReturn}&google=unavailable`); }
    const pending = (req.session as any)?.googleCalendar;
    const valid = config.ready && pending?.user === userId(req) && !!userId(req) && pending.agendaUser === (req as any).googleCalendarAccount.agendaUserId && pending?.expires > Date.now() && typeof pending.state === 'string' && Buffer.byteLength(pending.state) === Buffer.byteLength(returnedState) && timingSafeEqual(Buffer.from(pending.state), Buffer.from(returnedState));
    if (!valid) return res.redirect(`${agendaReturn}&google=expired`);
    delete (req.session as any).googleCalendar;
    // Consume the state durably before exchanging the authorization code; callbacks cannot be replayed.
    req.session.save(async error => {
      if (!valid || error) return res.redirect(`${agendaReturn}&google=expired`);
      if (req.query.error) return res.redirect(`${agendaReturn}&google=cancelled`);
      try {
        if (typeof req.query.code !== 'string' || req.query.code.length > 4096) throw new CalendarError('consent');
        if (!await service.authorize(userId(req))) throw new CalendarError('access', 403);
        const token = await service.client.exchange(req.query.code, pending.verifier);
        const identity = await service.client.identity(token);
        const metadata = await service.client.calendar(token, '/events?maxResults=1');
        const zone = String(metadata.timeZone || 'America/Sao_Paulo');
        new Intl.DateTimeFormat('en', { timeZone: zone }).format();
        await service.store.connect(userId(req), sealCalendarToken(token, config.key), identity.sub, identity.email, zone, pending.agendaUser);
        res.redirect(`${agendaReturn}&google=connected`);
      } catch (e) { const code = e instanceof CalendarError && calendarMessages[e.code] ? e.code : 'unavailable'; res.redirect(`${agendaReturn}&google=${code}`); }
    });
  });
  return;
  }
  app.get('/api/agenda/google/events', async (req, res) => {
    try {
      const from = String(req.query.from || ''), to = String(req.query.to || '');
      const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && nextCalendarDate(s, 0) === s;
      if (!validDate(from) || !validDate(to) || to <= from || Date.parse(to) - Date.parse(from) > 370 * 86400000) return res.status(400).json({ error: 'Período inválido.' });
      res.json(await service.events(userId(req), from, to));
    } catch (e) { errorResponse(res, e); }
  });
  app.post('/api/agenda/google/sync', async (req, res) => { try { res.json(await service.sync(userId(req))); } catch (e) { errorResponse(res, e); } });
  app.delete('/api/agenda/google/connection', async (req, res) => { try { await service.disconnect(userId(req)); res.json({ ok: true }); } catch (e) { errorResponse(res, e); } });
}
