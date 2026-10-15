import { sql } from 'drizzle-orm';
import { defaultPreferences, parsePreferences, preferencesPatchSchema, type MailCategory, type UserPreferences } from '../shared/user-preferences';

export class UserPreferencesStore {
  constructor(private db: {execute: (query: any) => Promise<any>}) {}
  async read(userId: string): Promise<UserPreferences> {
    const result = await this.db.execute(sql`SELECT language, email FROM user_platform_preferences WHERE user_id=${userId}`);
    return result.rows[0] ? parsePreferences(result.rows[0]) : defaultPreferences();
  }
  async patch(userId: string, input: unknown): Promise<UserPreferences> {
    const patch = preferencesPatchSchema.parse(input);
    const defaults = defaultPreferences();
    // The database merges each partial update atomically, including simultaneous tabs.
    const result = await this.db.execute(sql`
      INSERT INTO user_platform_preferences (user_id, language, email)
      VALUES (${userId}, ${patch.language || defaults.language}, ${JSON.stringify({...defaults.email,...patch.email})}::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET
        language = COALESCE(${patch.language ?? null}::text, user_platform_preferences.language),
        email = user_platform_preferences.email || ${JSON.stringify(patch.email || {})}::jsonb,
        updated_at = now()
      RETURNING language, email`);
    return parsePreferences(result.rows[0]);
  }
  async allowsEmail(to: string, category: MailCategory): Promise<boolean> {
    if (category === 'essential') return true;
    // A shared email address opts out if any active account at that address opts out.
    const result = await this.db.execute(sql`
      SELECT p.email FROM users u JOIN user_platform_preferences p ON p.user_id=u.id
      WHERE lower(trim(u.email))=lower(trim(${to})) AND u.ativo=true`);
    return result.rows.every((row: any) => parsePreferences({language:'pt-BR',email:row.email}).email[category]);
  }
}

export function registerUserPreferences(app: any, deps: {
  store: UserPreferencesStore; resolveUser: (req: any) => Promise<string | null>;
}) {
  for (const method of ['get','patch'] as const) app[method]('/api/me/preferences', async (req: any,res: any) => {
    try {
      const userId = await deps.resolveUser(req);
      if (!userId) return res.status(401).json({error:'Não autenticado.'});
      if (method === 'patch' && !preferencesPatchSchema.safeParse(req.body).success) return res.status(400).json({error:'Preferências inválidas.'});
      const value = method === 'get' ? await deps.store.read(userId) : await deps.store.patch(userId,req.body);
      res.set('Cache-Control','no-store');
      return res.json(value);
    } catch {
      return res.status(503).json({error:'Não foi possível carregar ou salvar suas preferências. Tente novamente.'});
    }
  });
}
