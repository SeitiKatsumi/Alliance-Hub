import { readPinbankResponse, validatePinbankStatus } from "@/lib/pinbank-response";
import { AdminPinbankCompany } from "./admin-pinbank-company";
import { AdminPinbankPayouts } from "./admin-pinbank-payouts";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const api = "/api/admin/pinbank/dev";
async function request(path: string, body?: unknown) {
  const response = await fetch(api + path, { method: body === undefined ? "GET" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await readPinbankResponse(response);

  return path === "/status" ? validatePinbankStatus(data) : data;
}
const stateLabels: Record<string, string> = { preparing: "Consultando destinatário", prepared: "Preparada", sending: "Enviada — aguardando confirmação", pending: "Pendente", unknown: "Resultado desconhecido — conciliar", completed: "Consulta concluída", settled: "Liquidação confirmada", rejected: "Recusada", cancelled: "Cancelada", refunded: "Devolvida" };
const reconciliationLabels: Record<string, string> = { METHOD_PENDING: "Consulta ainda não habilitada ou sem referência", EVIDENCE_PENDING: "Aguardando evidência conclusiva", QUERY_FAILED: "Falha na consulta; nova tentativa automática" };
const fields = { name: "Nome", document: "CPF/CNPJ (somente números)", email: "E-mail de teste", address: "Endereço", district: "Bairro", city: "Cidade", state: "UF", zip: "CEP" };
function BankQrCode({ text }: { text: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let current = true; QRCode.toDataURL(text, { width: 240, margin: 2 }).then(value => { if (current) setUrl(value); }).catch(() => setUrl("")); return () => { current = false; }; }, [text]);
  return <div>{url && <img src={url} width={240} height={240} alt="QR Code Pix de homologação" />}<p className="break-all text-xs">{text}</p></div>;
}

export function AdminPinbank() {
  const cache = useQueryClient();
  const status = useQuery({ queryKey: [api + "/status"], queryFn: () => request("/status"), retry: false });
  const history = useQuery({ queryKey: [api + "/operations"], queryFn: () => request("/operations"), retry: false, enabled: !!status.data?.storageReady });
  const [method, setMethod] = useState("balance");
  const [input, setInput] = useState<Record<string, any>>({});
  const [beneficiaries, setBeneficiaries] = useState([{ channel: "47", client: "", amountCents: "" }]);
  const [fictitious, setFictitious] = useState(false);
  const [prepared, setPrepared] = useState<any>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const change = (name: string, value: unknown) => { setInput(old => ({ ...old, [name]: value, ...(["start", "end"].includes(name) ? { offset: 0 } : {}) })); setPrepared(null); setKey(crypto.randomUUID()); setResult(null); };
  const run = async (confirm: boolean) => {
    setBusy(true); setError("");
    try {
      if (confirm) {
        const answer = await request(`/operations/${prepared.id}/confirm`, { confirmation: prepared.confirmation });
        setResult(answer); setPrepared(null); setKey(crypto.randomUUID());
      } else {
        const payload = method === "boleto_split" ? { ...input, beneficiaries: beneficiaries.map(b => ({ channel: Number(b.channel), client: Number(b.client), amountCents: Number(b.amountCents) })) } : input;
        setPrepared(await request("/prepare", { method, input: payload, idempotencyKey: key, fictitiousData: fictitious }));
      }
      await cache.invalidateQueries({ queryKey: [api + "/operations"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir."); await cache.invalidateQueries({ queryKey: [api + "/operations"] }); }
    finally { setBusy(false); }
  };
  if (status.isPending) return <p className="p-6" role="status">Carregando homologação…</p>;
  if (status.isError) return <div className="space-y-3 p-4 sm:p-6"><p className="text-red-700" role="alert">{status.error.message}</p><p className="text-sm text-muted-foreground">O backend de homologação DEV precisa estar disponível e configurado. As operações permanecem indisponíveis.</p><Button variant="outline" disabled={status.isFetching} onClick={() => void status.refetch()}>Tentar novamente</Button></div>;
  const data = status.data;
  const isBoleto = method === "boleto" || method === "boleto_split";
  const isWrite = ["boleto", "boleto_split", "payment_link", "pix_charge", "pix_expire"].includes(method);
  return <section className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950">
      <h1 className="text-xl font-semibold">Pinbank — Homologação <span className="ml-2 rounded bg-amber-200 px-2 text-sm">DEV</span></h1>
      <p className="mt-2 text-sm">Área exclusiva de administradores. Use somente os dados fictícios permitidos pela Pinbank. Os testes ficam separados do financeiro das BIAs.</p>
    </div>
    <dl className="grid gap-3 sm:grid-cols-3">
      {[ ["Ambiente DEV", data.enabled ? "Habilitado" : "Desabilitado"], ["Credenciais no servidor", data.credentialsPresent ? "Presentes — validação pelo teste" : "Pendentes"], ["Armazenamento isolado", data.storageReady ? "Disponível" : "Migração pendente"] ].map(([label, value]) => <div key={label} className="rounded-lg border p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
    </dl>
    <div className="rounded-lg border p-4 space-y-4">
      <h2 className="font-semibold">Executar teste</h2>
      <p className="text-sm text-muted-foreground">Comece por Saldo: o servidor gera o token e realiza uma consulta autenticada. Criar um boleto não significa que ele foi pago.</p>
      <Label htmlFor="bank-method">Operação</Label>
      <select id="bank-method" className="h-11 w-full rounded-md border bg-background px-3" value={method} disabled={busy} onChange={e => { setMethod(e.target.value); setInput({}); setPrepared(null); setResult(null); setKey(crypto.randomUUID()); }}>
        {data.methods.map((m: any) => <option key={m.id} value={m.id}>{m.label}{m.enabled ? "" : " — pendente"}</option>)}
      </select>
      {!prepared && <fieldset disabled={busy} className="space-y-4">
        {["account", "documents"].includes(method) && <div><Label htmlFor="query-account">Conta consultada</Label><select id="query-account" className="h-11 w-full rounded border bg-background px-3" value={input.accountOperationId || ""} onChange={e => { setInput(e.target.value ? { accountOperationId: e.target.value } : {}); setPrepared(null); setKey(crypto.randomUUID()); }}><option value="">Conta de testes fornecida pela Pinbank</option>{history.data?.filter((o: any) => o.method === "company" && o.result?.client).map((o: any) => <option key={o.id} value={o.id}>Cadastro PJ DEV — cliente {o.result.client}</option>)}</select></div>}
        {["payment_link", "pix_charge"].includes(method) && <div><Label htmlFor="simple-amount">Valor em centavos (R$ 1,00 = 100)</Label><Input id="simple-amount" type="number" min="1" step="1" value={input.amountCents ?? ""} onChange={e => change("amountCents", Number(e.target.value))} /></div>}
        {method === "payment_link" && <div className="grid gap-3 sm:grid-cols-3">{["name", "document", "email"].map(field => <div key={field}><Label htmlFor={`link-${field}`}>{fields[field as keyof typeof fields]}</Label><Input id={`link-${field}`} value={input[field] || ""} onChange={e => change(field, e.target.value)} /></div>)}</div>}
        {method === "pix_charge" && <div><Label htmlFor="pix-expiration">Expiração em segundos (60 a 86400)</Label><Input id="pix-expiration" type="number" min="60" max="86400" value={input.expirationSeconds ?? ""} onChange={e => change("expirationSeconds", Number(e.target.value))} /></div>}
        {["pix_status", "pix_expire"].includes(method) && <div><Label htmlFor="pix-reference">Identificador da cobrança Pix</Label><Input id="pix-reference" type="number" min="1" value={input.qrId ?? ""} onChange={e => change("qrId", Number(e.target.value))} /></div>}
        {isBoleto && <><div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="bank-amount">Valor em centavos (R$ 1,00 = 100)</Label><Input id="bank-amount" type="number" min="1" step="1" value={input.amountCents ?? ""} onChange={e => change("amountCents", Number(e.target.value))} /></div>
          <div><Label htmlFor="bank-due">Vencimento</Label><Input id="bank-due" type="date" value={input.dueDate || ""} onChange={e => change("dueDate", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="bank-description">Descrição</Label><Input id="bank-description" value={input.description || ""} onChange={e => change("description", e.target.value)} /></div>
          {Object.entries(fields).map(([field, label]) => <div key={field}><Label htmlFor={`payer-${field}`}>{label}</Label><Input id={`payer-${field}`} value={input.payer?.[field] || ""} onChange={e => change("payer", { ...input.payer, [field]: e.target.value })} /></div>)}
        </div>
        {method === "boleto_split" && <div className="space-y-3"><h3 className="font-medium">Beneficiários do split</h3>{beneficiaries.map((b, index) => <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-4">{([ ["channel", "Canal"], ["client", "Cliente"], ["amountCents", "Centavos"] ] as const).map(([field, label]) => <div key={field}><Label htmlFor={`split-${index}-${field}`}>{label}</Label><Input id={`split-${index}-${field}`} type="number" min="1" value={b[field]} onChange={e => { setBeneficiaries(old => old.map((v, i) => i === index ? { ...v, [field]: e.target.value } : v)); setKey(crypto.randomUUID()); }} /></div>)}<Button variant="outline" onClick={() => { setBeneficiaries(old => old.filter((_, i) => i !== index)); setKey(crypto.randomUUID()); }}>Remover</Button></div>)}<Button variant="outline" onClick={() => { setBeneficiaries(old => [...old, { channel: "47", client: "", amountCents: "" }]); setKey(crypto.randomUUID()); }}>Adicionar beneficiário</Button></div>}</>}
        {method === "statement" && <div className="grid gap-3 sm:grid-cols-2">{["start", "end"].map(k => <div key={k}><Label htmlFor={`bank-${k}`}>{k === "start" ? "De" : "Até"}</Label><Input id={`bank-${k}`} type="date" value={input[k] || ""} onInput={e => change(k, e.currentTarget.value)} /></div>)}</div>}
        {method === "receipt" && <div><Label htmlFor="bank-receipt">Identificador do comprovante</Label><Input id="bank-receipt" type="number" value={input.receiptId || ""} onChange={e => change("receiptId", Number(e.target.value))} /></div>}
        {method === "boleto_status" && <div><Label htmlFor="bank-reference">Nosso número</Label><Input id="bank-reference" value={input.reference || ""} onChange={e => change("reference", e.target.value)} /></div>}
      </fieldset>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={fictitious} disabled={busy || !!prepared} onChange={e => setFictitious(e.target.checked)} />Confirmo o uso exclusivo de dados de homologação autorizados pela Pinbank.</label>
      {prepared && <div className="rounded border border-blue-300 bg-blue-50 p-4 text-blue-950 space-y-2"><h3 className="font-semibold">Revisar antes do envio — DEV</h3><p>Operação: {data.methods.find((m: any) => m.id === prepared.method)?.label}</p><p>Origem: canal {prepared.origin.channel}, cliente {prepared.origin.client}</p>{prepared.input.amountCents && <p>Valor: {(prepared.input.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}{prepared.input.payer && <p>Pagador: {prepared.input.payer.name} · {prepared.input.payer.document}</p>}{prepared.input.beneficiaries?.map((b: any, i: number) => <p key={i}>Beneficiário {b.channel}/{b.client}: {(b.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>)}{prepared.method === "statement" && <p>Período: {prepared.input.start} a {prepared.input.end} · Página {Math.floor((prepared.input.offset || 0) / 100) + 1}</p>}<p className="text-sm">Validade da confirmação: 10 minutos.</p><Button variant="outline" onClick={() => setPrepared(null)} disabled={busy}>Editar dados</Button></div>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <Button onClick={() => run(!!prepared)} disabled={busy || !fictitious || !data.enabled || !data.storageReady || !data.methods.find((m: any) => m.id === method)?.enabled || (isWrite && !data.newOperationsEnabled)}>{busy ? "Aguarde…" : prepared ? "Confirmar teste DEV" : "Preparar teste"}</Button>
      {result?.result?.qrText && <BankQrCode text={result.result.qrText} />}
      {result?.result?.paymentUrl && <a className="block underline" href={result.result.paymentUrl} target="_blank" rel="noopener noreferrer">Abrir link de pagamento DEV</a>}
      {result?.result?.providerStatus && <p>Situação retornada: {result.result.providerStatus}</p>}
      {result?.result?.name && <p>Conta: {result.result.name} · {result.result.document}</p>}
      {result?.result?.accountStatus && <div className="space-y-2"><p>Conta: {result.result.accountStatus} · {result.result.documentCount} documentos cadastrados</p>{result.result.documents?.map((doc: any) => <div key={doc.id} className="rounded border p-3 text-sm break-words"><p>{doc.description || doc.filename} — {doc.status}</p><p>Documento {doc.id} · Tipo {doc.type}</p>{doc.rejectionReason && <p>Motivo da devolução: {doc.rejectionReason}</p>}</div>)}</div>}
      {result?.result?.transactions && <div className="space-y-2">{result.result.transactions.map((item: any) => <div key={item.id} className="flex flex-wrap gap-3 rounded border p-2 text-sm"><span>{item.date}</span><span>{item.description}</span><span>{item.amount}</span>{item.receiptId && <span>Comprovante: {item.receiptId}</span>}</div>)}<p className="text-sm">Página {Math.floor((result.result.offset || 0) / 100) + 1}</p><div className="flex flex-wrap gap-2">{result.result.offset > 0 && <Button variant="outline" disabled={busy} onClick={() => change("offset", Math.max(0, result.result.offset - 100))}>Voltar uma página</Button>}{result.result.nextOffset != null && <Button variant="outline" disabled={busy} onClick={() => change("offset", result.result.nextOffset)}>Consultar próxima página</Button>}</div></div>}
      {result?.result?.receipts && result.result.receipts.map((item: any) => <div key={item.id} className="rounded border p-3"><p>Comprovante {item.id}</p><p>{item.description}</p><p>{item.date}</p>{item.downloadable && <a className="underline" href={`${api}/operations/${result.id}/receipts/${item.id}/pdf`}>Baixar comprovante PDF — DEV</a>}</div>)}
      {result && <div role="status" className="rounded border p-3 space-y-2"><p>{stateLabels[result.state]}</p>{result.result?.balance !== undefined && <p>Saldo retornado: {result.result.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}{result.result?.reference && <p>Referência: {result.result.reference}</p>}{result.result?.paymentLine && <p className="break-all">Linha digitável: {result.result.paymentLine}</p>}{result.result?.content && <p className="whitespace-pre-wrap break-words">{result.result.content}</p>}{result.result?.message && <p>{result.result.message}</p>}</div>}
    </div>
    <AdminPinbankCompany operations={history.data || []} enabled={data.enabled && data.storageReady && data.newOperationsEnabled} />
    <AdminPinbankPayouts enabled={data.enabled && data.storageReady && data.newOperationsEnabled} />
    <div className="space-y-3"><h2 className="font-semibold">Histórico persistido de testes</h2>{history.isError && <p role="alert">Não foi possível consultar o histórico.</p>}{history.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum teste registrado.</p>}{history.data?.map((op: any) => <div key={op.id} className="flex flex-wrap justify-between gap-2 rounded border p-3 text-sm"><span>{data.methods.find((m: any) => m.id === op.method)?.label || op.method}</span><code className="break-all text-xs">{op.id}</code><span>{stateLabels[op.state] || op.state}</span><time>{new Date(op.created_at).toLocaleString("pt-BR")}</time>{op.last_reconciled_at && <span className="w-full text-xs text-muted-foreground">Última conciliação: {new Date(op.last_reconciled_at).toLocaleString("pt-BR")}{op.reconciliation_error && ` · ${reconciliationLabels[op.reconciliation_error] || "Pendente"}`}</span>}</div>)}</div>
    <div className="rounded border p-4"><h2 className="font-semibold">Etapas ainda pendentes</h2><ul className="mt-2 list-disc pl-5 text-sm space-y-1">{data.pending.map((p: string) => <li key={p}>{p}</li>)}</ul></div>
  </section>;
}
