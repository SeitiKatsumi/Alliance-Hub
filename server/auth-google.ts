import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express, NextFunction, Request, Response } from "express";
import { storage } from "./storage";

const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://app.builtalliances.com";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

function getCallbackURL(req?: Request): string {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, "")}/auth/google/callback`;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/auth/google/callback`;
  if (req) {
    const host = req.get("x-forwarded-host") || req.get("host");
    if (host) {
      const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const protocol = forwardedProto || (req.secure ? "https" : "http");
      return `${protocol}://${host}/auth/google/callback`;
    }
  }
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

  app.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google", {
      session: false,
      scope: ["profile", "email"],
      callbackURL: getCallbackURL(req),
    })(req, res, next);
  });

  app.get(
    "/auth/google/callback",
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate("google", {
        session: false,
        failureRedirect: "/login?error=google_failed",
        callbackURL: getCallbackURL(req),
      })(req, res, next);
    },
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

        // 3. If no existing account found, block — new accounts must be created via the invite flow.
        if (!user) {
          console.log(`[google-auth] No existing account for Google ID ${googleId} / email ${email} — blocking new account creation (invite required)`);
          return res.redirect("/login?error=google_no_invite");
        }

        // 4. For existing users without a membro_directus_id, attempt to FIND (not create) their Directus member by email.
        if (!user.membro_directus_id) {
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
                if (m) {
                  await storage.updateUser(user.id, { membro_directus_id: m.id } as any);
                  user = { ...user, membro_directus_id: m.id };
                  console.log(`[google-auth] Linked existing Directus member ${m.id} to user ${user.id}`);
                }
              }
            } catch (e) {
              console.warn("[google-auth] Failed to look up Directus member for linking:", e);
            }
          }
        }

        // Update foto_perfil if we have it (fire and forget)
        if (foto && user.membro_directus_id) {
          fetch(`${DIRECTUS_URL}/items/cadastro_geral/${user.membro_directus_id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ foto_perfil: foto }),
          }).catch(() => {});
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
