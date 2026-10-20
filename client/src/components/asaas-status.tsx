import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowRightLeft, Loader2, RefreshCw } from "lucide-react";
import { asaasStatusSchema, asaasBiaStatusSchema, type AsaasStatus, type AsaasBiaStatus, type AsaasSubaccountCreate, type AsaasTransferInput } from "@shared/asaas";

const states = {
  disabled: "Integração ainda não habilitada", configuration_pending: "Configuração pendente",
  foundation_ready: "Base preparada para operação", operational: "Operações habilitadas",
};
const accountStates = { draft: "Em preparação", pending: "Cadastro pendente", in_review: "Em análise", approved: "Aprovada", rejected: "Recusada", blocked: "Bloqueada" };
const owners = { undetermined: "Titularidade a definir", company: "Empresa responsável", bia: "Titular da BIA", platform: "Plataforma BUILT" };

export function AsaasAdminSummary({ data }: { data: AsaasStatus }) {
  return <div className="space-y-5" data-testid="asaas-admin-status">
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Asaas</CardTitle><Badge variant="outline">{data.environment === "sandbox" ? "Sandbox · testes" : "Produção"}</Badge></div></CardHeader><CardContent className="space-y-4">
      <p className="font-medium">{states[data.state]}</p>
      <p className="text-sm text-muted-foreground">A base integra contas de SPEs e holdings. Cada recurso é liberado conforme a configuração e a aprovação da conta no ambiente selecionado.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Configuração Sandbox</p><p>{data.configurationValid && data.enabled && data.credentialsPresent && data.webhookTokenPresent && data.environment === "sandbox" ? "Configurada" : "Pendente"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">BaaS</p><p>{data.baasEnabled ? "Habilitação informada · homologação pendente" : "Habilitação a confirmar"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Armazenamento</p><p>{data.storageReady ? "Estrutura disponível" : "Preparação pendente"}</p></div>
      </div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Próximos passos</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm">{data.pending.map(item => <li key={item}>{item}</li>)}</ul></CardContent></Card>
    <Card><CardHeader><CardTitle>Recursos</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{data.capabilities.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="text-sm">{item.label}</span><Badge variant="outline">{item.available ? "Disponível" : "Pendente"}</Badge></div>)}</CardContent></Card>
  </div>;
}

async function readStatus(url: string) {
  const response = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) throw new Error("Não foi possível consultar o Asaas.");
  return response.json();
}

export function AdminAsaas() {
  const query = useQuery({ queryKey: ["/api/admin/asaas/status"], queryFn: async () => asaasStatusSchema.parse(await readStatus("/api/admin/asaas/status")), retry: false, staleTime: 30_000, refetchOnWindowFocus: true });
  return <div className="mx-auto max-w-6xl p-4 sm:p-6">{query.isPending ? <p>Consultando a configuração Asaas…</p> : query.isError ? <div role="alert"><p>Não foi possível consultar a configuração Asaas.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <AsaasAdminSummary data={query.data} />}</div>;
}

export function AsaasBiaSummary({ data, actions, children }: { data: AsaasBiaStatus; actions?: React.ReactNode; children?: React.ReactNode }) {
  return <Card data-testid="asaas-bia-status"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Conta da empresa · Asaas</CardTitle><Badge variant="outline">{data.environment === "sandbox" ? "Ambiente de testes" : "Produção"}</Badge></div></CardHeader><CardContent className="space-y-3">
    <p>{states[data.integrationState]}</p>
    {data.account ? <div className="rounded-lg border p-3"><p className="font-medium break-words">{data.account.label}</p><p className="text-sm text-muted-foreground">{owners[data.account.ownership]} · {accountStates[data.account.state]}</p><p className="mt-2 text-sm">{data.account.state === "approved" ? `${data.chargesEnabled ? "Cobranças habilitadas" : "Cobranças pendentes"} · ${data.transfersEnabled ? "Transferências habilitadas" : "Transferências pendentes"}.` : "As operações serão liberadas quando a conta estiver aprovada."}</p></div> : data.storageReady ? <p className="text-sm text-muted-foreground">Nenhuma conta Asaas vinculada a esta BIA. O vínculo será feito com a conta da SPE ou holding responsável.</p> : <p className="text-sm text-muted-foreground">O vínculo com a conta da empresa poderá ser consultado após a preparação do armazenamento.</p>}
    {!data.storageReady && <p className="text-sm text-muted-foreground">A estrutura dos vínculos de conta ainda está em preparação.</p>}
    {actions}
    {children}
    <p className="text-sm text-muted-foreground">O Sandbox não movimenta dinheiro real. Em Produção, as operações usam a conta aprovada e as permissões financeiras da BIA.</p>
  </CardContent></Card>;
}

