import { z } from "zod";
import { BankError, type bankConfig } from "./config";
import type { BankTransport } from "./transport";
import { bankReceiptPdf } from "./receipt";

const id = z.number().int().positive().safe();
const text = z.string().trim().min(1).max(200);
const cents = z.number().int().positive().max(100_000_000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const payer = z.object({ name: text, document: z.string().regex(/^(\d{11}|\d{14})$/), email: z.string().email(), address: text, district: text, city: text, state: z.string().regex(/^[A-Z]{2}$/), zip: z.string().regex(/^\d{8}$/) }).strict();
const boleto = z.object({ amountCents: cents, dueDate: date, payer, description: text }).strict();
export const bankInputs = {
  balance: z.object({}).strict(),
  statement: z.object({ start: date, end: date, offset: z.number().int().min(0).max(1_000_000).default(0) }).strict().refine(v => v.start <= v.end && Date.parse(v.end) - Date.parse(v.start) <= 31 * 86400_000, "Consulte até 31 dias por vez."),
  receipt: z.object({ receiptId: id }).strict(),
  terms: z.object({}).strict(),
  boleto: boleto,
  boleto_split: boleto.extend({ beneficiaries: z.array(z.object({ channel: id, client: id, amountCents: cents }).strict()).min(1).max(20) }).refine(v => v.beneficiaries.reduce((sum, b) => sum + b.amountCents, 0) === v.amountCents, "A soma dos beneficiários deve corresponder ao valor da cobrança."),
  boleto_status: z.object({ reference: text }).strict(),
  payment_link: z.object({ amountCents: cents, name: text, document: z.string().regex(/^(\d{11}|\d{14})$/), email: z.string().email() }).strict(),
  pix_charge: z.object({ amountCents: cents, expirationSeconds: z.number().int().min(60).max(86400) }).strict(),
  pix_status: z.object({ qrId: id }).strict(),
  pix_expire: z.object({ qrId: id }).strict(),
  account: z.object({ accountOperationId: z.string().uuid().optional() }).strict(),
  documents: z.object({ accountOperationId: z.string().uuid().optional() }).strict(),
};
export type BankMethod = keyof typeof bankInputs;
export const bankMethodLabels: Record<BankMethod, string> = {
  balance: "Saldo", statement: "Extrato", receipt: "Comprovante", terms: "Termos oficiais",
  boleto: "Boleto de cobrança", boleto_split: "Boleto com split", boleto_status: "Consultar boleto",
  payment_link: "Link de pagamento", pix_charge: "Cobrança Pix", pix_status: "Consultar cobrança Pix", pix_expire: "Invalidar cobrança Pix", account: "Consultar conta", documents: "Documentos e aprovação",
};
export const isReadMethod = (method: BankMethod) => ["balance", "statement", "receipt", "terms", "boleto_status", "pix_status", "account", "documents"].includes(method);
export const methodProduct = (method: BankMethod) => method.startsWith("pix_") ? "pix" : "banking";

export function assertMethod(config: ReturnType<typeof bankConfig>, method: BankMethod) {
  if (!config.methods.has(method)) throw new BankError("METHOD_PENDING", "Método pendente de habilitação em homologação.", 409);
  if (!isReadMethod(method) && !config.newOperationsEnabled) throw new BankError("NEW_OPERATIONS_DISABLED", "Novas operações bancárias desabilitadas.", 409);
  if (method === "terms" && !config.termCode) throw new BankError("TERMS_PENDING", "Aguardando CodigoTermo da Pinbank.", 409);
}

export async function executeBankMethod(transport: BankTransport, method: BankMethod, input: any, operationId: string, client: number, nsu?: number) {
  const base = { CodigoCanal: transport.config.channel, CodigoCliente: client };
  let path: string;
  let data: Record<string, unknown> = base;
  switch (method) {
    case "balance": path = "/api/ContaDigital/Saldo"; break;
    case "account": path = "/api/ContaDigital/DadosPessoais"; break;
    case "documents": path = "/api/ContaDigital/ConsultarDocumento"; break;
    case "payment_link": path = "/api/Transacoes/GerarCobrancaCartao"; data = { ...base, NomePagador: input.name, CpfCnpjPagador: input.document, EmailPagador: input.email, Valor: input.amountCents, NumeroParcelas: 1, IdentificadorOrigem: operationId }; break;
    case "pix_charge": {
      const unit = process.env[transport.config.environment === "dev" ? "PINBANK_DEV_PIX_QR_VALUE_UNIT" : "PINBANK_PROD_PIX_QR_VALUE_UNIT"];
      if (unit !== "cents") throw new BankError("CONTRACT_PENDING", "Unidade de ValorQrCode pendente de validação com a Pinbank.", 409);
      if (!Number.isSafeInteger(nsu) || !nsu || nsu < 1) throw new BankError("INVALID_REFERENCE", "Referência persistente do Pix ausente.");
      path = "/api/Pix/SolicitarDynamicQrCode";
      data = { ...base, ValorQrCode: input.amountCents, NsuOrigem: nsu, SegundosExpiracao: input.expirationSeconds, PermitirPagamentoAposExpiracao: false, PermitirAlterarValorPagamento: false }; break;
    }
    case "pix_status": path = "/api/Pix/ConsultarDynamicQrCode"; data = { ...base, PinbankQrCodeId: input.qrId }; break;
    case "pix_expire": path = "/api/Pix/AlterarStatusDynamicQrCode"; data = { ...base, PinbankQrCodeId: input.qrId, Status: "DESFAZIMENTO" }; break;
    case "statement": path = "/api/ContaDigital/ExtratoContaDigital"; data = { ...base, DataInicial: input.start, DataFinal: input.end, QuantidadeLinhasRetorno: 100, OffsetRetorno: input.offset ?? 0 }; break;
    case "receipt": path = "/api/ContaDigital/ConsultarComprovante"; data = { ...base, IdComprovante: input.receiptId, TipoComprovante: "PDF" }; break;
    case "terms": path = "/api/ContaDigital/TermosDeUso"; data = { ...base, CodigoTermo: transport.config.termCode, retonaConteudoArquivo: true, retonaBase64: false, retornaArqHeader: false }; break;
    case "boleto_status": path = "/api/CashIn/ConsultarBoleto"; data = { ...base, NossoNumero: input.reference }; break;
    case "boleto": case "boleto_split": {
      path = method === "boleto" ? "/api/CashIn/GerarBoleto" : "/api/CashIn/GerarBoletoSplit";
      const p = input.payer;
      data = { ...base, Valor: input.amountCents, DataVencimento: input.dueDate, Email: p.email,
        IdentificadorCliente: operationId, RetornarBase64: false,
        DadosSacado: { Nome: p.name, CpfCnpj: p.document, Endereco: p.address, Bairro: p.district, Cidade: p.city, Uf: p.state, Cep: Number(p.zip) },
        ...(method === "boleto" ? { Instrucoes: input.description } : { DadosSplit: input.beneficiaries.map((b: any) => ({ CodigoCanal: b.channel, CodigoCliente: b.client, Valor: b.amountCents })) }),
      }; break;
    }
  }
  const result = await transport.call(path, data);
  if (method === "receipt" && (!Array.isArray(result) || result.some(item => item?.IdComprovante !== input.receiptId))) throw new BankError("INVALID_RESPONSE", "Comprovante diferente do solicitado.");
  const normalized = normalizeBankResult(method, result);
  return method === "statement" ? { ...normalized, offset: input.offset ?? 0, nextOffset: "hasMore" in normalized && normalized.hasMore ? (input.offset ?? 0) + 100 : null } : normalized;
}

// Allowlisted response projection. No raw responses, credentials, or provider error text.
export function normalizeBankResult(method: BankMethod, data: any) {
  if (method === "payment_link") {
    const url = new URL(data?.UrlPagamento || "");
    if (url.protocol !== "https:") throw new BankError("RESULT_UNKNOWN", "Link de pagamento inválido.");
    return { paymentUrl: url.toString(), state: "pending" };
  }
  if (method === "pix_charge" || method === "pix_status") {
    if (!data?.PinbankQrCodeId || typeof data?.TextoQrCode !== "string") throw new BankError("RESULT_UNKNOWN", "Cobrança Pix sem referência válida.");
    return { reference: String(data.PinbankQrCodeId), qrText: data.TextoQrCode, transactionId: String(data.TxId || ""), providerStatus: String(data.StatusQrCode || "pending") };
  }
  if (method === "pix_expire") return { state: "pending", message: "Invalidação solicitada. Consulte a cobrança para confirmar." };
  if (method === "account") {
    if (!data?.Nome && !data?.RazaoSocial) throw new BankError("INVALID_RESPONSE", "Conta não retornada.");
    return { name: String(data.RazaoSocial || data.Nome), document: String(data.Cnpj || data.Cpf || "") };
  }
  if (method === "documents") {
    if (!Array.isArray(data?.ListaDocumentosCadastrados)) throw new BankError("INVALID_RESPONSE", "Inventário de documentos não retornado.");
    const documents = data.ListaDocumentosCadastrados.map((item: any) => {
      if (!Number.isSafeInteger(item?.CodigoDocumento) || item.CodigoDocumento < 1 || !Number.isSafeInteger(item.TipoDocumento)) throw new BankError("INVALID_RESPONSE", "Documento sem identificador válido.");
      return { id: item.CodigoDocumento, type: item.TipoDocumento, description: String(item.DescricaoDocumento || ""), status: String(item.StatusDocumento || "unknown"), filename: String(item.NomeArquivo || ""), rejectionReason: String(item.MotivoDevolucao || "") };
    });
    return { accountStatus: String(data.StatusContaDigital || "unknown"), documentCount: documents.length, documents };
  }
  if (method === "balance") {
    if (typeof data?.Saldo !== "number" || !Number.isFinite(data.Saldo)) throw new BankError("INVALID_RESPONSE", "Saldo não informado pela Pinbank.");
    return { balance: data.Saldo };
  }
  if (method === "boleto" || method === "boleto_split") {
    if (!data?.NossoNumero || typeof data.LinhaDigitavel !== "string") throw new BankError("RESULT_UNKNOWN", "Boleto sem identificador. Conciliação necessária.");
    return { reference: String(data.NossoNumero), paymentLine: data.LinhaDigitavel, state: "pending" };
  }
  if (method === "terms") {
    if (!data?.IdTermo || !(data?.termoConteudo || (data?.Tipo === "TEXTO" && data?.Termo))) throw new BankError("INVALID_RESPONSE", "Termo oficial completo não retornado pela Pinbank.");
    return { version: String(data.IdTermo), title: "Termos de uso Pinbank", content: String(data.termoConteudo || data.Termo) };
  }
  // These projections are deliberately conservative until their complete response contracts are verified.
  if (method === "boleto_status") {
    if (!data?.NossoNumero || typeof data.Status !== "string") throw new BankError("INVALID_RESPONSE", "Situação do boleto não informada.");
    return { reference: String(data.NossoNumero), providerStatus: data.Status, amountCents: data.Valor, paidCents: data.ValorPago, paymentDate: data.DataPagamento || null };
  }
  if (method === "statement") {
    if (!Array.isArray(data?.ListaTransacoes)) throw new BankError("INVALID_RESPONSE", "Extrato não informado pela Pinbank.");
    return { balance: data.Saldo, hasMore: data.HasMoreElements === true, transactions: data.ListaTransacoes.map((item: any) => ({ id: String(item.IdLpf), date: String(item.DataTransacao || ""), description: String(item.Descricao || ""), amount: item.Valor, type: String(item.TipoTransacao || ""), receiptId: item.IdComprovante || null })) };
  }
  if (method === "receipt") {
    if (!Array.isArray(data) || !data.length) throw new BankError("INVALID_RESPONSE", "Comprovante não encontrado.");
    return { receipts: data.map((item: any) => {
      if (!Number.isSafeInteger(item?.IdComprovante) || item.IdComprovante < 1) throw new BankError("INVALID_RESPONSE", "Comprovante sem identificador válido.");
      const pdf = bankReceiptPdf(item.ComprovanteTipoDados);
      return { id: item.IdComprovante, operationId: item.IdOperacao, description: String(item.Descricao || ""), date: item.DataOperacao, downloadable: true, pdfBase64: pdf.toString("base64") };
    }) };
  }
  throw new BankError("METHOD_PENDING", "Método pendente de validação.");
}
