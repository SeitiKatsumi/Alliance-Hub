import type { Express, Request } from 'express';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { guestEmail, OBA_GUEST_CODE_TTL_MS, OBA_GUEST_MAX_ATTEMPTS, OBA_GUEST_SESSION_TTL_MS } from '../shared/oba-guest';

export const OBA_GUEST_SQL = `
CREATE TABLE IF NOT EXISTS oba_guest_access (
  id uuid PRIMARY KEY, bia_id text NOT NULL, opa_id text NOT NULL, email text NOT NULL,
  nome text NOT NULL, membro_id uuid NOT NULL, perfil_criado boolean NOT NULL DEFAULT false,
  convite_id text NOT NULL, revogado boolean NOT NULL DEFAULT false, verificado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(bia_id,email)
);
CREATE TABLE IF NOT EXISTS oba_guest_codes (
  id uuid PRIMARY KEY, acesso_id uuid NOT NULL REFERENCES oba_guest_access(id),
  digest text NOT NULL, ip_hash text NOT NULL, tentativas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL,
  consumido boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS oba_guest_codes_access_time ON oba_guest_codes(acesso_id,criado_em);
CREATE INDEX IF NOT EXISTS oba_guest_codes_ip_time ON oba_guest_codes(ip_hash,criado_em);
ALTER TABLE oba_guest_access ADD COLUMN IF NOT EXISTS dados_formalizacao jsonb;
`;

export type GuestAccess = { id: string; bia_id: string; opa_id: string; email: string; nome: string; membro_id: string; perfil_criado: boolean; convite_id: string; revogado: boolean };

export function guestMouHash(mou: unknown, qualification: unknown) {
  return createHash('sha256').update(JSON.stringify({ mou, qualification })).digest('hex');
}

export async function externalBiaMemberIds(db: any, biaId: string): Promise<Set<string>> {
  const exists = (await db.execute(sql`SELECT to_regclass('public.oba_guest_access') AS tabela`)).rows[0]?.tabela;
  if (!exists) return new Set();
  const rows = (await db.execute(sql`SELECT membro_id FROM oba_guest_access WHERE bia_id=${biaId} AND perfil_criado`)).rows;
  return new Set(rows.map((row: any) => String(row.membro_id)));
}
type Dependencies = {
  db: any;
  invite: (token: string, opaId: string) => Promise<{ id: string; biaId: string }>;
  accountExists: (email: string) => Promise<boolean>;
  sendCode: (email: string, code: string, accessId: string) => Promise<{ ok: boolean; skipped?: boolean }>;
  claim: (tx: any, access: GuestAccess) => Promise<void>;
  apply: (access: GuestAccess, input: any) => Promise<unknown>;
  portal: (access: GuestAccess) => Promise<any>;
  formalize: (access: GuestAccess, input: any) => Promise<unknown>;
  mou: (access: GuestAccess, input: any) => Promise<unknown>;
  file: (req: any, res: any) => Promise<any>;
};

