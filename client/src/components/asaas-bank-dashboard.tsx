import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { bankDashboardSchema, bankEntryGroup, bankMethodLabel, bankStatusLabel, bankTotals, type BankCollection, type BankDashboardData, type BankGroup, type BankPeriod } from "@shared/asaas-dashboard";
import { safeAsaasUrl } from "@shared/contribution-billing";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | null) => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Não informada";
};
const paymentGroups: Array<[BankGroup, string]> = [["received", "Recebidas"], ["confirmed", "Confirmadas"], ["pending", "Pendentes"], ["overdue", "Vencidas"], ["refunded", "Cobranças em estorno"], ["disputed", "Cobranças contestadas"], ["external", "Recebidas fora do Asaas"], ["other", "Outras situações"]];
const transferGroups: Array<[BankGroup, string]> = [["completed", "Concluídas"], ["pending", "Pendentes / processando"], ["failed", "Falhas"], ["cancelled", "Canceladas"], ["other", "Outras situações"]];

function Metric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <div className="min-w-0 rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function CollectionSummary({ data, kind }: { data: BankCollection; kind: "payments" | "transfers" }) {
  const groups = kind === "payments" ? paymentGroups : transferGroups;
  const primary = groups.slice(0, 4);
  const extra = groups.slice(4).filter(([group]) => bankTotals(data.items, kind, group).count > 0);
  const generated = bankTotals(data.items, kind);
  return <section className="space-y-3" aria-label={kind === "payments" ? "Resumo de cobranças" : "Resumo de transferências"}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-semibold">{kind === "payments" ? "Cobranças geradas" : "Transferências solicitadas"}</h3><p className="text-sm text-muted-foreground">{data.available ? `${generated.count} registros · ${money(generated.value)}${data.complete ? "" : " · parcial"}` : "Indisponível"}</p></div>
    {data.error && <p role="alert" className="text-sm text-muted-foreground">{data.error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{primary.map(([group, title]) => {
      const total = bankTotals(data.items, kind, group);
      const detail = group === "confirmed" ? "Aguardando crédito · não é saldo disponível" : kind === "payments" && group === "received" ? "Valor bruto · taxas não descontadas" : undefined;
      return <Metric key={group} title={title} value={data.available ? money(total.value) : "Indisponível"} detail={data.available ? `${total.count} registros${data.complete ? "" : " · parcial"}${detail ? ` · ${detail}` : ""}` : undefined} />;
    })}</div>
    {extra.length > 0 && <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{extra.map(([group, label]) => { const total = bankTotals(data.items, kind, group); return <p key={group}><span className="text-muted-foreground">{label}: </span>{money(total.value)} ({total.count})</p>; })}</div>}
  </section>;
}

export function BankHistory({ data, kind }: { data: BankCollection; kind: "payments" | "transfers" }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const groups = kind === "payments" ? paymentGroups : transferGroups;
  const filtered = data.items.filter(item => (status === "all" || bankEntryGroup(kind, item.status) === status) && `${item.id} ${bankStatusLabel(item.status)} ${bankMethodLabel(item.method)}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  const records = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Buscar no histórico" placeholder="Buscar por referência, situação ou modalidade" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="min-w-0 flex-1" /><select aria-label="Filtrar situação" className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm sm:max-w-64" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="all">Todas as situações</option>{groups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {!data.available ? <p role="alert" className="py-6 text-sm text-muted-foreground">Histórico indisponível. Atualize o painel para tentar novamente.</p> : records.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{search || status !== "all" ? "Nenhum registro corresponde aos filtros." : data.complete ? "Nenhum registro gerado no período." : "Nenhum registro carregado. A consulta está incompleta."}</p> : <div className="divide-y">{records.map(item => <article key={item.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{bankMethodLabel(item.method)}</span><Badge variant="outline">{bankStatusLabel(item.status)}</Badge></div><p className="break-all text-xs text-muted-foreground">{item.id}</p><dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><div><dt className="inline">Criada: </dt><dd className="inline">{date(item.createdAt)}</dd></div><div><dt className="inline">{kind === "payments" ? "Vencimento: " : "Agendada: "}</dt><dd className="inline">{date(item.dueDate)}</dd></div>{item.paidAt && <div><dt className="inline">{kind === "payments" ? "Pagamento: " : "Efetivada: "}</dt><dd className="inline">{date(item.paidAt)}</dd></div>}</dl></div>
      <div className="space-y-2 sm:text-right"><p className="font-semibold tabular-nums">{money(item.value)}</p>{item.netValue !== null && <p className="text-xs text-muted-foreground">Líquido informado: {money(item.netValue)}</p>}<div className="flex flex-wrap gap-3 sm:justify-end">{safeAsaasUrl(item.receiptUrl) && <a className="text-sm underline underline-offset-4" href={safeAsaasUrl(item.receiptUrl)!} target="_blank" rel="noopener noreferrer">Comprovante</a>}{safeAsaasUrl(item.invoiceUrl) && <a className="text-sm underline underline-offset-4" href={safeAsaasUrl(item.invoiceUrl)!} target="_blank" rel="noopener noreferrer">Ver cobrança</a>}</div></div>
    </article>)}</div>}
    {data.available && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><p className="text-xs text-muted-foreground">{filtered.length} registros nos filtros{data.complete ? "" : ` · ${data.items.length}${data.totalCount !== null ? ` de ${data.totalCount}` : ""} carregados`}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span className="text-xs">{currentPage + 1} / {Math.max(1, Math.ceil(filtered.length / 10))}</span><Button size="sm" variant="outline" disabled={(currentPage + 1) * 10 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div></div>}
  </div>;
}

export function BankDashboardView({ data, transferAction }: { data: BankDashboardData; transferAction?: React.ReactNode }) {
  const [history, setHistory] = useState<"payments" | "transfers">("payments");
  return <div className="space-y-6" data-testid="bank-dashboard">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-5"><div><p className="text-sm text-muted-foreground">Saldo disponível da BIA</p><p className="mt-2 text-3xl font-semibold tabular-nums">{data.balance === null ? "Indisponível" : money(data.balance)}</p>{data.balanceError && <p role="alert" className="mt-2 text-sm text-muted-foreground">{data.balanceError}</p>}</div>{transferAction}</div>
    <p className="text-xs text-muted-foreground">Subconta exclusiva desta BIA. Valores nominais dos registros criados de {data.from ? date(data.from) : "início do histórico"} até {date(data.to)}. O período não altera o saldo atual.</p>
    <CollectionSummary data={data.payments} kind="payments" />
    <CollectionSummary data={data.transfers} kind="transfers" />
    <section className="space-y-4 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Histórico da conta</h3><div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de histórico"><Button size="sm" variant={history === "payments" ? "secondary" : "ghost"} aria-pressed={history === "payments"} onClick={() => setHistory("payments")}>Cobranças</Button><Button size="sm" variant={history === "transfers" ? "secondary" : "ghost"} aria-pressed={history === "transfers"} onClick={() => setHistory("transfers")}>Transferências</Button></div></div><BankHistory key={history} data={data[history]} kind={history} /></section>
    <p className="text-xs text-muted-foreground">Consultado em {new Date(data.checkedAt).toLocaleString("pt-BR")}. Cobranças e transferências não substituem o extrato completo da conta.</p>
  </div>;
}

export function AsaasBankDashboard({ biaId, transferAction }: { biaId: string; transferAction?: React.ReactNode }) {
  const [period, setPeriod] = useState<BankPeriod>("90");
  // Finance prefix preserves refresh/transfer invalidation for both the legacy overview and this dashboard.
  const url = `/api/bias/${encodeURIComponent(biaId)}/banco/asaas/finance`;
  const query = useQuery({ queryKey: [url, "dashboard", period], queryFn: ({ signal }) => readBankDashboardRequest(`/api/bias/${encodeURIComponent(biaId)}/banco/asaas/dashboard?period=${period}`, signal), retry: false, staleTime: 60_000, refetchOnWindowFocus: false });
  return <div className="space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="space-y-1 text-sm"><span className="block text-muted-foreground">Período de criação</span><select aria-label="Período de criação" className="h-10 rounded-md border bg-background px-3" value={period} onChange={event => setPeriod(event.target.value as BankPeriod)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option><option value="all">Todo o histórico</option></select></label><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />{query.isFetching ? "Consultando…" : "Atualizar painel"}</Button></div>
    {query.isPending ? <p role="status" className="py-8 text-sm text-muted-foreground">Consultando saldo, cobranças e transferências no Asaas…</p> : query.isError ? <p role="alert" className="py-6 text-sm">Não foi possível consultar o painel. Use Atualizar painel para tentar novamente.</p> : <BankDashboardView key={period} data={query.data} transferAction={transferAction} />}
  </div>;
}

export async function readBankDashboardRequest(url: string, signal: AbortSignal) {
  // AbortSignal.any is not available in every browser supported by the app.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 45_000);
  try {
    const response = await fetch(url, { credentials: "include", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Painel indisponível (${response.status})`);
    return bankDashboardSchema.parse(await response.json());
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
