import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Landmark, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { AsaasBiaStatus } from "@shared/asaas";
import { EXTERNAL_BANKS, type AccountKind, type BankCandidate } from "@shared/external-banking";

type Status = {
  environment: "sandbox" | "production"; choice: "asaas" | "external"; storageReady: boolean; enabled: boolean; canEdit: boolean; canFinance: boolean;
  banks: Array<{ id: string; name: string; cost: string; docs: string; options: Array<{ method: string; kind: string; profileId: string; available: boolean; costs: string; blocker: string | null }> }>;
  connection: null | { id: string; bank: string; kind: string; method: string; state: string; maskedAccount: string; activatedAt: string | null; autoEnabled: boolean; lastSuccessAt: string | null; errorCode: string | null };
};
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não atualizado";
const money = (cents: number, currency = "BRL") => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
const urlFor = (biaId: string) => `/api/bias/${encodeURIComponent(biaId)}/banco/externo`;
async function getJson<T>(url: string): Promise<T> { return (await apiRequest("GET", url)).json(); }
async function writeJson(url: string, method: string, input: unknown) { return (await apiRequest(method, url, input)).json(); }

export function BankAccountChoice({ value, onChange, disabled }: { value: "asaas" | "external"; onChange: (value: "asaas" | "external") => void; disabled: boolean }) {
  return <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2" disabled={disabled}>
    <legend className="mb-3 text-sm text-muted-foreground">Escolha como usar a conta bancária desta BIA.</legend>
    {([{ value: "asaas", title: "Asaas — conta integrada", label: "BaaS", icon: Landmark, text: "Conta integrada à BUILT para cobranças e operações da BIA, conforme habilitação." },
      { value: "external", title: "Outra conta bancária", label: "Conta existente", icon: Building2, text: "Conecte sua conta PF ou PJ em outro banco. O dinheiro permanece lá; a BUILT acompanha os recebimentos autorizados." }] as const).map(option => <label key={option.value} className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 ${disabled ? "opacity-70" : "cursor-pointer"} ${value === option.value ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
      <input type="radio" name="bia-bank-choice" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="mt-1 shrink-0 accent-primary" />
      <div className="min-w-0 space-y-2"><span className="flex flex-wrap items-center gap-2 font-semibold"><option.icon aria-hidden="true" className="h-4 w-4" />{option.title}</span><Badge variant="outline">{option.label}</Badge><span className="block text-sm text-muted-foreground">{option.text}</span></div>
    </label>)}
  </fieldset>;
}

let widgetScript: Promise<void> | undefined;
async function loadPluggyWidget() {
  if ((window as any).PluggyConnect) return;
  if (!widgetScript) widgetScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.3.1/pluggy-connect.js";
    const timer = window.setTimeout(() => { script.remove(); widgetScript = undefined; reject(new Error("Não foi possível carregar a autorização do banco.")); }, 15_000);
    script.onload = () => { clearTimeout(timer); resolve(); }; script.onerror = () => { clearTimeout(timer); script.remove(); widgetScript = undefined; reject(new Error("Não foi possível carregar a autorização do banco.")); };
    document.head.appendChild(script);
  });
  return widgetScript;
}

