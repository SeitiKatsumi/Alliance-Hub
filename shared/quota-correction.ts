import { z } from "zod";

const fiveDecimalNumber = (schema: z.ZodNumber) => schema.refine(
  value => Math.abs(value * 100_000 - Math.round(value * 100_000)) < 0.000001,
  "Use no máximo cinco casas decimais",
);

export const quotaTransferAmountsSchema = z.object({
  valor_total: fiveDecimalNumber(z.number().finite().positive().max(1e12)),
  percentual_transferencia: fiveDecimalNumber(z.number().finite().positive().max(100)),
}).strict();

const quotaValueCorrectionSchema = quotaTransferAmountsSchema.extend({
  motivo: z.string().trim().min(1).max(2000),
  atualizado_em: z.string().datetime(),
});

export const quotaCorrectionSchema = z.union([
  z.object({ acao: z.literal("reverter"), confirmar: z.literal(true), motivo: z.string().trim().min(1).max(2000), atualizado_em: z.string().datetime() }).strict(),
  quotaValueCorrectionSchema.strict(),
]);

export interface QuotaCorrectionRecord {
  acao?: "corrigir" | "reverter";
  autor_id: string;
  data: string;
  motivo: string;
  antes: { valor_total: string | null; percentual_transferencia: string | null; status?: string };
  depois: { valor_total: string | null; percentual_transferencia: string | null; status?: string };
}

export function canCorrectQuotaTransfer(role: unknown, memberId: unknown, director: unknown, ally: unknown, origin?: unknown): boolean {
  const id = (value: any) => String(value?.id ?? value ?? "");
  if (memberId && origin && id(memberId) === id(origin)) return false;
  return role === "admin" || role === "superadmin" || Boolean(memberId && [id(director), id(ally)].includes(id(memberId)));
}
