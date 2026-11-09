import type { Express, Request, Response } from "express";
import { z } from "zod";
import { bankChoiceSchema } from "../shared/external-banking";
import { BankingError } from "./external-banking-provider";
import type { ExternalBanking } from "./external-banking";

export function registerExternalBanking(app: Express, service: ExternalBanking, authorize: (req: Request, res: Response, biaId: string, bank: "view" | "edit", finance?: "view" | "edit") => Promise<{ id: string; actor: string; canEdit: boolean; canFinance: boolean } | null>) {
  const fail = (res: Response, error: unknown) => {
    if (error instanceof z.ZodError) return res.status(400).json({ code: "INVALID_INPUT", error: error.issues[0]?.message || "Dados inválidos." });
    if (error instanceof BankingError) return res.status(error.statusCode).json({ code: error.code, error: error.message });
    return res.status(503).json({ code: "BANK_RETRY_PENDING", error: "Operação bancária pendente. Os dados anteriores foram preservados; tente novamente." });
  };
  const route = (level: "view" | "edit", finance: "view" | "edit" | undefined, work: (req: Request, res: Response, auth: { id: string; actor: string; canEdit: boolean; canFinance: boolean }) => Promise<any>) => async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.method !== "GET" && req.get("origin")) {
        const origin = new URL(req.get("origin")!);
        if (origin.host !== req.get("host")) throw new BankingError("INVALID_ORIGIN", "Origem não autorizada.", 403);
      }
      const auth = await authorize(req, res, String(req.params.biaId), level, finance); if (!auth) return;
      await work(req, res, auth);
    } catch (e) { fail(res, e); }
  };
  const base = "/api/bias/:biaId/banco/externo";
  app.get(base + "/status", route("view", undefined, async (_req, res, a) => res.json({ ...await service.status(a.id), canEdit: a.canEdit, canFinance: a.canFinance })));
  app.put(base + "/escolha", route("edit", undefined, async (req, res, a) => res.json(await service.choose(a.id, bankChoiceSchema.parse(req.body).choice, a.actor))));
  app.post(base + "/conexoes", route("edit", undefined, async (req, res, a) => res.status(201).json(await service.start(a.id, a.actor, req.body))));
  app.post(base + "/conexoes/:connectionId/contas", route("edit", undefined, async (req, res, a) => {
    const body = z.object({ itemId: z.string().uuid() }).strict().parse(req.body);
    res.json(await service.accounts(a.id, z.string().uuid().parse(req.params.connectionId), a.actor, body.itemId));
  }));
  app.post(base + "/conexoes/:connectionId/concluir", route("edit", undefined, async (req, res, a) => {
    const body = z.object({ accountId: z.string().uuid() }).strict().parse(req.body);
    res.json(await service.finish(a.id, z.string().uuid().parse(req.params.connectionId), a.actor, body));
  }));
  app.post(base + "/conexoes/:connectionId/atualizar", route("edit", undefined, async (req, res, a) => res.json(await service.sync(a.id, z.string().uuid().parse(req.params.connectionId)))));
  app.put(base + "/conexoes/:connectionId/automacao", route("edit", "edit", async (req, res, a) => {
    const body = z.object({ enabled: z.boolean(), confirm: z.literal(true) }).strict().parse(req.body);
    res.json(await service.setAutomation(a.id, z.string().uuid().parse(req.params.connectionId), body.enabled, a.actor));
  }));
  app.post(base + "/conexoes/:connectionId/desconectar", route("edit", undefined, async (req, res, a) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    res.json(await service.disconnect(a.id, z.string().uuid().parse(req.params.connectionId)));
  }));
  app.get(base + "/recebimentos", route("view", "view", async (_req, res, a) => res.json(await service.listReceipts(a.id))));
  app.post(base + "/recebimentos/:receiptId/confirmar", route("edit", "edit", async (req, res, a) => {
    const body = z.object({ flowId: z.string().min(1).max(150), confirm: z.literal(true) }).strict().parse(req.body);
    res.json(await service.applyReceipt(a.id, z.string().uuid().parse(req.params.receiptId), body.flowId, a.actor, false));
  }));
  app.post("/api/webhooks/banking/pluggy", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { res.status(202).json(await service.webhook(req.get("x-built-bank-secret") || "", req.body)); } catch (e) { fail(res, e); }
  });
}
