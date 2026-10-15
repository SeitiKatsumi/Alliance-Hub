export function registerBiaInviteCancel(app: any, deps: {
  authorize: (req: any, res: any) => Promise<any>;
  cancel: (type: "socio" | "diretor", id: string, biaId: string) => Promise<boolean>;
  lock: (type: string, handler: any) => any;
}) {
  app.post("/api/bias/:id/convites/:tipo/:conviteId/cancelar", deps.lock("param", async (req: any, res: any) => {
    try {
      const access = await deps.authorize(req, res);
      if (!access) return;
      const type = req.params.tipo;
      if (type !== "socio" && type !== "diretor") return res.status(400).json({ error: "Tipo de convite inválido." });
      const cancelled = await deps.cancel(type, String(req.params.conviteId), String(access.bia.id));
      if (!cancelled) return res.status(409).json({ error: "Convite não encontrado nesta BIA ou já processado. A lista será atualizada." });
      return res.json({ ok: true, message: "Convite cancelado. A conta, os vínculos existentes e a composição econômica não foram alterados." });
    } catch {
      return res.status(503).json({ error: "Não foi possível cancelar o convite. Tente novamente." });
    }
  }));
}
