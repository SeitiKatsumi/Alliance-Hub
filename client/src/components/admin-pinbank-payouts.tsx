import { readPinbankResponse } from "@/lib/pinbank-response";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";

const base = "/api/admin/pinbank/dev";
const labels: Record<string, string> = { pix: "Pix", internal: "Transferência interna", ted: "TED", bill: "Pagamento de boleto", refund: "Devolução de Pix" };
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fieldSets: Record<string, [string, string, string][]> = {
  refund: [["endToEndId", "Identificador fim a fim do Pix recebido", "text"], ["description", "Motivo da devolução", "text"]],
  pix: [["keyOrQr", "Chave Pix ou código copia e cola", "text"]],
  internal: [["recipientChannel", "Canal do destinatário", "number"], ["recipientClient", "Cliente do destinatário", "number"]],
  ted: [["bank", "Código do banco", "text"], ["branch", "Agência", "text"], ["branchDigit", "Dígito da agência", "text"], ["account", "Conta", "text"], ["accountDigit", "Dígito da conta", "text"], ["name", "Nome do destinatário", "text"], ["document", "CPF/CNPJ do destinatário", "text"], ["date", "Data da transferência", "date"]],
  bill: [["line", "Linha digitável (47 números)", "text"], ["date", "Data do pagamento", "date"]],
};
export function AdminPinbankPayouts({ enabled }: { enabled: boolean }) {
  const cache = useQueryClient();
  const [type, setType] = useState("pix");
  const [fields, setFields] = useState<Record<string, any>>({ byKey: true });
  const [quote, setQuote] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function update(name: string, value: any) { setFields(old => ({ ...old, [name]: value })); setQuote(null); setKey(crypto.randomUUID()); setAccepted(false); }
  async function submit(confirm: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(confirm ? `${base}/operations/${quote.id}/confirm` : `${base}/payouts/prepare`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(confirm ? { confirmation: quote.confirmation } : { input: { ...fields, type }, idempotencyKey: key, fictitiousData: true }) });
      const result = await readPinbankResponse(response);

      if (confirm) { setQuote(null); setMessage("Solicitação enviada. Aguarde a confirmação de liquidação no histórico."); }
      else { setQuote(result); setAccepted(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "Serviço indisponível."); }
    finally { setBusy(false); await cache.invalidateQueries({ queryKey: [base + "/operations"] }); }
  }
  return <section className="rounded-lg border p-4 space-y-4">
    <h2 className="font-semibold">Saídas — somente DEV</h2>
    <p className="text-sm text-muted-foreground">Consulte o destinatário, revise a origem e o valor e confirme o teste. As saídas dependem da habilitação do método no servidor.</p>
    <fieldset disabled={busy || !!quote} className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="out-type">Tipo de saída</Label><select id="out-type" className="h-11 w-full rounded border bg-background px-3" value={type} onChange={e => { setType(e.target.value); setFields(e.target.value === "pix" ? { byKey: true } : e.target.value === "ted" ? { accountType: "Corrente", branchDigit: "" } : {}); setKey(crypto.randomUUID()); setAccepted(false); }}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
      <div><Label htmlFor="out-amount">Valor em centavos (R$ 1,00 = 100)</Label><Input id="out-amount" type="number" min="1" step="1" value={fields.amountCents || ""} onChange={e => update("amountCents", Number(e.target.value))} /></div>
      {fieldSets[type].map(([name, label, kind]) => <div key={name}><Label htmlFor={`out-${name}`}>{label}</Label><Input id={`out-${name}`} type={kind} value={fields[name] ?? ""} onChange={e => update(name, kind === "number" ? Number(e.target.value) : e.target.value)} /></div>)}
      {type === "pix" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.byKey} onChange={e => update("byKey", e.target.checked)} />O destino informado é uma chave Pix</label>}
      {type === "ted" && <div><Label htmlFor="out-account-type">Tipo de conta</Label><select id="out-account-type" className="h-11 w-full rounded border bg-background px-3" value={fields.accountType} onChange={e => update("accountType", e.target.value)}><option>Corrente</option><option>Poupanca</option></select></div>}
    </fieldset>
    {quote?.preview && <div className="rounded border border-amber-400 bg-amber-50 p-4 text-amber-950 space-y-2"><h3 className="font-semibold">Confirme os dados da saída DEV</h3><p>Origem: {quote.preview.originChannel}/{quote.preview.originClient}</p><p>Destinatário: {quote.preview.recipient}</p><p>Documento: {quote.preview.document}</p><p className="break-all">Conta ou boleto: {quote.preview.account}</p><p>Valor: {money(quote.preview.amountCents)}</p><p>Tarifa: {quote.preview.feeCents === null ? "Não informada pelo provedor" : money(quote.preview.feeCents)}</p><Button variant="outline" disabled={busy} onClick={() => { setQuote(null); setAccepted(false); }}>Editar e preparar novamente</Button></div>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />Confirmo que estes são dados fictícios autorizados para DEV{quote ? " e que revisei destinatário, origem e valor" : ""}.</label>
    {!enabled && <p className="text-sm">Novas operações DEV estão desabilitadas no servidor.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    <Button disabled={!enabled || !accepted || busy} onClick={() => submit(!!quote)}>{busy ? "Aguarde…" : quote ? "Confirmar saída DEV" : "Consultar e preparar saída"}</Button>
  </section>;
}