const initialSubaccount: AsaasSubaccountCreate = {
  name: "", email: "", cpfCnpj: "", companyType: "LIMITED", mobilePhone: "", incomeValue: 0,
  address: "", addressNumber: "", complement: "", province: "", postalCode: "",
  taxRegime: "UNKNOWN", environmentConfirmation: false,
};

async function writeJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST", credentials: "include", headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível concluir a solicitação.");
  return data;
}

function SubaccountDialog({ biaId, statusUrl, environment }: { biaId: string; statusUrl: string; environment: "sandbox" | "production" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AsaasSubaccountCreate>(initialSubaccount);
  const update = <K extends keyof AsaasSubaccountCreate>(key: K, value: AsaasSubaccountCreate[K]) => setForm(current => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () => writeJson(`/api/bias/${encodeURIComponent(biaId)}/banco/asaas/accounts`, form),
    onSuccess: async () => {
      setOpen(false); setForm(initialSubaccount);
      await queryClient.invalidateQueries({ queryKey: [statusUrl] });
      toast({ title: "Subconta Asaas criada", description: "A conta foi vinculada à BIA. A situação cadastral pode ser atualizada nesta tela." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível criar a subconta", description: error.message, variant: "destructive" }),
  });
  const field = (key: keyof AsaasSubaccountCreate, label: string, props: React.ComponentProps<typeof Input> = {}) => <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><Input {...props} value={String(form[key] ?? "")} onChange={event => update(key, event.target.value as never)} /></label>;
  return <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}>
    <DialogTrigger asChild><Button type="button" data-testid="button-create-asaas-subaccount">Criar conta Asaas no Sandbox</Button></DialogTrigger>
    <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:gap-4 sm:p-6">
      <DialogHeader className="px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] pr-12 text-left sm:p-0">
        <DialogTitle>{environment === "sandbox" ? "Criar subconta de testes" : "Criar subconta de Produção"}</DialogTitle>
        <DialogDescription>Cadastre a SPE ou holding no Asaas {environment === "sandbox" ? "Sandbox" : "Produção"}. Use somente dados autorizados do titular.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain border-y px-4 py-4 sm:border-0 sm:p-0">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          {environment === "sandbox" ? "Ambiente sem dinheiro real. " : "Ambiente com movimentação financeira real. "}Serviço bancário fornecido pelo <a className="font-medium underline" href="https://www.asaas.com" target="_blank" rel="noreferrer">Asaas</a>. Após a aprovação da conta, cobranças e transferências ficam disponíveis conforme a configuração deste ambiente.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Razão social *", { autoComplete: "organization", maxLength: 150 })}
          {field("cpfCnpj", "CNPJ *", { inputMode: "numeric", placeholder: "00.000.000/0000-00" })}
          {field("email", "E-mail da empresa *", { type: "email", autoComplete: "email" })}
          {field("mobilePhone", "Celular com DDD *", { inputMode: "tel", autoComplete: "tel", placeholder: "11999999999" })}
          <label className="space-y-1 text-sm"><span className="font-medium">Tipo da empresa *</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.companyType} onChange={event => update("companyType", event.target.value as AsaasSubaccountCreate["companyType"])}><option value="LIMITED">Sociedade limitada</option><option value="MEI">MEI</option><option value="INDIVIDUAL">Empresário individual</option><option value="ASSOCIATION">Associação</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Regime tributário</span><select className="h-10 w-full rounded-md border bg-background px-3" value={form.taxRegime || "UNKNOWN"} onChange={event => update("taxRegime", event.target.value as AsaasSubaccountCreate["taxRegime"])}><option value="UNKNOWN">Não informado</option><option value="NATIONAL_SIMPLE">Simples Nacional</option><option value="NORMAL_REGIME">Regime normal</option><option value="MEI">MEI</option></select></label>
          {field("incomeValue", "Faturamento mensal estimado (R$) *", { type: "number", min: 0.01, step: 0.01, inputMode: "decimal" })}
          {field("postalCode", "CEP *", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "00000000" })}
          {field("address", "Logradouro *", { autoComplete: "street-address" })}
          {field("addressNumber", "Número *", {})}
          {field("complement", "Complemento", {})}
          {field("province", "Bairro *", {})}
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.environmentConfirmation} onChange={event => update("environmentConfirmation", event.target.checked)} /><span>Confirmo que este cadastro será enviado ao ambiente de {environment === "sandbox" ? "testes" : "Produção"} do Asaas e que tenho autorização para usar os dados informados.</span></label>
      </div>
      <DialogFooter className="shrink-0 gap-2 border-t px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:border-0 sm:p-0">
        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancelar</Button>
        <Button type="button" className="w-full sm:w-auto" disabled={mutation.isPending || !form.environmentConfirmation} onClick={() => mutation.mutate()} data-testid="button-confirm-create-asaas-subaccount">{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar e vincular</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AccountOperations({ biaId, canEdit, environment, chargesEnabled, transfersEnabled }: { biaId: string; canEdit: boolean; environment: "sandbox" | "production"; chargesEnabled: boolean; transfersEnabled: boolean }) {
  const { toast } = useToast();
  const url = `/api/bias/${encodeURIComponent(biaId)}/banco/asaas/finance`;
  const query = useQuery<any>({ queryKey: [url], queryFn: () => readStatus(url), retry: false, staleTime: 15_000, refetchOnWindowFocus: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AsaasTransferInput>({ destinationType: "PIX", value: 0, pixAddressKey: "", pixAddressKeyType: "CPF", walletId: "", description: "", idempotencyKey: crypto.randomUUID(), confirmation: false });
  const mutation = useMutation({
    mutationFn: () => writeJson(`/api/bias/${encodeURIComponent(biaId)}/banco/asaas/transfers`, form),
    onSuccess: async () => { setOpen(false); await queryClient.invalidateQueries({ queryKey: [url] }); toast({ title: environment === "sandbox" ? "Transferência de teste enviada" : "Transferência enviada", description: "A situação será conciliada com o Asaas." }); },
    onError: (error: Error) => toast({ title: "Não foi possível transferir", description: error.message, variant: "destructive" }),
  });
  if (query.isPending) return <p className="text-sm text-muted-foreground">Consultando saldo e transferências…</p>;
  if (query.isError) return <div role="alert" className="rounded-lg border p-3 text-sm"><p>Saldo e transferências indisponíveis.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return <div className="space-y-3 rounded-lg border p-3" data-testid="asaas-account-operations">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Saldo disponível</p><p className="text-xl font-semibold">{money(query.data.balance)}</p></div>{canEdit && transfersEnabled && <Button type="button" variant="outline" onClick={() => { setForm({ destinationType: "PIX", value: 0, pixAddressKey: "", pixAddressKeyType: "CPF", walletId: "", description: "", idempotencyKey: crypto.randomUUID(), confirmation: false }); setOpen(true); }}><ArrowRightLeft className="mr-2 h-4 w-4" />Transferir</Button>}</div>
    {!!query.data.transfers?.length && <div className="space-y-2"><p className="text-sm font-medium">Transferências recentes</p>{query.data.transfers.map((item: any) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded border p-2 text-sm"><span>{item.operationType || item.type || "Transferência"} · {item.status}</span><span>{money(item.value)}</span></div>)}</div>}
    <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}><DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{environment === "sandbox" ? "Transferência de teste" : "Nova transferência"}</DialogTitle><DialogDescription>{environment === "sandbox" ? "Nenhum dinheiro real será movimentado." : "Esta operação movimentará dinheiro real da conta da empresa."}</DialogDescription></DialogHeader>
      <div className="space-y-4"><label className="block text-sm"><span className="font-medium">Destino</span><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={form.destinationType} onChange={event => setForm(current => ({ ...current, destinationType: event.target.value as "PIX" | "ASAAS", confirmation: false }))}><option value="PIX">Chave Pix</option><option value="ASAAS">Conta Asaas vinculada</option></select></label>
        {form.destinationType === "PIX" ? <><label className="block text-sm"><span className="font-medium">Tipo da chave</span><select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={form.pixAddressKeyType} onChange={event => setForm(current => ({ ...current, pixAddressKeyType: event.target.value as any }))}>{["CPF","CNPJ","EMAIL","PHONE","EVP"].map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="block text-sm"><span className="font-medium">Chave Pix</span><Input value={form.pixAddressKey || ""} onChange={event => setForm(current => ({ ...current, pixAddressKey: event.target.value }))} /></label></> : <label className="block text-sm"><span className="font-medium">Wallet ID da conta Asaas</span><Input value={form.walletId || ""} onChange={event => setForm(current => ({ ...current, walletId: event.target.value }))} /></label>}
        <label className="block text-sm"><span className="font-medium">Valor (R$)</span><Input type="number" min="0.01" step="0.01" value={form.value} onChange={event => setForm(current => ({ ...current, value: Number(event.target.value), confirmation: false }))} /></label>
        {form.destinationType === "PIX" && <label className="block text-sm"><span className="font-medium">Descrição</span><Input maxLength={140} value={form.description || ""} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>}
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-1 h-4 w-4" type="checkbox" checked={form.confirmation} onChange={event => setForm(current => ({ ...current, confirmation: event.target.checked }))} /><span>Confirmo o destino e o valor de {money(Number(form.value || 0))}{environment === "production" ? ", com movimentação de dinheiro real" : " no Sandbox"}.</span></label>
      </div><DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={mutation.isPending || !form.confirmation || Number(form.value) <= 0} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar transferência</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}

export function BiaAsaasStatus({ biaId, canEdit = false }: { biaId: string; canEdit?: boolean }) {
  const { toast } = useToast();
  const url = `/api/bias/${encodeURIComponent(biaId)}/banco/asaas/status`;
  const query = useQuery({ queryKey: [url], queryFn: async () => asaasBiaStatusSchema.parse(await readStatus(url)), retry: false, staleTime: 30_000, refetchOnWindowFocus: true });
  const refresh = useMutation({
    mutationFn: () => writeJson(`/api/bias/${encodeURIComponent(biaId)}/banco/asaas/account/refresh`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: [url] }); toast({ title: "Situação atualizada" }); },
    onError: (error: Error) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });
  if (query.isPending) return <p>Consultando a integração Asaas…</p>;
  if (query.isError) return <div role="alert" className="rounded-lg border p-4"><p>Não foi possível consultar o vínculo Asaas desta BIA.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  const actions = canEdit ? query.data.account
    ? <Button type="button" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>{refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Atualizar situação</Button>
    : query.data.accountCreationAvailable
      ? <SubaccountDialog biaId={biaId} statusUrl={url} environment={query.data.environment} />
      : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">A criação ainda não está disponível.</p><ul className="mt-1 list-disc pl-5">{query.data.accountCreationBlockers.map(item => <li key={item}>{item}</li>)}</ul></div>
    : null;
  return <AsaasBiaSummary data={query.data} actions={actions}>{query.data.account?.state === "approved" && query.data.operationsEnabled ? <AccountOperations biaId={biaId} canEdit={canEdit} environment={query.data.environment} chargesEnabled={query.data.chargesEnabled} transfersEnabled={query.data.transfersEnabled} /> : null}</AsaasBiaSummary>;
}
