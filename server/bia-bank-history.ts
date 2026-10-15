import type { Express, Request, Response } from "express";

type Dependencies = {
  authorize: (req: Request, res: Response, level: "view" | "edit") => Promise<{ id: string; nome_bia?: string } | null>;
  readCharges: (biaId: string) => Promise<Array<Record<string, unknown>>>;
};

// Somente consulta durante a troca do provedor. Nenhuma escrita ou chamada bancária.
export function registerBiaBankHistory(app: Express, dependencies: Dependencies) {
  app.get("/api/bias/:biaId/banco", async (req, res) => {
    try {
      const bia = await dependencies.authorize(req, res, "view");
      if (!bia) return;
      const charges = await dependencies.readCharges(String(bia.id));
      return res.json({
        integrationStatus: "implementation_pending",
        providerConfigured: false,
        bia: { id: bia.id, nome_bia: bia.nome_bia },
        charges: charges.map(row => ({
          id: row.id, descricao: row.descricao, status: row.status, valor: row.valor,
          data_vencimento: row.data_vencimento, created_at: row.created_at,
        })),
      });
    } catch {
      return res.status(503).json({ error: "Não foi possível consultar o histórico bancário." });
    }
  });

  // Clientes antigos recebem bloqueio explícito, nunca confirmação falsa de sucesso.
  app.use("/api/bias/:biaId/banco", async (req, res) => {
    try {
      const bia = await dependencies.authorize(req, res, req.method === "GET" ? "view" : "edit");
      if (!bia) return;
      return res.status(410).json({ code: "BANK_OPERATIONS_RETIRED", error: "Esta operação bancária foi desativada. A integração com o Asaas está em preparação." });
    } catch {
      return res.status(503).json({ error: "Não foi possível verificar o acesso à BIA." });
    }
  });
}
