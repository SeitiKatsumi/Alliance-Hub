import { z } from "zod";

export const asaasEnvironmentSchema = z.enum(["sandbox", "production"]);
export type AsaasEnvironment = z.infer<typeof asaasEnvironmentSchema>;
export function canReadAsaasAdmin(principal: { id?: string; role?: string; employee?: boolean } | null | undefined): boolean {
  return !!principal?.id && !principal.employee && ["admin", "superadmin"].includes(principal.role || "");
}
export const asaasOperationStates = ["prepared", "sent", "pending", "unknown", "completed", "rejected", "cancelled"] as const;
export type AsaasOperationState = typeof asaasOperationStates[number];

export const asaasAccountSummarySchema = z.object({
  id: z.string(), label: z.string(),
  state: z.enum(["draft", "pending", "in_review", "approved", "rejected", "blocked"]),
  ownership: z.enum(["undetermined", "platform", "company", "bia"]),
});
export const asaasStatusSchema = z.object({
  environment: asaasEnvironmentSchema,
  enabled: z.boolean(), configurationValid: z.boolean(), credentialsPresent: z.boolean(), webhookTokenPresent: z.boolean(),
  baasEnabled: z.boolean(), storageReady: z.boolean(),
  operationsEnabled: z.literal(false), externalRequestsEnabled: z.literal(false),
  state: z.enum(["disabled", "configuration_pending", "foundation_ready", "production_blocked"]),
  pending: z.array(z.string()),
  capabilities: z.array(z.object({ id: z.string(), label: z.string(), available: z.literal(false) })),
});
export type AsaasStatus = z.infer<typeof asaasStatusSchema>;
export const asaasBiaStatusSchema = z.object({
  environment: asaasEnvironmentSchema, integrationState: asaasStatusSchema.shape.state,
  storageReady: z.boolean(), operationsEnabled: z.literal(false),
  account: asaasAccountSummarySchema.nullable(),
});
export type AsaasBiaStatus = z.infer<typeof asaasBiaStatusSchema>;
