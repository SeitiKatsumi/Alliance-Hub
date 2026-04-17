import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express, Request, Response } from "express";
import { storage } from "./storage";

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

function getCallbackURL(): string {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/auth/google/callback`;
  return "http://localhost:5000/auth/google/callback";
}

export function setupGoogleAuth(app: Express) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log("[google-auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth disabled");
    return;
  }

  app.use(passport.initialize());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: getCallbackURL(),
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        done(null, profile);
      }
    )
  );

  app.get("/auth/google", passport.authenticate("google", { session: false, scope: ["profile", "email"] }));

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login?error=google_failed" }),
    async (req: Request, res: Response) => {
      try {
        const profile = req.user as any;
        const googleId: string = profile.id;
        const email: string = profile.emails?.[0]?.value || "";
        const nome: string = profile.displayName || profile.name?.givenName || email.split("@")[0];
        const foto: string = profile.photos?.[0]?.value || "";

        // 1. Try to find existing user by google_id
        let user = await storage.getUserByGoogleId(googleId);

        // 2. Try to find by email
        if (!user && email) {
          user = await storage.getUserByEmail(email);
          if (user) {
            // Link google_id to existing user
            await storage.updateUser(user.id, { google_id: googleId } as any);
          }
        }

        // 3. Create new user if not found
        if (!user) {
          // Try to find matching Directus member by email
          let membroId: string | null = null;
          let memberNome = nome;
          if (email) {
            try {
              const qs = new URLSearchParams();
              qs.set("filter[email][_eq]", email);
              qs.set("fields", "id,nome");
              qs.set("limit", "1");
              const r = await fetch(`${DIRECTUS_URL}/items/cadastro_geral?${qs}`, {
                headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
              });
              if (r.ok) {
                const d = await r.json();
                const m = d.data?.[0];
                if (m) { membroId = m.id; memberNome = m.nome || nome; }
              }
            } catch {}
          }

          // If still no Directus member, create one automatically
          if (!membroId) {
            try {
              const payload: Record<string, any> = {
                nome: nome,
                email: email || null,
                tipo_de_cadastro: "Membro",
                na_vitrine: false,
              };
              if (foto) payload.foto_perfil = foto;
              const cr = await fetch(`${DIRECTUS_URL}/items/cadastro_geral`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });
              if (cr.ok) {
                const cd = await cr.json();
                membroId = cd.data?.id || null;
                memberNome = nome;
                console.log(`[google-auth] Created Directus member for ${email} → id=${membroId}`);
              } else {
                console.warn(`[google-auth] Failed to create Directus member: ${cr.status}`);
              }
            } catch (e) {
              console.warn("[google-auth] Error creating Directus member:", e);
            }
          }

          const username = email
            ? email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase() + "_" + Date.now().toString(36)
            : `google_${googleId.slice(0, 8)}`;

          user = await storage.createUser({
            username,
            password: `google:${googleId}`,
            nome: memberNome,
            email: email || null,
            google_id: googleId,
            membro_directus_id: membroId,
            role: "user",
            ativo: true,
          } as any);
        }

        // If existing user has no membro_directus_id, try to link or create now
        if (user && !user.membro_directus_id) {
          let membroId: string | null = null;
          const userEmail = user.email || email;
          if (userEmail) {
            try {
              const qs = new URLSearchParams();
              qs.set("filter[email][_eq]", userEmail);
              qs.set("fields", "id,nome");
              qs.set("limit", "1");
              const r = await fetch(`${DIRECTUS_URL}/items/cadastro_geral?${qs}`, {
                headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
              });
              if (r.ok) {
                const d = await r.json();
                const m = d.data?.[0];
                if (m) membroId = m.id;
              }
            } catch {}
          }
          if (!membroId) {
            try {
              const payload: Record<string, any> = {
                nome: user.nome || nome,
                email: userEmail || null,
                tipo_de_cadastro: "Membro",
                na_vitrine: false,
              };
              if (foto) payload.foto_perfil = foto;
              const cr = await fetch(`${DIRECTUS_URL}/items/cadastro_geral`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });
              if (cr.ok) {
                const cd = await cr.json();
                membroId = cd.data?.id || null;
                console.log(`[google-auth] Created Directus member (retroactive) for ${userEmail} → id=${membroId}`);
              }
            } catch {}
          }
          if (membroId) {
            await storage.updateUser(user.id, { membro_directus_id: membroId } as any);
            user = { ...user, membro_directus_id: membroId };
          }
        }

        // Set session (same structure as /api/login)
        const role = user.role || "user";
        const permissions = (Object.keys((user.permissions as any) || {}).length > 0
          ? user.permissions
          : role === "admin"
            ? { aura: "edit", bias: "edit", admin: "edit", painel: "edit", membros: "edit", calculadora: "edit", fluxo_caixa: "edit", oportunidades: "edit", cadastro_geral: "edit" }
            : { aura: "view", bias: "view", admin: "none", painel: "view", membros: "view", calculadora: "none", fluxo_caixa: "none", oportunidades: "none", cadastro_geral: "none" }
        ) as Record<string, string>;

        (req.session as any).directusUserId = user.id;
        (req.session as any).membroId = user.membro_directus_id || null;
        (req.session as any).nome = user.nome;
        (req.session as any).email = user.email;
        (req.session as any).role = role;
        (req.session as any).permissions = permissions;

        req.session.save(() => {
          res.redirect("/");
        });
      } catch (err) {
        console.error("[google-auth] callback error:", err);
        res.redirect("/login?error=google_failed");
      }
    }
  );

  console.log(`[google-auth] Google OAuth enabled (callback: ${getCallbackURL()})`);
}
