import type { Express, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { asaasBiaStatusSchema, canReadAsaasAdmin } from "../../shared/asaas";
import { asaasConfig, publicAsaasStatus, type AsaasConfig } from "./config";
import { AsaasError } from "./client";
import { AsaasStore, type AsaasDatabase } from "./store";
import { recordSandboxEvent, validWebhookToken } from "./events";

export type AsaasPrincipal = { id: string; role: string; employee: boolean };
export function registerAsaasFoundation(app: Express, dependencies: {
  db: AsaasDatabase;
  resolvePrincipal: (req: Request) => Promise<AsaasPrincipal | null>;
  authorizeBia: (req: Request, res: Response, biaId: string) => Promise<{ id: string } | null>;
  config?: () => AsaasConfig;
}) {
  const getConfig = dependencies.config || asaasConfig;
  app.get("/api/admin/asaas/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const principal = await dependencies.resolvePrincipal(req);
      if (!principal) return res.status(401).json({ error: "Não autenticado." });
      if (!canReadAsaasAdmin(principal)) return res.status(403).json({ error: "Acesso administrativo necessário." });
      const config = getConfig();
      return res.json(publicAsaasStatus(config, await new AsaasStore(dependencies.db, config.environment).storageReady()));
    } catch { return res.status(503).json({ error: "Não foi possível consultar a configuração Asaas." }); }
  });

  app.get("/api/bias/:biaId/banco/asaas/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const bia = await dependencies.authorizeBia(req, res, String(req.params.biaId));
      if (!bia) return;
      const config = getConfig();
      const store = new AsaasStore(dependencies.db, config.environment);
      const ready = await store.storageReady();
      const account = ready ? await store.accountForBia(String(bia.id)) : null;
      return res.json(asaasBiaStatusSchema.parse({
        environment: config.environment, integrationState: publicAsaasStatus(config, ready).state,
        storageReady: ready, operationsEnabled: false, account,
      }));
    } catch { return res.status(503).json({ error: "Não foi possível consultar a integração Asaas desta BIA." }); }
  });

  app.post("/api/webhooks/asaas/sandbox", async (req, res) => {
    try {
      const config = getConfig();
      if (!config.configurationValid || !config.enabled || config.environment !== "sandbox" || !config.webhookToken) return res.status(503).json({ error: "Receptor Sandbox não habilitado." });
      if (!validWebhookToken(req.get("asaas-access-token"), config.webhookToken)) return res.status(401).json({ error: "Token de webhook inválido." });
      const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
      if (Buffer.isBuffer(rawBody) && rawBody.byteLength > 100 * 1024) return res.status(413).json({ error: "Evento excede o limite permitido." });
      const store = new AsaasStore(dependencies.db, "sandbox");
      if (!(await store.storageReady())) return res.status(503).json({ error: "Armazenamento Asaas indisponível." });
      const result = await recordSandboxEvent(store, req.body);
      return res.status(200).json({ received: true, duplicate: result.duplicate, financialEffects: false });
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ error: "Formato de evento inválido." });
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível registrar o evento. Reenvio permitido." });
    }
  });

  // Express pode recusar JSON antes da rota; não encaminhar corpo privado ao logger genérico.
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (req.path !== "/api/webhooks/asaas/sandbox") return next(error);
    const oversized = error?.type === "entity.too.large";
    return res.status(oversized ? 413 : 400).json({ error: oversized ? "Evento excede o limite permitido." : "Formato de evento inválido." });
  });
}
