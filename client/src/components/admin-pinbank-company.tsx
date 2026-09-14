import { readPinbankResponse } from "@/lib/pinbank-response";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const base = "/api/admin/pinbank/dev";
function label(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2"); }
function ContractFields({ schema, value, onChange, prefix = "pj" }: { schema: any; value: any; onChange: (v: any) => void; prefix?: string }) {
  if (schema.type === "object") return <div className="grid gap-3 sm:grid-cols-2">{Object.entries(schema.properties || {}).map(([name, field]: [string, any]) => <div key={name} className={field.type === "object" || field.type === "array" ? "sm:col-span-2 rounded border p-3" : ""}><Label htmlFor={`${prefix}-${name}`}>{label(name)}{schema.required?.includes(name) ? " *" : ""}</Label><ContractFields schema={field} value={value?.[name]} onChange={next => onChange({ ...value, [name]: next })} prefix={`${prefix}-${name}`} /></div>)}</div>;
  if (schema.type === "array") return <div className="space-y-3">{(value || []).map((item: any, i: number) => <div key={i} className="rounded border p-3"><ContractFields schema={schema.items} value={item} prefix={`${prefix}-${i}`} onChange={next => onChange(value.map((old: any, index: number) => index === i ? next : old))} /><Button variant="outline" type="button" onClick={() => onChange(value.filter((_: any, index: number) => index !== i))}>Remover</Button></div>)}<Button variant="outline" type="button" onClick={() => onChange([...(value || []), {}])}>Adicionar</Button></div>;
  if (schema.enum || schema.type === "boolean") return <select id={prefix} className="h-11 w-full rounded border bg-background px-3" value={value === undefined ? "" : String(value)} onChange={e => onChange(schema.type === "boolean" ? e.target.value === "true" : e.target.value)}><option value="">Selecione</option>{(schema.enum || ["true", "false"]).map((v: string) => <option key={v} value={v}>{v === "true" ? "Sim" : v === "false" ? "Não" : label(v)}</option>)}</select>;
  const numeric = ["integer", "number"].includes(schema.type);
  return <Input id={prefix} type={numeric ? "number" : "text"} placeholder={schema.format === "date-time" ? "2026-09-09T12:00:00Z" : undefined} value={value ?? ""} onChange={e => onChange(numeric ? Number(e.target.value) : e.target.value)} />;
}
export function AdminPinbankCompany({ enabled, operations = [] }: { enabled: boolean; operations?: any[] }) {
  const cache = useQueryClient();
  const contract = useQuery({ queryKey: [base + "/company/contract"], queryFn: async () => { const res = await fetch(base + "/company/contract", { credentials: "include" }); return readPinbankResponse(res); }, retry: false });
  const [input, setInput] = useState({});
  const [terms, setTerms] = useState("");
  const [account, setAccount] = useState("");
  const [docType, setDocType] = useState("4");
  const [oldDoc, setOldDoc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [fictitious, setFictitious] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reset = () => { setQuote(null); setKey(crypto.randomUUID()); };
  async function run(action: "terms" | "company" | "document" | "confirm") {
    setBusy(true); setError(""); setMessage("");
    try {
      let path: string; let body: BodyInit; let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (action === "document") {
        if (!file) throw new Error("Selecione um documento fictício.");
        const form = new FormData(); form.set("file", file); form.set("type", docType); form.set("accountOperationId", account); form.set("idempotencyKey", key); form.set("fictitiousData", "true"); if (oldDoc) form.set("oldDocumentId", oldDoc);
        path = "/documents/prepare"; body = form; headers = {};
      } else {
        path = action === "terms" ? "/terms/accept" : action === "company" ? "/company/prepare" : `/operations/${quote.id}/confirm`;
        body = JSON.stringify(action === "terms" ? { operationId: terms, accepted: true } : action === "company" ? { input, termsOperationId: terms, idempotencyKey: key, fictitiousData: true } : { confirmation: quote.confirmation });
      }
      const response = await fetch(base + path, { method: "POST", credentials: "include", headers, body }); const result = await readPinbankResponse(response);

      if (action === "terms") setMessage("Aceite registrado com a versão oficial e seu usuário.");
      else if (action === "confirm") { if (result.result?.client) setAccount(result.id); setMessage("Solicitação registrada. A aprovação depende da Pinbank."); reset(); }
      else setQuote(result);
      await cache.invalidateQueries({ queryKey: [base + "/operations"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Serviço indisponível."); }
    finally { setBusy(false); }
  }
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">Conta PJ e documentos — DEV</summary><div className="mt-4 space-y-4">
    <p className="text-sm">Consulte os termos oficiais em “Executar teste”, selecione a versão e leia seu conteúdo antes do aceite. O cadastro aguarda CodigoTermo e liberação da Pinbank.</p>
    <Label htmlFor="pj-terms">Termos oficiais consultados</Label><select id="pj-terms" className="h-11 w-full rounded border bg-background px-3" value={terms} onChange={e => { setTerms(e.target.value); reset(); }}><option value="">Selecione a versão consultada</option>{operations.filter(o => o.method === "terms" && o.state === "completed").map(o => <option key={o.id} value={o.id}>Versão {o.result?.version} — {new Date(o.created_at).toLocaleString("pt-BR")}</option>)}</select>{operations.find(o => o.id === terms)?.result?.content && <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border p-3 text-sm">{operations.find(o => o.id === terms).result.content}</div>}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={fictitious} onChange={e => setFictitious(e.target.checked)} />Estou usando exclusivamente dados fictícios de homologação.</label>
    <Button disabled={busy || !fictitious || !terms} variant="outline" onClick={() => run("terms")}>Li e aceito a versão oficial dos termos</Button>
    <details className="rounded border p-3"><summary className="cursor-pointer">Dados da empresa e do responsável</summary><fieldset className="mt-4" disabled={busy || !!quote}>{contract.data && <ContractFields schema={contract.data} value={input} onChange={v => { setInput(v); reset(); }} />}{contract.isError && <p role="alert">{contract.error.message}</p>}</fieldset><Button className="mt-4" disabled={busy || !!quote || !enabled || !fictitious} onClick={() => run("company")}>Preparar cadastro PJ DEV</Button></details>
    <details className="rounded border p-3"><summary className="cursor-pointer">Enviar ou substituir documento</summary><fieldset disabled={busy || !!quote} className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label htmlFor="pj-account">Identificador da operação de cadastro PJ</Label><Input id="pj-account" value={account} onChange={e => { setAccount(e.target.value); reset(); }} /></div><div><Label htmlFor="pj-document-type">Documento</Label><select id="pj-document-type" className="h-11 w-full rounded border bg-background px-3" value={docType} onChange={e => { setDocType(e.target.value); reset(); }}>{[["4", "CNPJ"], ["5", "Contrato social"], ["6", "RG/CNH do sócio"], ["7", "CPF do sócio"], ["8", "Endereço comercial"]].map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div><div><Label htmlFor="pj-old-document">Código anterior (somente substituição)</Label><Input id="pj-old-document" value={oldDoc} onChange={e => { setOldDoc(e.target.value); reset(); }} /></div><div><Label htmlFor="pj-file">Arquivo PDF, PNG ou JPEG — até 8 MB</Label><Input id="pj-file" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => { setFile(e.target.files?.[0] || null); reset(); }} /></div></fieldset><Button className="mt-4" disabled={busy || !!quote || !enabled || !fictitious} onClick={() => run("document")}>Preparar envio DEV</Button></details>
    {quote && <div className="rounded border border-amber-400 p-4 space-y-2"><p>Revisão DEV: {quote.preview?.name || quote.preview?.filename}</p>{quote.preview?.document && <p>CNPJ: {quote.preview.document}</p>}{quote.preview?.termVersion && <p>Termo: versão {quote.preview.termVersion}</p>}{quote.preview?.client && <p>Cliente: {quote.preview.client}</p>}<Button disabled={busy || !enabled || !fictitious} onClick={() => run("confirm")}>Confirmar envio DEV</Button><Button variant="outline" onClick={reset} disabled={busy}>Editar</Button></div>}
    {error && <p className="text-red-700" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </div></details>;
}
