import { z } from "zod";
import { BankError } from "./config";
import type { BankTransport } from "./transport";

const amount = z.number().int().positive().max(100_000_000);
const digits = z.string().regex(/^(\d{11}|\d{14})$/);
export const payoutInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refund"), amountCents: amount, endToEndId: z.string().min(10).max(100), description: z.string().min(1).max(150) }).strict(),
  z.object({ type: z.literal("pix"), amountCents: amount, keyOrQr: z.string().min(1).max(2000), byKey: z.boolean() }).strict(),
  z.object({ type: z.literal("internal"), amountCents: amount, recipientClient: z.number().int().positive(), recipientChannel: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("ted"), amountCents: amount, bank: z.string().regex(/^\d{3}$/), branch: z.string().regex(/^\d{1,5}$/), branchDigit: z.string().max(2), account: z.string().regex(/^\d{1,15}$/), accountDigit: z.string().min(1).max(2), name: z.string().min(3).max(100), document: digits, accountType: z.enum(["Corrente", "Poupanca"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  z.object({ type: z.literal("bill"), amountCents: amount, line: z.string().regex(/^\d{47}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
]);
export type PayoutInput = z.infer<typeof payoutInput>;
export type PayoutQuote = {
  path: string; data: Record<string, unknown>;
  preview: { type: string; amountCents: number; recipient: string; document: string; account: string; feeCents: number | null; originClient: number; originChannel: number };
};

export async function preparePayout(transport: BankTransport, input: PayoutInput, operationId: string, client: number): Promise<PayoutQuote> {
  const base = { CodigoCliente: client, CodigoCanal: transport.config.channel };
  const preview = { type: input.type, amountCents: input.amountCents, recipient: "", document: "", account: "", feeCents: null as number | null, originClient: client, originChannel: transport.config.channel };
  switch (input.type) {
    case "refund": {
      const result = await transport.call("/api/Pix/DevolucaoPixConsulta", { ...base, End2End: input.endToEndId });
      if (!Number.isSafeInteger(result?.ValorDisponivelDevolucao) || result.ValorDisponivelDevolucao < input.amountCents || !result?.DestinatarioNome) throw new BankError("REFUND_UNAVAILABLE", "Devolução indisponível ou acima do valor permitido.", 422);
      return { path: "/api/Pix/DevolucaoPix", data: { ...base, End2End: input.endToEndId, Valor: input.amountCents, Descricao: input.description }, preview: { ...preview, recipient: result.DestinatarioNome, account: input.endToEndId } };
    }
    case "pix": {
      const result = await transport.call("/api/Pix/ConsultaDadosPagamentoPixQrCode", { ...base, TextoQrCode: input.keyOrQr, TransferenciaPorChave: input.byKey, SomenteTarifaPix: false, Valor: input.amountCents });
      if (result?.PixAutomatico) throw new BankError("OUT_OF_SCOPE", "Pix Automático não faz parte desta etapa.", 422);
      if (!result?.Nome || !result?.IdOrigem || !Number.isFinite(result?.Valor) || !result?.Key) throw new BankError("INVALID_RECIPIENT", "Destinatário Pix não confirmado.", 422);
      // The public API specifies cents for lookup but not the unit of its decimal
      // response/confirmation. Require the vendor-confirmed unit, never guess it.
      const unit = process.env[transport.config.environment === "dev" ? "PINBANK_DEV_PIX_CONFIRM_VALUE_UNIT" : "PINBANK_PROD_PIX_CONFIRM_VALUE_UNIT"];
      if (!["cents", "reais"].includes(unit || "")) throw new BankError("CONTRACT_PENDING", "Unidade do valor de confirmação Pix pendente de validação com a Pinbank.", 409);
      const normalized = Math.round(result.Valor * (unit === "reais" ? 100 : 1));
      if (normalized !== input.amountCents) throw new BankError("AMOUNT_CHANGED", "A Pinbank retornou outro valor. Prepare uma nova operação.", 409);
      return { path: "/api/Pix/EfetuarPagamentoPixQrCode", data: { ...base, TextoQrCode: input.keyOrQr, Key: result.Key, IdOrigem: result.IdOrigem, Valor: result.Valor, TipoPagamento: input.byKey ? "KEY" : "EMV", IdentificadorExterno: operationId }, preview: { ...preview, recipient: result.Nome, document: String(result.CpfCnpj || ""), account: `${result.Banco || result.Instituicao} / ${result.Agencia} / ${result.NumeroConta}` } };
    }
    case "internal": {
      const result = await transport.call("/api/ContaDigital/DadosPessoais", { CodigoCanal: input.recipientChannel, CodigoCliente: input.recipientClient });
      if (!result?.Nome && !result?.RazaoSocial) throw new BankError("INVALID_RECIPIENT", "Conta destinatária não confirmada.", 422);
      return { path: "/api/CashOut/TransferenciaEntreContas", data: { ...base, Valor: input.amountCents, CodigoCanalCredito: input.recipientChannel, CodigoClienteCredito: input.recipientClient }, preview: { ...preview, recipient: result.RazaoSocial || result.Nome, document: String(result.Cnpj || result.Cpf || ""), account: `${input.recipientChannel}/${input.recipientClient}` } };
    }
    case "ted": return { path: "/api/CashOut/DocTed", data: { ...base, CodigoBanco: input.bank, Agencia: input.branch, DigitoAgencia: input.branchDigit, ContaCorrente: input.account, DigitoContaCorrente: input.accountDigit, TipoConta: input.accountType, TipoPessoa: input.document.length === 14 ? "Juridica" : "Fisica", NomeFavorecido: input.name, CpfCnpjFavorecido: input.document, Valor: input.amountCents, DataAgendamento: input.date }, preview: { ...preview, recipient: input.name, document: input.document, account: `${input.bank} / ${input.branch} / ${input.account}-${input.accountDigit}` } };
    case "bill": {
      const result = await transport.call("/api/CashOut/ConsultarBoletoPagamentoOnline", { ...base, LinhaDigitavel: input.line, TipoPagamento: "TITULO" });
      const bill = result?.RetornoConsultaBoletoPagamentoOnline;
      if (result?.PermissaoConsultaBoletoOnline !== "PERMITIDO_CONSULTA_ONLINE" || !bill?.CpfCnpjBeneficiario || !bill?.LinhaDigitavel || !result?.RetornoXMLBase64 || bill?.DadosArrecadacao) throw new BankError("INVALID_BILL", "Boleto não validado ou fora do escopo.", 422);
      if (bill.ValorCalculado !== input.amountCents) throw new BankError("AMOUNT_CHANGED", "Valor atualizado do boleto diverge. Prepare novamente com o valor correto.", 409);
      return { path: "/api/CashOut/PagamentoConta", data: { ...base, Valor: input.amountCents, LinhaDigitavel: bill.LinhaDigitavel, CpfCnpjBeneficiario: bill.CpfCnpjBeneficiario, NomeBeneficiario: bill.RazaoSocialBeneficiario || bill.NomeFantasiaBeneficiario, DataAgendamento: input.date, DataVencimento: bill.DataVencimento, XmlBoletoPagamentoOnlineBase64: result.RetornoXMLBase64, TipoPagamento: "TITULO" }, preview: { ...preview, recipient: bill.RazaoSocialBeneficiario || bill.NomeFantasiaBeneficiario, document: bill.CpfCnpjBeneficiario, account: bill.LinhaDigitavel } };
    }
  }
}

export async function sendPayout(transport: BankTransport, quote: PayoutQuote) {
  const data = await transport.call(quote.path, quote.data);
  const reference = data?.NsuPagamento || data?.NSUPinbank || data?.NossoNumero || data?.IdOperacao;
  if (!reference) throw new BankError("RESULT_UNKNOWN", "Saída sem referência. Conciliação necessária.");
  return { reference: String(reference), receiptId: data.IdComprovante || null, state: "pending" };
}