export function registerObaGuestRoutes(app: Express, deps: Dependencies) {
  let ready: Promise<unknown> | undefined;
  const ensure = () => ready ??= deps.db.transaction(async (tx: any) => {
    for (const statement of OBA_GUEST_SQL.split(';').filter(value => value.trim())) await tx.execute(sql.raw(statement));
  }).catch((error: unknown) => { ready = undefined; throw error; });
  const key = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  const digest = (id: string, code: string) => createHmac('sha256', key).update(id + ':' + code).digest('hex');
  const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
  const validId = (id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    res.set('Cache-Control', 'private, no-store');
    try { await ensure(); await fn(req, res); }
    catch (error: any) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Não foi possível concluir. Tente novamente.' }); }
  };
  async function authorized(req: Request): Promise<GuestAccess> {
    const session = (req.session as any)?.obaGuest;
    if (!session || session.id !== req.params.accessId || session.expiresAt <= Date.now()) fail('Confirme seu e-mail para continuar.', 401);
    const row = (await deps.db.execute(sql`SELECT * FROM oba_guest_access WHERE id=${session.id} AND NOT revogado`)).rows[0];
    if (!row) fail('Acesso indisponível.', 403);
    return row;
  }

  app.post('/api/oba-guest/code', handle(async (req, res) => {
    const email = guestEmail(req.body?.email);
    const ipHash = createHash('sha256').update(String(req.ip)).digest('hex');
    const recentRequests = (await deps.db.execute(sql`SELECT count(*)::int AS total FROM oba_guest_codes WHERE ip_hash=${ipHash} AND criado_em > now()-interval '1 hour'`)).rows[0];
    if (recentRequests.total >= 20) fail('Aguarde antes de solicitar outro código.', 429);
    let access: GuestAccess;
    if (req.body?.accessId) {
      if (!validId(req.body.accessId)) fail('Confira o link recebido.');
      access = (await deps.db.execute(sql`SELECT * FROM oba_guest_access WHERE id=${req.body.accessId} AND email=${email} AND NOT revogado`)).rows[0];
      if (!access) fail('Confira o e-mail e o link recebidos.', 404);
    } else {
      const invitation = await deps.invite(String(req.body?.inviteToken || ''), String(req.body?.opaId || ''));
      const name = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
      if (name.length < 2 || name.length > 200) fail('Informe seu nome (até 200 caracteres).');
      access = (await deps.db.execute(sql`INSERT INTO oba_guest_access (id,bia_id,opa_id,email,nome,membro_id,convite_id)
        VALUES (${randomUUID()},${invitation.biaId},${String(req.body.opaId)},${email},${name},${randomUUID()},${invitation.id})
        ON CONFLICT (bia_id,email) DO UPDATE SET convite_id=EXCLUDED.convite_id
        RETURNING *`)).rows[0];
      if (access.revogado) fail('Acesso indisponível.', 403);
    }
    if (await deps.accountExists(email)) fail('Este e-mail já possui uma conta BUILT. Use a opção Já participo da BUILT.', 409);
    const code = String(randomInt(0, 10000)).padStart(4, '0');
    const challengeId = randomUUID();
    await deps.db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`);
      await tx.execute(sql`SELECT id FROM oba_guest_access WHERE id=${access.id} FOR UPDATE`);
      const recent = (await tx.execute(sql`SELECT count(*)::int AS total FROM oba_guest_codes WHERE ip_hash=${ipHash} AND criado_em > now()-interval '1 hour'`)).rows[0];
      const own = (await tx.execute(sql`SELECT count(*)::int AS total, max(criado_em) AS ultimo FROM oba_guest_codes WHERE acesso_id=${access.id} AND criado_em > now()-interval '1 hour'`)).rows[0];
      if (recent.total >= 20 || own.total >= 5 || (own.ultimo && Date.now() - new Date(own.ultimo).getTime() < 60000)) fail('Aguarde antes de solicitar outro código.', 429);
      await tx.execute(sql`UPDATE oba_guest_codes SET consumido=true WHERE acesso_id=${access.id}`);
      await tx.execute(sql`INSERT INTO oba_guest_codes (id,acesso_id,digest,ip_hash,expira_em) VALUES
        (${challengeId},${access.id},${digest(challengeId, code)},${ipHash},${new Date(Date.now()+OBA_GUEST_CODE_TTL_MS).toISOString()})`);
    });
    const delivery = await deps.sendCode(email, code, access.id);
    if (!delivery.ok || delivery.skipped) {
      await deps.db.execute(sql`UPDATE oba_guest_codes SET consumido=true WHERE id=${challengeId}`);
      fail('Não foi possível enviar o e-mail. Tente novamente em um minuto.', 503);
    }
    res.json({ challengeId, accessId: access.id });
  }));

  app.post('/api/oba-guest/verify', handle(async (req, res) => {
    const { challengeId, code } = req.body || {};
    if (!validId(challengeId) || !/^\d{4}$/.test(String(code))) fail('Digite os quatro números do código.');
    const accessId = await deps.db.transaction(async (tx: any) => {
      const row = (await tx.execute(sql`SELECT * FROM oba_guest_codes WHERE id=${challengeId} FOR UPDATE`)).rows[0];
      if (!row || row.consumido || row.tentativas >= OBA_GUEST_MAX_ATTEMPTS || new Date(row.expira_em).getTime() <= Date.now()) return null;
      const matches = timingSafeEqual(Buffer.from(row.digest, 'hex'), Buffer.from(digest(challengeId, code), 'hex'));
      if (matches) {
        const access = (await tx.execute(sql`SELECT * FROM oba_guest_access WHERE id=${row.acesso_id} FOR UPDATE`)).rows[0];
        if (!access || access.revogado) return null;
        if (!access.verificado) await deps.claim(tx, access);
        await tx.execute(sql`UPDATE oba_guest_access SET verificado=true WHERE id=${row.acesso_id}`);
      }
      await tx.execute(sql`UPDATE oba_guest_codes SET tentativas=tentativas+1, consumido=${matches} WHERE id=${challengeId}`);
      return matches ? String(row.acesso_id) : null;
    });
    if (!accessId) fail('Código incorreto ou expirado. Solicite um novo código.', 401);
    req.session.obaGuest = { id: accessId, expiresAt: Date.now() + OBA_GUEST_SESSION_TTL_MS };
    await new Promise<void>((resolve, reject) => req.session.save((error: unknown) => error ? reject(error) : resolve()));
    res.json({ accessId });
  }));
  app.get('/api/oba-guest/:accessId', handle(async (req, res) => res.json(await deps.portal(await authorized(req)))));
  app.post('/api/oba-guest/:accessId/interesse', handle(async (req, res) => res.json(await deps.apply(await authorized(req), req.body))));
  app.post('/api/oba-guest/:accessId/formalizacao', handle(async (req, res) => res.json(await deps.formalize(await authorized(req), req.body))));
  app.post('/api/oba-guest/:accessId/mou', handle(async (req, res) => res.json(await deps.mou(await authorized(req), req.body))));
  app.post('/api/oba-guest/:accessId/logout', handle(async (req, res) => {
    await authorized(req); delete req.session.obaGuest; res.json({ ok: true });
  }));
  app.get('/api/oba-guest/:accessId/files/:id', handle(async (req, res) => {
    const portal = await deps.portal(await authorized(req));
    const files = [...(portal.liberado === true ? portal.pagamentos || [] : []).flatMap((item: any) => item.arquivos), ...(portal.documentos || []).map((item: any) => item.id)];
    if (!files.includes(req.params.id)) fail('Arquivo indisponível.', 404);
    return deps.file(req, res);
  }));
}