export function BiaBanking({ biaId, canEdit, children }: { biaId: string; canEdit: boolean; children: React.ReactNode }) {
  const base = urlFor(biaId), cache = useQueryClient();
  // O painel Asaas já consulta esta chave. Observar seu resultado evita uma segunda requisição.
  const asaas = useQuery<AsaasBiaStatus>({ queryKey: [`/api/bias/${encodeURIComponent(biaId)}/banco/asaas/status`], enabled: false });
  const [changingAccount, setChangingAccount] = useState(false);
  const query = useQuery<Status>({ queryKey: [base + "/status"], queryFn: () => getJson(base + "/status"), retry: false });
  const [preview, setPreview] = useState<"asaas" | "external" | null>(null), [error, setError] = useState("");
  const [bank, setBank] = useState("c6"), [kind, setKind] = useState<AccountKind>("PJ"), [methodIndex, setMethodIndex] = useState(0), [document, setDocument] = useState(""), [accepted, setAccepted] = useState(false);
  const [accounts, setAccounts] = useState<{ connectionId: string; options: Array<{ id: string; label: string }> } | null>(null), [accountId, setAccountId] = useState("");
  const widget = useRef<any>();
  const [confirm, setConfirm] = useState<null | "disconnect" | "automation">(null);
  const refresh = async () => { await cache.invalidateQueries({ queryKey: [base + "/status"] }); await cache.invalidateQueries({ queryKey: [base + "/recebimentos"] }); };
  const mutation = useMutation({ mutationFn: async ({ path, input, method = "POST" }: { path: string; input: unknown; method?: string }) => writeJson(base + path, method, input), onSuccess: refresh, onError: () => setError("Não foi possível concluir. Confira a conexão e tente novamente.") });
  const choose = useMutation({ mutationFn: (value: "asaas" | "external") => writeJson(base + "/escolha", "PUT", { choice: value }),
    onSuccess: async () => { setPreview(null); await refresh(); }, onError: () => { setPreview(null); setError("Não foi possível salvar a escolha. A opção anterior foi preservada."); } });
  const connect = useMutation({ mutationFn: async () => {
    const option = query.data?.banks.find(b => b.id === bank)?.options.filter(o => o.kind === kind)[methodIndex];
    if (!option?.available) throw new Error("Conexão indisponível.");
    const result = await writeJson(base + "/conexoes", "POST", { bank, kind, method: option.method, profileId: option.profileId || undefined, ownerDocument: document, costsAccepted: accepted });
    if (result.connected) return;
    await loadPluggyWidget();
    widget.current = new (window as any).PluggyConnect({ connectToken: result.connectToken, includeSandbox: result.sandbox, connectorIds: [result.connectorId], products: ["ACCOUNTS", "TRANSACTIONS"],
      onSuccess: async ({ item }: any) => {
        try {
          const options = await writeJson(base + `/conexoes/${result.id}/contas`, "POST", { itemId: item.id });
          setAccounts({ connectionId: result.id, options }); setAccountId(""); await refresh();
        } catch { setError("A autorização foi recebida, mas a conta ainda não pôde ser validada. Aguarde a atualização do banco ou reinicie a conexão."); }
      }, onError: () => setError("Não foi possível concluir a autorização no banco."), onClose: refresh });
    widget.current.init();
  }, onSuccess: async () => { setDocument(""); setAccepted(false); await refresh(); }, onError: () => { setError("Não foi possível conectar. Confira a habilitação, o titular e as credenciais de consulta com o responsável pela integração."); void refresh(); } });
  const value = preview || query.data?.choice || "asaas", connection = query.data?.connection;
  const options = query.data?.banks.find(b => b.id === bank)?.options.filter(o => o.kind === kind) || [];
  const selected = options[methodIndex];
  const busy = mutation.isPending || choose.isPending || connect.isPending;
  const editable = canEdit && query.data?.canEdit;
  const approvedAsaas = asaas.data?.account?.state === "approved" && value === "asaas";
  const showChoice = value === "external" || (!asaas.isPending && (!approvedAsaas || changingAccount));
  return <div className="min-w-0 space-y-5" data-testid="bia-banking">
    {showChoice && <Card><CardHeader><CardTitle>Conta bancária da BIA</CardTitle></CardHeader><CardContent className="space-y-4">
      <BankAccountChoice value={value} disabled={!editable || busy || !query.data?.storageReady} onChange={next => { setError(""); setPreview(next); choose.mutate(next); }} />
      {query.isPending && <p role="status" className="text-sm text-muted-foreground">Consultando as opções de conta…</p>}
      {query.isError && <div role="alert" className="text-sm"><p>Não foi possível consultar a escolha de conta.</p><Button type="button" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>}
      {query.data && !query.data.storageReady && <p role="status" className="text-sm text-muted-foreground">A escolha de outra conta aguarda a preparação do armazenamento. Sua conta Asaas foi preservada.</p>}
      {choose.isPending && <p role="status" className="text-sm">Salvando escolha…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>}
    <div hidden={value !== "asaas"}>{children}</div>
    {approvedAsaas && editable && query.data?.storageReady && query.data.banks.some(b => b.options.some(o => o.available)) &&
      <Button type="button" size="sm" variant="ghost" aria-expanded={changingAccount} onClick={() => setChangingAccount(open => !open)}>{changingAccount ? "Fechar escolha de conta" : "Alterar conta bancária"}</Button>}
    {value === "external" && <Card><CardHeader><CardTitle>Conectar sua conta em outro banco</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Consulta de recebimentos, sem transferir dinheiro ou pagar despesas. Cada conta atende somente uma BIA.</p>
      {query.data?.environment === "sandbox" && <Badge variant="outline">Ambiente de testes</Badge>}
      {connection ? <div className="space-y-4 rounded-xl border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{EXTERNAL_BANKS.find(b => b.id === connection.bank)?.name} · {connection.kind} {connection.maskedAccount}</p><Badge variant="outline">{connection.state === "connected" ? "Conectada" : connection.activatedAt ? "Atenção na conexão" : "Autorização pendente"}</Badge></div>
        <p className="text-sm text-muted-foreground">Última atualização: {formatDate(connection.lastSuccessAt)}</p>
        {connection.errorCode && <p role="alert" className="text-sm">Não foi possível atualizar. Confira a autorização e os requisitos da conexão; os dados anteriores foram preservados.</p>}
        <p className="text-sm">Baixa automática: <strong>{connection.autoEnabled ? "Ativada para recebimentos identificados com segurança" : "Desativada"}</strong></p>
        {editable && <div className="flex flex-wrap gap-2">
          {connection.activatedAt && <Button type="button" variant="outline" disabled={busy} loading={mutation.isPending} loadingText="Atualizando…" onClick={() => { setError(""); mutation.mutate({ path: `/conexoes/${connection.id}/atualizar`, input: {} }); }}><RefreshCw className="mr-2 h-4 w-4" />Atualizar recebimentos</Button>}
          {connection.activatedAt && query.data?.canFinance && <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm("automation")}>{connection.autoEnabled ? "Pausar baixa automática" : "Ativar baixa automática"}</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm("disconnect")}>{connection.activatedAt ? "Desconectar" : "Cancelar conexão"}</Button>
        </div>}
      </div> : <fieldset disabled={!editable || busy} className="space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Banco</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={bank} onChange={e => { setBank(e.target.value); setMethodIndex(0); setAccepted(false); }}>{EXTERNAL_BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>Tipo de conta</span><select className="h-10 w-full rounded-md border bg-background px-3" value={kind} onChange={e => { setKind(e.target.value as AccountKind); setMethodIndex(0); setAccepted(false); }}><option value="PJ">Pessoa jurídica (PJ)</option><option value="PF">Pessoa física (PF)</option></select></label>
        </div>
        <label className="block space-y-1 text-sm"><span>Forma de conexão</span><select className="h-10 w-full min-w-0 rounded-md border bg-background px-3" value={methodIndex} onChange={e => { setMethodIndex(Number(e.target.value)); setAccepted(false); }}>{options.map((o, i) => <option key={`${o.method}-${o.profileId}-${i}`} value={i}>{o.method === "direct" ? "Direto com o banco" : "Open Finance · Pluggy"}{o.available ? "" : " — aguardando habilitação"}</option>)}</select></label>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm"><p>{selected?.costs || EXTERNAL_BANKS.find(b => b.id === bank)?.cost}</p>{!selected?.available && <p className="font-medium">{selected?.blocker || "Conexão ainda não habilitada."}</p>}<a className="inline-block text-primary underline" target="_blank" rel="noreferrer" href={EXTERNAL_BANKS.find(b => b.id === bank)?.docs}>Requisitos oficiais do banco</a></div>
        {selected?.available && <><label className="block space-y-1 text-sm"><span>CPF ou CNPJ do titular da conta</span><Input autoComplete="off" value={document} maxLength={30} onChange={e => setDocument(e.target.value)} /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>Tenho autorização do titular para conectar esta conta à BIA e conferi as condições e eventuais custos informados.</span></label></>}
        <Button type="button" loading={connect.isPending} loadingText="Conectando…" disabled={!selected?.available || !accepted || !document} onClick={() => { setError(""); connect.mutate(); }}>Conectar conta <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </fieldset>}
      <a className="inline-block text-sm text-primary underline" href={`/bias/${encodeURIComponent(biaId)}?tab=capital&capital=financeiro`}>Conferir recebimentos no Financeiro</a>
    </CardContent></Card>}
    <Dialog open={!!accounts} onOpenChange={open => { if (!open && !busy) setAccounts(null); }}><DialogContent><DialogHeader><DialogTitle>Escolha a conta autorizada</DialogTitle><DialogDescription>Somente contas em reais do titular informado podem ser vinculadas. A mesma conta não pode atender outra BIA.</DialogDescription></DialogHeader>
      {accounts?.options.length ? accounts.options.map(a => <label key={a.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="authorized-bank-account" checked={accountId === a.id} onChange={() => setAccountId(a.id)} />{a.label}</label>) : <p>Nenhuma conta elegível retornada. Aguarde a atualização do banco ou cancele e reinicie a conexão.</p>}
      <DialogFooter><Button type="button" disabled={!accountId || busy} loading={mutation.isPending} onClick={async () => { if (!accounts) return; try { await mutation.mutateAsync({ path: `/conexoes/${accounts.connectionId}/concluir`, input: { accountId } }); setAccounts(null); } catch { /* erro exibido */ } }}>Vincular conta</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>{confirm === "disconnect" ? "Desconectar conta da BUILT?" : connection?.autoEnabled ? "Pausar baixa automática?" : "Ativar baixa automática?"}</DialogTitle><DialogDescription>{confirm === "disconnect" ? "A BUILT interromperá as consultas e apagará o acesso local. O histórico permanece. A autorização de Open Finance também pode ser revogada no aplicativo do banco." : "Apenas recebimentos efetivados e identificados com segurança poderão dar baixa. Diferenças de valor e dúvidas continuarão exigindo sua confirmação."}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</Button><Button type="button" loading={mutation.isPending} disabled={busy} onClick={async () => { if (!connection) return; try { await mutation.mutateAsync({ path: `/conexoes/${connection.id}/${confirm === "disconnect" ? "desconectar" : "automacao"}`, method: confirm === "disconnect" ? "POST" : "PUT", input: { confirm: true, ...(confirm === "automation" ? { enabled: !connection.autoEnabled } : {}) } }); setConfirm(null); } catch { /* erro exibido */ } }}>Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

type ReceiptView = { id: string; state: string; flowId: string | null; automatic: boolean; amountCents: number; currency: string; date: string; description: string; payerName?: string; candidates: BankCandidate[]; errorCode?: string };
export function BankReceipts({ biaId, readOnly }: { biaId: string; readOnly: boolean }) {
  const base = urlFor(biaId), cache = useQueryClient();
  const status = useQuery<Status>({ queryKey: [base + "/status"], queryFn: () => getJson(base + "/status"), retry: false });
  const query = useQuery<ReceiptView[]>({ queryKey: [base + "/recebimentos"], queryFn: () => getJson(base + "/recebimentos"), enabled: !!status.data?.connection?.activatedAt, retry: false });
  const [selected, setSelected] = useState<{ receipt: ReceiptView; candidate: BankCandidate } | null>(null), [error, setError] = useState("");
  const confirm = useMutation({ mutationFn: async () => writeJson(`${base}/recebimentos/${selected!.receipt.id}/confirmar`, "POST", { confirm: true, flowId: selected!.candidate.flowId }),
    onSuccess: async () => { setSelected(null); await cache.invalidateQueries({ queryKey: [base + "/recebimentos"] }); await cache.invalidateQueries({ queryKey: ["/api/fluxo-caixa"] }); }, onError: () => setError("O lançamento ou a conexão mudou. Atualize e confira os dados antes de confirmar novamente.") });
  if (!status.data?.connection?.activatedAt) return null;
  return <Card className="min-w-0" data-testid="bank-receipts"><CardHeader><CardTitle className="text-lg">Recebimentos da conta conectada</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Atualização do banco: {formatDate(status.data.connection.lastSuccessAt)}. Valor e nome isolados não confirmam uma baixa automática.</p>
    {status.data.choice !== "external" && <p className="text-sm text-muted-foreground">Conciliação pausada enquanto a conta Asaas estiver selecionada.</p>}
    {query.isPending ? <p role="status">Consultando recebimentos…</p> : query.isError ? <div role="alert"><p>Não foi possível consultar os recebimentos.</p><Button type="button" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : !query.data?.length ? <p className="text-sm text-muted-foreground">Nenhum recebimento importado desde a conexão.</p> : query.data.map(r => <div key={r.id} className="min-w-0 space-y-2 rounded-lg border bg-background p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong>{money(r.amountCents, r.currency)}</strong><Badge variant="outline">{r.state === "reconciled" ? r.automatic ? "Conciliado automaticamente" : "Conciliado com confirmação" : r.state === "review" ? "Conferência necessária" : r.state === "applying" ? "Baixa em conciliação" : r.candidates.length ? "Sugestões para conferir" : "Sem lançamento identificado"}</Badge></div>
      <p>{formatDate(r.date)}</p><p className="break-words">{r.description}{r.payerName ? ` · ${r.payerName}` : ""}</p>
      {r.state === "suggested" && r.candidates.map(c => <div key={c.flowId} className="space-y-2 border-t pt-3"><p className="break-words font-medium">{c.description} · {money(c.amountCents, r.currency)}</p><p className="text-muted-foreground">{c.reasons.join(" · ")}</p>
        {c.differenceCents !== 0 && <p>Diferença de valor: confira e corrija o lançamento antes da baixa integral.</p>}{c.conflict && <p>Resolva a cobrança existente antes de confirmar este recebimento.</p>}
        {!readOnly && status.data?.canEdit && status.data.canFinance && <Button type="button" size="sm" variant="outline" disabled={status.data.choice !== "external" || !status.data.enabled || c.conflict || c.differenceCents !== 0 || confirm.isPending} onClick={() => { setError(""); setSelected({ receipt: r, candidate: c }); }}>Conferir e confirmar</Button>}
      </div>)}
    </div>)}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !confirm.isPending) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>Confirmar recebimento</DialogTitle><DialogDescription>Confira se este crédito pertence ao lançamento selecionado. A confirmação registra o pagamento no lançamento original.</DialogDescription></DialogHeader><p className="break-words">{selected?.candidate.description}</p><p className="font-semibold">{selected && money(selected.receipt.amountCents, selected.receipt.currency)}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={confirm.isPending} onClick={() => setSelected(null)}>Cancelar</Button><Button type="button" loading={confirm.isPending} onClick={() => confirm.mutate()}>Confirmar recebimento</Button></DialogFooter></DialogContent></Dialog>
  </CardContent></Card>;
}
