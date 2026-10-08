type Invite = { id: string; bia_id: string; status: string; papel: string; bia_nome?: string | null; solicitante_nome?: string | null; socio_email?: string | null; socio_nome?: string | null; diretor_email?: string | null; diretor_nome?: string | null; percentual?: string | null };

export function registerBiaInviteResend(app: any, deps: {
  authorize: (req: any, res: any) => Promise<{bia: {id: string; nome_bia?: string}} | null>;
  load: (type: "socio" | "diretor", id: string) => Promise<Invite | undefined>;
  send: (type: "socio" | "diretor", invite: Invite, biaName: string) => Promise<{ok: boolean}>;
}) {
  const cooldowns = new Map<string, number>();
  app.post("/api/bias/:id/convites/:tipo/:conviteId/reenviar", async (req: any, res: any) => {
    try {
      const access = await deps.authorize(req, res);
      if (!access) return;
      const type = req.params.tipo;
      if (type !== "socio" && type !== "diretor") return res.status(400).json({error:"Tipo de convite inválido."});
      const invite = await deps.load(type, String(req.params.conviteId));
      if (!invite || String(invite.bia_id) !== String(access.bia.id)) return res.status(404).json({error:"Convite não encontrado nesta BIA."});
      if (invite.status !== "pendente") return res.status(409).json({error:"Este convite não está mais pendente. Atualize a lista."});
      const email = type === "socio" ? invite.socio_email : invite.diretor_email;
      if (!email?.trim()) return res.status(422).json({error:"Este convite não possui e-mail de destino cadastrado."});
      const key = `${access.bia.id}:${type}:${invite.id}`;
      const now = Date.now();
      for (const [id, until] of Array.from(cooldowns)) if (until <= now) cooldowns.delete(id);
      if (cooldowns.has(key)) return res.status(429).json({error:"Aguarde um minuto antes de reenviar este convite novamente."});
      cooldowns.set(key, now + 60_000);
      const result = await deps.send(type, invite, access.bia.nome_bia || invite.bia_nome || "BIA");
      if (!result.ok) return res.status(502).json({error:"O serviço de e-mail não aceitou o envio. Tente novamente em um minuto."});
      return res.json({ok:true, message:"Convite reenviado por e-mail. Oriente a pessoa a conferir também o spam."});
    } catch {
      return res.status(503).json({error:"Não foi possível reenviar o convite agora. Tente novamente mais tarde."});
    }
  });
}
