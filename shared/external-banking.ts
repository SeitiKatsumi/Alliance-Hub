import { z } from "zod";

export const EXTERNAL_BANKS = [
  { id: "c6", code: "336", name: "C6 Bank", direct: true, cost: "Integração ao ERP anunciada sem custo adicional; confirme as condições da conta.", docs: "https://www.c6bank.com.br/apis-integracao/" },
  { id: "sicoob", code: "756", name: "Sicoob", direct: true, cost: "APIs anunciadas sem custo adicional para cooperados; confirme com sua cooperativa.", docs: "https://www.sicoob.com.br/web/sicoob/servicos-empresa" },
  { id: "inter", code: "077", name: "Inter", direct: true, cost: "Habilitação e condições da conta empresarial precisam ser confirmadas.", docs: "https://developers.inter.co/" },
  { id: "bb", code: "001", name: "Banco do Brasil", direct: true, cost: "Exige adesão, credenciais e certificado; confirme tarifas e condições.", docs: "https://www.bb.com.br/site/developers/" },
  { id: "bradesco", code: "237", name: "Bradesco", direct: true, cost: "Acesso depende de habilitação e condições contratadas com o banco.", docs: "https://api.bradesco/openapis" },
  { id: "santander", code: "033", name: "Santander", direct: true, cost: "Acesso depende de adesão às APIs e condições da conta.", docs: "https://www.santander.com.br/empresas/cash/api/" },
  { id: "itau", code: "341", name: "Itaú", direct: true, cost: "Recebimentos Pix e extrato exigem habilitações próprias; confirme as condições.", docs: "https://devportal.itau.com.br/" },
  { id: "btg", code: "208", name: "BTG Pactual Empresas", direct: true, cost: "API empresarial sujeita à habilitação e às condições da conta.", docs: "https://empresas.btgpactual.com/developers" },
  { id: "sicredi", code: "748", name: "Sicredi", direct: true, cost: "Adesão pela cooperativa; tarifas ou isenção precisam ser confirmadas.", docs: "https://developers.sicredi.com.br/public/docs/general-information" },
  { id: "nubank", code: "260", name: "Nubank", direct: false, cost: "Open Finance depende de parceiro habilitado; contratação de produção ainda necessária.", docs: "https://nubank.com.br/empresas/open-finance" },
  { id: "caixa", code: "104", name: "Caixa", direct: false, cost: "Open Finance depende de parceiro habilitado; Pix Automático não equivale ao extrato geral.", docs: "https://www.caixa.gov.br/open-finance/" },
] as const;
export type ExternalBankId = typeof EXTERNAL_BANKS[number]["id"];
export const bankIdSchema = z.enum(EXTERNAL_BANKS.map(b => b.id) as [ExternalBankId, ...ExternalBankId[]]);
export const accountKindSchema = z.enum(["PF", "PJ"]);
export type AccountKind = z.infer<typeof accountKindSchema>;
export type BankEnvironment = "sandbox" | "production";
export type BankReceipt = {
  id: string; bankTransactionId: string; endToEndId?: string; amountCents: number; currency: string;
  receivedAt: string; status: "settled" | "pending" | "reversed"; description: string;
  payerName?: string; payerDocument?: string; reference?: string;
};
export type ReceiptFlow = {
  id: string; biaId: string; type: string; status: string; amountCents: number; currency: string;
  date?: string; description: string; payerName?: string; payerDocument?: string;
  reference?: string; cash: boolean; activeCharge: boolean; protected: boolean;
};
export type BankCandidate = { flowId: string; description: string; amountCents: number; differenceCents: number; reasons: string[]; automatic: boolean; conflict: boolean };
export const normalizeBankDocument = (v: unknown) => String(v || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
export const completeBankDocument = (v: unknown) => /^(?:\d{11}|[A-Z0-9]{12}\d{2})$/.test(normalizeBankDocument(v));
export const bankMoneyCents = (v: unknown): number => {
  if (typeof v !== "number" && (typeof v !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(v))) throw new Error("INVALID_BANK_AMOUNT");
  const n = Number(v), cents = Math.round(n * 100);
  if (!Number.isFinite(n) || !Number.isSafeInteger(cents) || Math.abs(n * 100 - cents) > 0.001) throw new Error("INVALID_BANK_AMOUNT");
  return cents;
};
const normalizedName = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]/g, " ").trim();
export function matchBankReceipt(receipt: BankReceipt, flows: ReceiptFlow[], biaId: string): BankCandidate[] {
  if (receipt.status !== "settled" || receipt.amountCents <= 0 || !Number.isSafeInteger(receipt.amountCents)) return [];
  const candidates = flows.filter(f => f.biaId === biaId && f.type === "entrada" && f.cash && !f.protected
    && ["pendente", "agendado", "vencido"].includes(f.status) && f.currency === receipt.currency && f.amountCents > 0)
    .flatMap(f => {
      const differenceCents = receipt.amountCents - f.amountCents;
      const reference = !!receipt.reference && !!f.reference && receipt.reference === f.reference;
      const document = completeBankDocument(receipt.payerDocument) && completeBankDocument(f.payerDocument)
        && normalizeBankDocument(receipt.payerDocument) === normalizeBankDocument(f.payerDocument);
      const conflictingDocument = completeBankDocument(receipt.payerDocument) && completeBankDocument(f.payerDocument) && !document;
      const rname = normalizedName(receipt.payerName || ""), fname = normalizedName(f.payerName || "");
      const name = rname.length >= 3 && fname.length >= 3 && (rname.includes(fname) || fname.includes(rname));
      const days = f.date ? Math.abs(Date.parse(receipt.receivedAt) - Date.parse(f.date)) / 86400000 : Infinity;
      // Tolerância só para sugestões: até R$5 ou1%, o que for menor. Não altera o valor devido.
      const close = Math.abs(differenceCents) <= Math.min(500, Math.max(1, Math.round(f.amountCents * .01)));
      if (!(reference || document || (close && (days <= 7 || name)))) return [];
      const reasons = [reference && "Referência bancária vinculada", document && "Documento do pagador corresponde", name && "Nome compatível", !differenceCents ? "Mesmo valor" : `Diferença de ${(differenceCents / 100).toFixed(2)}`, conflictingDocument && "Documento divergente", f.activeCharge && "Cobrança ativa em outro provedor"].filter(Boolean) as string[];
      return [{ flowId: f.id, description: f.description, amountCents: f.amountCents, differenceCents, reasons,
        automatic: !differenceCents && (reference || document) && !conflictingDocument && !f.activeCharge,
        conflict: f.activeCharge }];
    });
  // Qualquer ambiguidade impede baixa automática, mesmo com um candidato de pontuação maior.
  if (candidates.length !== 1) candidates.forEach(c => { c.automatic = false; });
  return candidates.sort((a, b) => Math.abs(a.differenceCents) - Math.abs(b.differenceCents) || a.flowId.localeCompare(b.flowId)).slice(0, 10);
}
export const bankConnectionInputSchema = z.object({ bank: bankIdSchema, kind: accountKindSchema, method: z.enum(["direct", "pluggy"]), profileId: z.string().max(100).optional(), ownerDocument: z.string().max(30).refine(completeBankDocument, "Informe o CPF ou CNPJ completo do titular."), costsAccepted: z.literal(true) }).strict();
export const bankChoiceSchema = z.object({ choice: z.enum(["asaas", "external"]) }).strict();
