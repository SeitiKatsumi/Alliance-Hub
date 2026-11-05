import { CalendarError, GOOGLE_CALENDAR_SCOPE, nextCalendarDate, type CalendarToken } from './google-calendar-domain';

export class GoogleCalendarClient {
  constructor(private config: { clientId: string; clientSecret: string; redirect: string }, private request: typeof fetch = fetch) {}
  private async json(url: string, init: RequestInit) {
    let response: Response;
    try { response = await this.request(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(12000) }); }
    catch { throw new CalendarError('unavailable'); }
    if (!response.ok) {
      if (response.status === 401) throw new CalendarError('reconnect', 401);
      if (response.status === 403) throw new CalendarError('google_permission', 403);
      if (response.status === 404 || response.status === 410) throw new CalendarError('not_found', 404);
      if (response.status === 409) throw new CalendarError('exists', 409);
      if (response.status === 400 && url.endsWith('/token')) throw new CalendarError('reconnect', 401);
      throw new CalendarError('unavailable');
    }
    return response.status === 204 ? {} : response.json();
  }
  async exchange(code: string, verifier: string) {
    const data = await this.json('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code, code_verifier: verifier, client_id: this.config.clientId, client_secret: this.config.clientSecret, redirect_uri: this.config.redirect, grant_type: 'authorization_code' }) });
    if (!String(data.scope || '').split(' ').includes(GOOGLE_CALENDAR_SCOPE) || !data.access_token || !data.refresh_token) throw new CalendarError('consent', 400);
    return { access_token: String(data.access_token), refresh_token: String(data.refresh_token), expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 };
  }
  async refresh(token: CalendarToken): Promise<CalendarToken> {
    if (token.expires_at > Date.now() + 60000) return token;
    const data = await this.json('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: token.refresh_token, grant_type: 'refresh_token' }) });
    if (!data.access_token) throw new CalendarError('reconnect', 401);
    return { access_token: String(data.access_token), refresh_token: String(data.refresh_token || token.refresh_token), expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 };
  }
  async identity(token: CalendarToken) {
    const data = await this.json('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!data.sub || !data.email || data.email_verified !== true) throw new CalendarError('identity', 400);
    return { sub: String(data.sub), email: String(data.email) };
  }
  async calendar(token: CalendarToken, path: string, method = 'GET', body?: unknown) {
    return this.json(`https://www.googleapis.com/calendar/v3/calendars/primary${path}`, {
      method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async list(token: CalendarToken, from: string, to: string, timeZone: string) {
    const items: any[] = []; let page = ''; const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const params = new URLSearchParams({ timeMin: `${nextCalendarDate(from, -1)}T00:00:00Z`, timeMax: `${nextCalendarDate(to)}T00:00:00Z`, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone });
      if (page) params.set('pageToken', page);
      const data = await this.calendar(token, `/events?${params}`);
      if (!Array.isArray(data.items)) throw new CalendarError('unavailable');
      items.push(...data.items); page = String(data.nextPageToken || '');
      if (!page) return { items, partial: false };
      if (seen.has(page)) throw new CalendarError('unavailable'); seen.add(page);
    }
    return { items, partial: true };
  }
}
