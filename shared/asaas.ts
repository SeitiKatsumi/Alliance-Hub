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

const digits = (value: string) => value.replace(/\D/g, "");
export function isValidCnpj(value: string): boolean {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (length: 12 | 13) => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index++) {
      total += Number(cnpj[index]) * factor--;
      if (factor < 2) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(cnpj[12]) === check(12) && Number(cnpj[13]) === check(13);
}

const requiredText = (label: string, max = 255) => z.string().trim().min(1, `Informe ${label}.`).max(max);
export const asaasCompanyTypes = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"] as const;
export const asaasTaxRegimes = ["MEI", "NATIONAL_SIMPLE", "NORMAL_REGIME", "UNKNOWN"] as const;
export const asaasSubaccountCreateSchema = z.object({
  name: requiredText("a razão social", 150),
  email: z.string().trim().email("Informe um e-mail válido.").max(200),
  cpfCnpj: z.string().trim().refine(isValidCnpj, "Informe um CNPJ válido."),
  companyType: z.enum(asaasCompanyTypes),
  mobilePhone: z.string().trim().refine(value => /^\d{10,11}$/.test(digits(value)), "Informe um celular com DDD."),
  incomeValue: z.coerce.number().finite().positive("Informe o faturamento mensal.").max(1_000_000_000),
  address: requiredText("o endereço", 255),
  addressNumber: requiredText("o número do endereço", 30),
  complement: z.string().trim().max(255).default(""),
  province: requiredText("o bairro", 100),
  postalCode: z.string().trim().refine(value => /^\d{8}$/.test(digits(value)), "Informe um CEP válido."),
  taxRegime: z.enum(asaasTaxRegimes).optional(),
  environmentConfirmation: z.boolean().refine(value => value, "Confirme o envio dos dados ao ambiente Asaas indicado."),
}).transform(value => ({
  ...value,
  cpfCnpj: digits(value.cpfCnpj),
  mobilePhone: digits(value.mobilePhone),
  postalCode: digits(value.postalCode),
}));
export type AsaasSubaccountCreate = z.input<typeof asaasSubaccountCreateSchema>;

export const asaasStatusSchema = z.object({
  environment: asaasEnvironmentSchema,
  enabled: z.boolean(), configurationValid: z.boolean(), credentialsPresent: z.boolean(), webhookTokenPresent: z.boolean(),
  baasEnabled: z.boolean(), storageReady: z.boolean(), credentialVaultReady: z.boolean(),
  operationsEnabled: z.boolean(), externalRequestsEnabled: z.boolean(),
  state: z.enum(["disabled", "configuration_pending", "foundation_ready", "operational"]),
  pending: z.array(z.string()),
  capabilities: z.array(z.object({ id: z.string(), label: z.string(), available: z.boolean() })),
});
export type AsaasStatus = z.infer<typeof asaasStatusSchema>;
export const asaasBiaStatusSchema = z.object({
  environment: asaasEnvironmentSchema, integrationState: asaasStatusSchema.shape.state,
  storageReady: z.boolean(), operationsEnabled: z.boolean(), chargesEnabled: z.boolean(), transfersEnabled: z.boolean(),
  accountCreationAvailable: z.boolean(), accountCreationBlockers: z.array(z.string()),
  integrationPending: z.array(z.string()).optional(),
  account: asaasAccountSummarySchema.nullable(),
});
export type AsaasBiaStatus = z.infer<typeof asaasBiaStatusSchema>;

export const asaasTransferSchema = z.object({
  destinationType: z.enum(["PIX", "ASAAS"]),
  value: z.coerce.number().finite().positive("Informe um valor positivo.").max(100_000_000),
  pixAddressKey: z.string().trim().max(255).optional(),
  pixAddressKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).optional(),
  walletId: z.string().trim().max(255).optional(),
  description: z.string().trim().max(140).optional(),
  idempotencyKey: z.string().uuid(),
  confirmation: z.boolean().refine(Boolean, "Confirme a transferência."),
}).strict().superRefine((value, context) => {
  if (value.destinationType === "PIX" && (!value.pixAddressKey || !value.pixAddressKeyType)) {
    context.addIssue({ code: "custom", message: "Informe a chave Pix e o tipo da chave." });
  }
  if (value.destinationType === "ASAAS" && !value.walletId) {
    context.addIssue({ code: "custom", message: "Informe a carteira Asaas de destino." });
  }
});
export type AsaasTransferInput = z.input<typeof asaasTransferSchema>;
