// Legacy bank endpoints also pass through this boundary while being migrated.
const privateFields = /^(raw|payload|provider_payload|onboarding_payload|terms_acceptance_location|keyvalue|keyloja|password|senha|access_token|refresh_token|authorization|aes_key|pdfBase64)$/i;
export function publicBankResponse(value: any): any {
  if (Array.isArray(value)) return value.map(publicBankResponse);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.test(key)).map(([key, item]) => [key, publicBankResponse(item)]));
}
