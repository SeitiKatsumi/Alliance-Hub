import { randomUUID } from 'node:crypto';
import { GoogleCalendarClient } from './google-calendar-client';
import { GoogleCalendarStore } from './google-calendar-store';
import { CalendarError, builtCalendarEvent, calendarEventId, calendarHash, calendarOwner, googleAgendaEntries, openCalendarToken, sealCalendarToken, type calendarConfig } from './google-calendar-domain';

export const calendarMessages: Record<string, string> = {
  configuration: 'A conexão com o Google Agenda ainda precisa ser configurada pela equipe BUILT.',
  reconnect: 'Reconecte o Google Agenda para continuar sincronizando.',
  google_permission: 'O Google não liberou o acesso à agenda. Confira a autorização e a ativação da Calendar API.',
  unavailable: 'Não foi possível consultar o Google Agenda agora. Tente novamente.',
  credential: 'A conexão precisa ser configurada novamente pela equipe BUILT.',
  busy: 'A agenda está sincronizando. Tente novamente em instantes.',
  consent: 'Autorize o acesso ao Google Agenda para conectar sua conta.',
  identity: 'Não foi possível confirmar a conta Google.',
  limit: 'Há muitos compromissos para sincronizar de uma vez. Entre em contato com a equipe BUILT.',
  partial: 'A sincronização continua no próximo ciclo. Você também pode sincronizar novamente.',
  invalid_task: 'Algumas ações têm data ou hora inválida e precisam ser corrigidas na plataforma.',
  ownership: 'Um compromisso não pôde ser conferido no Google. Nenhum evento de outra origem foi alterado.',
  access: 'Seu acesso à Agenda não está disponível.',
};
export class GoogleCalendarService {
  authorize: (user: string) => Promise<boolean> = async () => false;
  constructor(public store: GoogleCalendarStore, public client: GoogleCalendarClient, public config: ReturnType<typeof calendarConfig>) {}
  async status(user: string) {
    if (!await this.authorize(user)) throw new CalendarError('access', 403);
    const row = await this.store.get(user);
    return { ready: this.config.ready, connected: !!row, reconnect: row?.status === 'reconnect', email: row?.email || null, timeZone: row?.time_zone || null, lastSync: row?.last_sync || null, message: row?.error_code ? calendarMessages[row.error_code] || calendarMessages.unavailable : !this.config.ready ? calendarMessages.configuration : null };
  }
  async using<T>(user: string, action: (row: any, token: any, owner: string, lease: string) => Promise<T>): Promise<T> {
    if (!await this.authorize(user)) throw new CalendarError('access', 403);
    if (!this.config.ready) throw new CalendarError('configuration');
    if (!await this.store.get(user)) throw new CalendarError('reconnect', 401);
    const lease = randomUUID(), row = await this.store.acquire(user, lease);
    try {
      const previous = openCalendarToken(row.credentials, this.config.key);
      const token = await this.client.refresh(previous);
      if (token !== previous) await this.store.credentials(user, lease, sealCalendarToken(token, this.config.key));
      return await action(row, token, calendarOwner(user, row.google_sub), lease);
    } catch (error) {
      const code = error instanceof CalendarError ? error.code : 'unavailable';
      await this.store.result(user, lease, code); throw error instanceof CalendarError ? error : new CalendarError('unavailable');
    } finally { await this.store.release(user, lease); }
  }
  async events(user: string, from: string, to: string) {
    return this.using(user, async (row, token, owner) => {
      const result = await this.client.list(token, from, to, row.time_zone);
      return { entries: googleAgendaEntries(result.items, owner, from, to, row.time_zone), partial: result.partial, timeZone: row.time_zone };
    });
  }
  async sync(user: string) {
    return this.using(user, async (row, token, owner, lease) => {
      const tasks = await this.store.tasks(row.agenda_user_id), links = await this.store.links(user);
      const byTask = new Map(links.map((link: any) => [String(link.task_id), link]));
      const active = new Set<string>(); let changes = 0, partial = false, invalid = false;
      const started = Date.now();
      const available = () => changes < 50 && Date.now() - started < 45000;
      const own = (event: any, task: string) => event.extendedProperties?.private?.builtOwner === owner && event.extendedProperties?.private?.builtTask === task;
      for (const task of tasks) {
        if (task.status === 'cancelada') continue;
        active.add(String(task.id));
        if (!available()) { partial = true; continue; }
        const eventId = calendarEventId(owner, String(task.id));
        let body: any; try { body = builtCalendarEvent(task, owner, row.time_zone, this.config.origin); } catch { invalid = true; continue; }
        const hash = calendarHash(body), link = byTask.get(String(task.id)) as any;
        if (link?.fingerprint === hash && link.google_event_id === eventId) continue;
        let existing: any;
        try { existing = await this.client.calendar(token, `/events/${eventId}`); }
        catch (e) { if (!(e instanceof CalendarError) || e.code !== 'not_found') throw e; }
        if (existing) {
          if (!own(existing, String(task.id))) throw new CalendarError('ownership', 409);
          await this.client.calendar(token, `/events/${eventId}?sendUpdates=none`, 'PATCH', body);
        } else {
          try { await this.client.calendar(token, '/events?sendUpdates=none', 'POST', { id: eventId, ...body }); }
          catch (e) {
            if (!(e instanceof CalendarError) || e.code !== 'exists') throw e;
            const recovered = await this.client.calendar(token, `/events/${eventId}`);
            if (!own(recovered, String(task.id))) throw new CalendarError('ownership', 409);
            await this.client.calendar(token, `/events/${eventId}?sendUpdates=none`, 'PATCH', body);
          }
        }
        await this.store.saveLink(user, String(task.id), eventId, hash); changes++;
      }
      // Only mapped, proven app-owned events can be removed. Source query must have completed fully.
      for (const link of links) {
        if (active.has(String(link.task_id))) continue;
        if (!available()) { partial = true; break; }
        const id = calendarEventId(owner, String(link.task_id));
        if (id !== link.google_event_id) { await this.store.removeLink(user, String(link.task_id)); continue; }
        try {
          const event = await this.client.calendar(token, `/events/${id}`);
          if (!own(event, String(link.task_id))) throw new CalendarError('ownership', 409);
          await this.client.calendar(token, `/events/${id}?sendUpdates=none`, 'DELETE');
        } catch (e) { if (!(e instanceof CalendarError) || e.code !== 'not_found') throw e; }
        await this.store.removeLink(user, String(link.task_id)); changes++;
      }
      await this.store.result(user, lease, invalid ? 'invalid_task' : partial ? 'partial' : null, !partial && !invalid);
      return { changes, partial, message: invalid ? calendarMessages.invalid_task : partial ? calendarMessages.partial : null };
    });
  }
  async disconnect(user: string) {
    if (!await this.store.get(user)) return;
    const lease = randomUUID(); await this.store.acquire(user, lease);
    try { await this.store.disconnect(user, lease); } finally { await this.store.release(user, lease); }
  }
  async tick() {
    if (!this.config.ready) return;
    for (const user of await this.store.users()) {
      await this.store.attempted(user);
      try { await this.sync(user); } catch { /* Error state is private to the connected account; never log tokens/events. */ }
    }
  }
}
