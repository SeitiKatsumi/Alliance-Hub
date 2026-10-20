import type { Express, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { asaasBiaStatusSchema, canReadAsaasAdmin } from "../../shared/asaas";
import { asaasConfig, publicAsaasStatus, type AsaasConfig } from "./config";
import { AsaasError, AsaasTransport } from "./client";
import { AsaasStore, type AsaasDatabase } from "./store";
import { recordSandboxEvent, validWebhookToken } from "./events";
import { AsaasSandboxAccounts, sandboxAccountCreationBlockers } from "./accounts";
import { AsaasAccountOperations } from "./operations";

export type AsaasPrincipal = { id: string; role: string; employee: boolean };
export function registerAsaasFoundation(app: Express, dependencies: {
  db: AsaasDatabase;
  resolvePrincipal: (req: Request) => Promise<AsaasPrincipal | null>;
  authorizeBia: (req: Request, res: Response, biaId: string, required?: "view" | "edit") => Promise<{ id: string; actorId?: string } | null>;
  config?: () => AsaasConfig;
  onSandboxPayment?: (body:unknown)=>Promise<boolean>;
  accountTransport?: (config: AsaasConfig) => Pick<AsaasTransport, "request">;
}) {
  const getConfig = dependencies.config || asaasConfig;
  app.get("/api/admin/asaas/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const principal = await dependencies.resolvePrincipal(req);
      if (!principal) return res.status(401).json({ error: "Não autenticado." });
      if (!canReadAsaasAdmin(principal)) return res.status(403).json({ error: "Acesso administrativo necessário." });
      const config = getConfig();
      const store = new AsaasStore(dependencies.db, config.environment);
      const ready = await store.storageReady();
      return res.json(publicAsaasStatus(config, ready, ready && await store.credentialStorageReady()));
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
      const credentialReady = ready && await store.credentialStorageReady();
      const account = ready ? await store.accountForBia(String(bia.id)) : null;
      const blockers = sandboxAccountCreationBlockers(config, ready, credentialReady);
      const status = publicAsaasStatus(config, ready, credentialReady);
      return res.json(asaasBiaStatusSchema.parse({
        environment: config.environment, integrationState: status.state,
        storageReady: ready, operationsEnabled: status.operationsEnabled,
        chargesEnabled: status.externalRequestsEnabled && config.chargesEnabled,
        transfersEnabled: status.externalRequestsEnabled && config.transfersEnabled,
        accountCreationAvailable: blockers.length === 0, accountCreationBlockers: blockers, account,
      }));
    } catch { return res.status(503).json({ error: "Não foi possível consultar a integração Asaas desta BIA." }); }
  });

  app.post("/api/bias/:biaId/banco/asaas/accounts", async (req, res) => {
    try {
      const bia = await dependencies.authorizeBia(req, res, String(req.params.biaId), "edit");
      if (!bia) return;
      const config = getConfig();
      const store = new AsaasStore(dependencies.db, config.environment);
      const service = new AsaasSandboxAccounts(store, config, dependencies.accountTransport);
      return res.status(201).json(await service.create(String(bia.id), String(bia.actorId || "unknown"), req.body));
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message || "Dados da subconta inválidos." });
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível criar a subconta Asaas." });
    }
  });

  app.post("/api/bias/:biaId/banco/asaas/account/refresh", async (req, res) => {
    try {
      const bia = await dependencies.authorizeBia(req, res, String(req.params.biaId), "edit");
      if (!bia) return;
      const config = getConfig();
      const service = new AsaasSandboxAccounts(new AsaasStore(dependencies.db, config.environment), config, dependencies.accountTransport);
      return res.json({ account: await service.refresh(String(bia.id)) });
    } catch (error) {
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível atualizar a situação da subconta." });
    }
  });

  app.get("/api/bias/:biaId/banco/asaas/finance", async (req, res) => {
    try {
      const bia = await dependencies.authorizeBia(req, res, String(req.params.biaId), "view");
      if (!bia) return;
      const config = getConfig();
      const service = new AsaasAccountOperations(new AsaasStore(dependencies.db, config.environment), config, dependencies.accountTransport);
      return res.json(await service.overview(String(bia.id)));
    } catch (error) {
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível consultar saldo e transferências." });
    }
  });

  app.post("/api/bias/:biaId/banco/asaas/transfers", async (req, res) => {
    try {
      const bia = await dependencies.authorizeBia(req, res, String(req.params.biaId), "edit");
      if (!bia) return;
      const config = getConfig();
      const service = new AsaasAccountOperations(new AsaasStore(dependencies.db, config.environment), config, dependencies.accountTransport);
      return res.status(202).json(await service.transfer(String(bia.id), String(bia.actorId || "unknown"), req.body));
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message || "Dados da transferência inválidos." });
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível enviar a transferência." });
    }
  });

  const webhookHandler = (environment: "sandbox" | "production") => async (req: Request, res: Response) => {
    try {
      const config = getConfig();
      if (!config.configurationValid || !config.enabled || config.environment !== environment || !config.webhookToken || !config.productionOperationsEnabled) return res.status(503).json({ error: "Receptor Asaas não habilitado neste ambiente." });
      if (!validWebhookToken(req.get("asaas-access-token"), config.webhookToken)) return res.status(401).json({ error: "Token de webhook inválido." });
      const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
      if (Buffer.isBuffer(rawBody) && rawBody.byteLength > 100 * 1024) return res.status(413).json({ error: "Evento excede o limite permitido." });
      const store = new AsaasStore(dependencies.db, environment);
      if (!(await store.storageReady())) return res.status(503).json({ error: "Armazenamento Asaas indisponível." });
      const result = await recordSandboxEvent(store, req.body);
      const transferId = typeof (req.body as any)?.transfer?.id === "string" ? String((req.body as any).transfer.id) : null;
      if (transferId) {
        const event = String((req.body as any)?.event || "");
        const next = event === "TRANSFER_DONE" ? "completed" : event === "TRANSFER_FAILED" ? "rejected" : event === "TRANSFER_CANCELLED" ? "cancelled" : "pending";
        await store.reconcileExternalOperation(transferId, next);
      }
      const reconciliationQueued=dependencies.onSandboxPayment?await dependencies.onSandboxPayment(req.body):false;
      return res.status(200).json({ received: true, duplicate: result.duplicate, financialEffects: false, reconciliationQueued: reconciliationQueued || !!transferId });
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ error: "Formato de evento inválido." });
      if (error instanceof AsaasError) return res.status(error.status).json({ code: error.code, error: error.message });
      return res.status(503).json({ error: "Não foi possível registrar o evento. Reenvio permitido." });
    }
  };
  app.post("/api/webhooks/asaas/sandbox", webhookHandler("sandbox"));
  app.post("/api/webhooks/asaas/production", webhookHandler("production"));

  // Express pode recusar JSON antes da rota; não encaminhar corpo privado ao logger genérico.
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (!/^\/api\/webhooks\/asaas\/(?:sandbox|production)$/.test(req.path)) return next(error);
    const oversized = error?.type === "entity.too.large";
    return res.status(oversized ? 413 : 400).json({ error: oversized ? "Evento excede o limite permitido." : "Formato de evento inválido." });
  });
}
