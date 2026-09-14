import { BankError } from "./config";

// The provider's ComprovanteTipoDados contains the representation requested as PDF.
export function bankReceiptPdf(value: unknown): Buffer {
  if (typeof value !== "string" || value.length > 12 * 1024 * 1024) throw new BankError("INVALID_RECEIPT", "PDF do comprovante não retornado ou acima do limite.");
  const encoded = value.replace(/\s/g, "");
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new BankError("INVALID_RECEIPT", "Formato do comprovante inválido.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new BankError("INVALID_RECEIPT", "PDF do comprovante inválido.");
  return bytes;
}
