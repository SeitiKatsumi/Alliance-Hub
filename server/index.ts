import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cron from "node-cron";
import { registerRoutes } from "./routes";
import { setupGoogleAuth } from "./auth-google";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Pool } from "pg";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.set("trust proxy", 1);

const PgStore = connectPgSimple(session);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "built-alliances-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  setupGoogleAuth(app);
  await registerRoutes(httpServer, app);

  // ── Reminder cron: runs every 30 minutes, sends 24h/48h/72h reminders for termos_pendentes
  cron.schedule("*/30 * * * *", async () => {
    try {
      const { storage } = await import("./storage");
      const { enviarLembreteTermos, notificarAliadoConviteExpirado } = await import("./mailer");

      const DIRECTUS_URL = process.env.DIRECTUS_URL || "";
      const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

      const pendentes = await storage.getConvitesTermosPendentes();
      const now = Date.now();

      // Helper: get comunidade collection name (cached between runs via simple var)
      let _colCache: string | null = null;
      const getCol = async () => {
        if (_colCache) return _colCache;
        const r = await fetch(`${DIRECTUS_URL}/collections`, { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
        if (!r.ok) return "Comunidade";
        const cols = (await r.json()).data as { collection: string }[];
        const hit = cols.find(c => c.collection.toLowerCase().includes("comunidade"));
        _colCache = hit?.collection || "Comunidade";
        return _colCache;
      };

      for (const c of pendentes) {
        if (!c.candidato_email || !c.criado_em) continue;
        const criado = new Date(c.criado_em).getTime();
        const hoursElapsed = (now - criado) / (1000 * 60 * 60);
        const lembrete_72h = (c as any).lembrete_72h_em;

        // Expired: >72h, 72h lembrete was already sent (or >80h regardless)
        if ((lembrete_72h && hoursElapsed > 73) || hoursElapsed > 80) {
          await storage.updateConvite(c.id, { status: "expirado" } as any);
          try {
            const col = await getCol();
            const cr = await fetch(`${DIRECTUS_URL}/items/${col}/${c.comunidade_id}?fields=id,nome,aliado.id,aliado.nome,aliado.email`, {
              headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            });
            const comunidade = cr.ok ? (await cr.json()).data : null;
            if (comunidade?.aliado?.email) {
              await notificarAliadoConviteExpirado({
                aliadoEmail: comunidade.aliado.email,
                aliadoNome: comunidade.aliado.nome || "Aliado",
                candidatoNome: c.candidato_nome || "Candidato",
                comunidadeNome: comunidade.nome || "Comunidade BUILT",
              });
            }
          } catch (e) { console.error("[cron] erro ao notificar aliado expirado:", e); }
          continue;
        }

        const sendReminder = async (intervalHours: 24 | 48 | 72, lembreteField: string) => {
          if ((c as any)[lembreteField]) return; // already sent
          if (now - criado < intervalHours * 60 * 60 * 1000) return;
          await enviarLembreteTermos({
            candidatoEmail: c.candidato_email!,
            candidatoNome: c.candidato_nome || "Candidato",
            comunidadeNome: "Comunidade BUILT",
            conviteToken: c.token,
            intervalHours,
          });
          await storage.updateConvite(c.id, { [lembreteField]: new Date() } as any);
          console.log(`[cron] ${intervalHours}h reminder sent to ${c.candidato_email}`);
        };

        await sendReminder(24, "lembrete_24h_em");
        await sendReminder(48, "lembrete_48h_em");
        await sendReminder(72, "lembrete_72h_em");
      }
    } catch (e) {
      console.error("[cron] reminder job error:", e);
    }
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
