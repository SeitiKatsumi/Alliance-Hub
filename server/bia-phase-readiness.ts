import { biaActivationRequirements, biaFormalParticipantIds, lifecycleRelationId } from "./bia-lifecycle";
import { calculateInitialMap } from "../shared/member-portfolio";
import { validateInitialClassifications } from "../shared/initial-contributions";
import type { BiaPhaseProgress } from "../shared/bia-phase-progress";

export function biaExecutionSigners(bia: any, base: any): string[] {
  return Array.from(new Set([...biaFormalParticipantIds(bia),
    ...(Array.isArray(base?.participantes) ? base.participantes : []).map((p: any) => p.memberId).filter(Boolean),
  ].map(String)));
}

/** Same capture -> execution gate used by automatic reconciliation and its read-only projection. */
export function biaExecutionReadiness(input: {
  bia: any; base: any; draft?: { concluido: boolean } | null;
  pendingDirectorInvites: number; pendingPartnerInvites: number;
  acceptedMouMemberIds: Iterable<string>;
}) {
  const { bia, base, draft } = input;
  const signers = biaExecutionSigners(bia, base);
  const accepted = new Set(Array.from(input.acceptedMouMemberIds).map(String));
  const missingMou = signers.filter(id => !accepted.has(id));
  const requirements = biaActivationRequirements({ ...input, acceptedMouMemberIds: accepted });
  let economicError: string | undefined;
  let classificationError: string | undefined;
  if (base) {
    try { calculateInitialMap(Number(base.valor_origem), base.participantes, base.estrutura_economica); }
    catch { economicError = "Revisar a composição do MAP Inicial"; }
    if (Number(base.modelo_calculo) >= 3) {
      try { validateInitialClassifications(base.participantes); }
      catch { classificationError = "Revisar as classificações das contribuições no MAP Inicial"; }
    }
  }
  const checks: BiaPhaseProgress["checks"] = [
    { id: "structure", label: "Estruturação concluída", met: !draft || draft.concluido === true },
    { id: "ally", label: "Aliado BUILT definido", met: !!lifecycleRelationId(bia.aliado_built) },
    { id: "director", label: "Diretor da Aliança definido", met: !!lifecycleRelationId(bia.diretor_alianca) },
    { id: "director-invites", label: "Convites de diretoria resolvidos", met: input.pendingDirectorInvites === 0 },
    { id: "partner-invites", label: "Convites de sócios resolvidos", met: input.pendingPartnerInvites === 0 },
    { id: "map", label: "MAP Inicial válido", met: !!base && !economicError && !classificationError, detail: economicError || classificationError || (!base ? "MAP Inicial não encontrado" : undefined) },
    { id: "mou", label: `MOU/MAP Inicial aceito por todos${base ? ` · revisão ${Number(base.revisao || 0)}` : ""}`, met: signers.length > 0 && missingMou.length === 0 },
  ];
  return { ready: requirements.canActivate && checks.every(check => check.met), checks, missingMou, signers };
}

export function biaPhaseProgress(input: {
  bia: any; execution?: ReturnType<typeof biaExecutionReadiness>;
  structureCompleted?: boolean; propertyLinked?: boolean;
  resultApproved?: boolean; pendingTransition?: boolean;
}): BiaPhaseProgress {
  const phase = String(input.bia.situacao || "");
  let nextPhase: string | null = null, mode: BiaPhaseProgress["mode"] = null;
  let checks: BiaPhaseProgress["checks"] = [];
  if (phase === "em_estruturacao") {
    nextPhase = "em_captacao"; mode = "manual";
    checks = [{ id: "structure", label: "Concluir a estruturação da BIA", met: input.structureCompleted === true }];
  } else if (phase === "em_captacao") {
    if (!input.execution) throw new Error("Requisitos de ativação indisponíveis.");
    nextPhase = "em_execucao"; mode = "automatic"; checks = input.execution.checks.map(check => ({ ...check }));
  } else if (phase === "em_execucao") {
    nextPhase = "em_operacao"; mode = "automatic";
    checks = [{ id: "property", label: "Imóvel formalmente associado à BIA", met: input.propertyLinked === true }];
  } else if (phase === "em_operacao") {
    nextPhase = "em_distribuicao"; mode = "manual";
    checks = [{ id: "result", label: "Resultado aprovado por deliberação", met: input.resultApproved === true }];
  } else if (!["em_distribuicao", "encerrada"].includes(phase)) {
    checks = [{ id: "legacy", label: "Revisar a fase da BIA legada", met: false }];
  }
  if (input.pendingTransition) checks.push({ id: "reconciliation", label: "Transição anterior conciliada", met: false });
  return { phase, nextPhase, mode, checks, ready: !!nextPhase && checks.length > 0 && checks.every(check => check.met) };
}

export function registerBiaPhaseReadRoutes(app: any, deps: {
  authorize(req: any, res: any, ref: string): Promise<any>;
  progress(bia: any): Promise<BiaPhaseProgress>;
  history(biaId: string): Promise<any[]>;
}) {
  app.get("/api/bias/:id/fase-requisitos", async (req: any, res: any) => {
    try {
      const authorization = await deps.authorize(req, res, req.params.id);
      if (!authorization) return;
      return res.json(await deps.progress(authorization.bia));
    } catch { return res.status(503).json({ error: "Não foi possível consultar os requisitos da fase." }); }
  });
  app.get("/api/bias/:id/fases", async (req: any, res: any) => {
    try {
      const authorization = await deps.authorize(req, res, req.params.id);
      if (!authorization) return;
      return res.json(await deps.history(String(authorization.bia.id)));
    } catch { return res.status(503).json({ error: "Não foi possível consultar o histórico de fases." }); }
  });
}
