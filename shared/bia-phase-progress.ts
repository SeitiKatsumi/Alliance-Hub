import { z } from "zod";

export const biaPhaseProgressSchema = z.object({
  phase: z.string(), nextPhase: z.string().nullable(),
  mode: z.enum(["automatic", "manual"]).nullable(), ready: z.boolean(),
  checks: z.array(z.object({ id: z.string(), label: z.string(), met: z.boolean(), detail: z.string().optional() })),
});
export type BiaPhaseProgress = z.infer<typeof biaPhaseProgressSchema>;
