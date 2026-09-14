import { z } from "zod";
import companyContract from "./company-contract";
import { BankError } from "./config";

// Source: official CadastroPj specification, retrieved 2026-09-09.
// https://pbdocprod.apidog.io/iniciar-onboarding-de-empresa-pj-28366576e0
export { companyContract };
function contractValidator(node: any): z.ZodTypeAny {
  if (node.type === "object") {
    const properties: Record<string, z.ZodTypeAny> = {};
    for (const [key, field] of Object.entries(node.properties || {})) {
      const validator = contractValidator(field);
      properties[key] = node.required?.includes(key) ? validator : validator.optional();
    }
    return z.object(properties).strict();
  }
  if (node.type === "array") return z.array(contractValidator(node.items)).max(20);
  if (node.type === "boolean") return z.boolean();
  if (node.type === "number" || node.type === "integer") {
    let numeric = z.number().finite().min(node.minimum ?? 0).max(node.maximum ?? Number.MAX_SAFE_INTEGER);
    if (node.type === "integer") numeric = numeric.int();
    return numeric;
  }
  if (node.enum?.length) return z.enum(node.enum as [string, ...string[]]);
  let value = z.string().trim().min(node.minLength ?? 1).max(node.maxLength ?? 500);
  if (node.format === "date-time") value = value.datetime({ offset: true });
  return value;
}
export const companyInput = contractValidator(companyContract);

export function validateBankDocument(bytes: Buffer, filename: string) {
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) throw new BankError("INVALID_FILE", "Documento deve ter até 8 MB.", 400);
  const extension = filename.split(".").pop()?.toLowerCase();
  const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((extension === "pdf" && pdf) || (extension === "png" && png) || (["jpg", "jpeg"].includes(extension || "") && jpeg)) {
    return { mime: pdf ? "application/pdf" : png ? "image/png" : "image/jpeg", filename: filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-150) };
  }
  throw new BankError("INVALID_FILE", "Envie PDF, PNG ou JPEG com formato correspondente à extensão.", 400);
}
