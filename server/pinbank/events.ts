import type { OperationState } from "./store";

export type BankEventEvidence = {
  family: "boleto" | "pix_charge" | "payout_pix";
  client: number; channel: number; reference?: string; receiptId?: string;
  state: OperationState; amountCents?: number; paymentDate?: string;
};
const cents = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  const rounded = Math.round(value * 100);
  return Number.isSafeInteger(rounded) && Math.abs(value * 100 - rounded) < 0.000001 ? rounded : undefined;
};
const identifier = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : undefined;

export function bankEventEvidence(event: any): BankEventEvidence | null {
  if (event?.EventVersion !== "v1") return null;
  const d = event.Data;
  if (!d || typeof d !== "object") return null;
  if (event.EventType === "Boleto.Registro" || event.EventType === "Boleto.Liquidacao") {
    if (!d.NossoNumero || String(d.NossoNumero) !== event.EntityId || !identifier(d.CodigoCliente) || !identifier(d.CodigoCanal)) return null;
    if (event.EventType === "Boleto.Registro") return { family: "boleto", client: d.CodigoCliente, channel: d.CodigoCanal, reference: String(d.NossoNumero), state: "pending" };
    if (d.ModalidadeBoleto !== "C" || cents(d.ValorPago) === undefined || !day(d.DataPagamento)) return null;
    return { family: "boleto", client: d.CodigoCliente, channel: d.CodigoCanal, reference: String(d.NossoNumero), state: "settled", amountCents: cents(d.ValorPago), paymentDate: day(d.DataPagamento) };
  }
  if (event.EventType === "Pix.CreditoRecebido" && d.Status === "PAGO" && identifier(d.IdQrcode) && identifier(d.Recebedor?.CodigoCliente) && identifier(d.Recebedor?.CodigoCanal)) {
    const paymentDate = day(String(d.DataLancamento || "").slice(0, 10));
    if (cents(d.Valor) === undefined || !paymentDate) return null;
    return { family: "pix_charge", client: d.Recebedor.CodigoCliente, channel: d.Recebedor.CodigoCanal, reference: String(d.IdQrcode), state: "settled", amountCents: cents(d.Valor), paymentDate };
  }
  if (event.EventType === "Pix.TransferenciaRealizada" && identifier(d.Pagador?.CodigoCliente) && identifier(d.Pagador?.CodigoCanal) && identifier(d.IdComprovante)) {
    const states: Record<string, OperationState> = { CONFIRMADO: "settled", ENVIADO: "pending", NEGADO: "rejected", INVALIDADO: "rejected" };
    if (!states[d.Status] || cents(d.Valor) === undefined) return null;
    if (states[d.Status] === "settled" && !day(d.DataPagamento)) return null;
    return { family: "payout_pix", client: d.Pagador.CodigoCliente, channel: d.Pagador.CodigoCanal, receiptId: String(d.IdComprovante), state: states[d.Status], amountCents: cents(d.Valor), paymentDate: day(d.DataPagamento) };
  }
  // Baixa can mean payment by Pix. Unknown events must never imply cancellation.
  return null;
}
