import type { BankStore, OperationState } from "./store";
import type { BankTransport } from "./transport";

export function observedBankState(method: string, status: unknown): OperationState | null {
  const value = String(status || "").toUpperCase();
  if (["boleto", "boleto_split"].includes(method)) return ["LIQUIDADO", "PAGO"].includes(value) ? "settled" : ["REGISTRADO", "PENDENTE"].includes(value) ? "pending" : null;
  if (method === "payout_pix") return ({ CONFIRMADO: "settled", ENVIADO: "pending", NEGADO: "rejected", INVALIDADO: "rejected" } as Record<string, OperationState>)[value] || null;
  return null;
}

export async function reconcileDev(store: BankStore, transport: BankTransport) {
  if (store.environment !== "dev" || transport.config.environment !== "dev") throw new Error("Environment mismatch");
  await store.recoverInterrupted();
  await store.processEvents();
  if (!transport.config.enabled) return;
  for (const operation of await store.pending()) {
    let error: "METHOD_PENDING" | "EVIDENCE_PENDING" | "QUERY_FAILED" | null = "METHOD_PENDING";
    try {
      const base = { CodigoCanal: operation.origin_channel, CodigoCliente: operation.origin_client };
      let result: any;
      if (["boleto", "boleto_split"].includes(operation.method) && operation.provider_id && transport.config.methods.has("boleto_status")) {
        error = "EVIDENCE_PENDING";
        result = await transport.call("/api/CashIn/ConsultarBoleto", { ...base, NossoNumero: operation.provider_id });
        if (String(result?.NossoNumero || "") !== operation.provider_id) continue;
        const state = observedBankState(operation.method, result?.Status);
        if (state === "settled" && (result.ValorPago !== operation.request.amountCents || !/^\d{8}$/.test(result.DataPagamento || ""))) continue;
        if (state === "settled") {
          const day = result.DataPagamento.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
          if (Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) continue;
        }
        if (state) { await store.observe(operation.id, state, { providerStatus: result.Status, ...(state === "settled" ? { paymentDate: result.DataPagamento.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") } : {}) }); error = null; }
      } else if (operation.method === "payout_pix" && transport.config.methods.has("pix_status")) {
        error = "EVIDENCE_PENDING";
        result = await transport.call("/api/Pix/ConsultarPixLoteId", { ...base, IdentificadorExterno: operation.id });
        if (!Array.isArray(result)) continue;
        const matching = result.filter((row: any) => row.IdentificadorExterno === operation.id);
        if (matching.length !== 1) continue;
        const state = observedBankState(operation.method, matching[0].Status);
        // Query string money units are not documented. Settlement waits for the signed event.
        if (state && state !== "settled") { await store.observe(operation.id, state, { providerStatus: matching[0].Status }); error = null; }
      }
    } catch { error = "QUERY_FAILED"; }
    finally { await store.recordReconciliation(operation.id, error); }
  }
}
