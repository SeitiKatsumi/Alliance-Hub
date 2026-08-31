import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { getPublicContributionAreas } from "@shared/contribution-areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Policy = { code: string; version: number; amount_cents?: number | null; minimum_rate?: string | number | null; status: string };
type PublicLabel = { code: string; display_name: string; description?: string | null };
type Subscription = { id: string; subscription_type: "company" | "member"; name: string; email?: string | null; status: string; renewal_at?: string | null; billing_suspended: boolean; frozen_at?: string | null; provider?: string | null };
type CellTaxonomyItem = { code: string; public_name: string; short_description: string; help_text?: string | null; status: string; display_order: number; markets: CellTaxonomyMarket[] };
type CellTaxonomyMarket = Omit<CellTaxonomyItem, "markets">;
type CellTaxonomyDraft = Partial<Omit<CellTaxonomyMarket, "code">>;

const POLICY_LABELS: Record<string, string> = {
  MEMBER_ANNUAL: "Anuidade do Membro Aliado",
  COMPANY_ANNUAL: "Anuidade do Plano Empresa",
  BIA_RIG: "Percentual mínimo de RIG",
  BIA_GOVERNANCE_MONTHLY: "Mensalidade de governança da BIA",
};

async function request(path: string, method = "GET", body?: unknown) {
  const response = await apiRequest(method, path, body);
  return response.json();
}

export function AdminCommercialPolicies() {
  const { toast } = useToast();
  const policiesQuery = useQuery<Policy[]>({ queryKey: ["/api/admin/monetization/policies"] });
  const labelsQuery = useQuery<PublicLabel[]>({ queryKey: ["/api/taxonomy/public-labels"] });
  const subscriptionsQuery = useQuery<Subscription[]>({ queryKey: ["/api/admin/subscriptions"] });
  const cellTaxonomyQuery = useQuery<CellTaxonomyItem[]>({ queryKey: ["/api/admin/taxonomy/strategic-cells"] });
  const [policyCode, setPolicyCode] = useState("MEMBER_ANNUAL");
  const [policyValue, setPolicyValue] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [cellTaxonomy, setCellTaxonomy] = useState<Record<string, CellTaxonomyDraft>>({});
  const [area, setArea] = useState("");
  const [segmentCodes, setSegmentCodes] = useState("");
  const [bia, setBia] = useState({ id: "", origin: "", rigPercent: "1", start: "" });
  const [biaData, setBiaData] = useState<any>(null);
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [renewalDates, setRenewalDates] = useState<Record<string, string>>({});
  const activePolicies = useMemo(() => (policiesQuery.data || []).filter((item) => item.status === "active"), [policiesQuery.data]);
  const subscriptions = useMemo(() => {
    const query = subscriptionSearch.trim().toLowerCase();
    return (subscriptionsQuery.data || []).filter((item) => !query || `${item.name} ${item.email || ""}`.toLowerCase().includes(query));
  }, [subscriptionSearch, subscriptionsQuery.data]);

  useEffect(() => {
    setLabels(Object.fromEntries((labelsQuery.data || []).map((item) => [item.code, item.display_name])));
  }, [labelsQuery.data]);

  useEffect(() => {
    setCellTaxonomy(Object.fromEntries((cellTaxonomyQuery.data || []).flatMap((cell) => [
      [`cell:${cell.code}`, { public_name: cell.public_name, short_description: cell.short_description, help_text: cell.help_text, status: cell.status, display_order: cell.display_order }],
      ...cell.markets.map((market) => [`market:${market.code}`, { public_name: market.public_name, short_description: market.short_description, help_text: market.help_text, status: market.status, display_order: market.display_order }]),
    ])));
  }, [cellTaxonomyQuery.data]);

  useEffect(() => {
    setRenewalDates(Object.fromEntries((subscriptionsQuery.data || []).map((item) => [item.id, item.renewal_at ? item.renewal_at.slice(0, 10) : ""])));
  }, [subscriptionsQuery.data]);

  const policyMutation = useMutation({
    mutationFn: () => request(`/api/admin/monetization/policies/${policyCode}`, "PUT", policyCode === "BIA_RIG"
      ? { minimum_rate: Number(policyValue) / 100 }
      : { amount_cents: Math.round(Number(policyValue.replace(",", ".")) * 100) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/monetization/policies"] }); toast({ title: "Nova versão da política criada" }); },
    onError: (error: any) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const labelMutation = useMutation({
    mutationFn: (code: string) => request(`/api/admin/taxonomy/public-labels/${code}`, "PUT", { display_name: labels[code] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/taxonomy/public-labels"] }); toast({ title: "Nome público atualizado" }); },
  });

  const mappingMutation = useMutation({
    mutationFn: () => request("/api/admin/taxonomy/contribution-segments", "PUT", {
      contribution_area: area,
      segment_codes: segmentCodes.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
    }),
    onSuccess: () => toast({ title: "Relação de segmentos atualizada" }),
  });

  const cellTaxonomyMutation = useMutation({
    mutationFn: ({ kind, code }: { kind: "cell" | "market"; code: string }) => request(`/api/admin/taxonomy/strategic-cells/${kind}/${code}`, "PUT", cellTaxonomy[`${kind}:${code}`]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/taxonomy/strategic-cells"] }); queryClient.invalidateQueries({ queryKey: ["/api/strategic-cell-types"] }); toast({ title: "Taxonomia de Células atualizada" }); },
    onError: (error: any) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });

  const loadBiaMutation = useMutation({
    mutationFn: () => request(`/api/admin/bias/${bia.id}/monetization`),
    onSuccess: (data) => setBiaData(data),
    onError: (error: any) => toast({ title: "Não foi possível carregar a BIA", description: error.message, variant: "destructive" }),
  });
  const saveBiaMutation = useMutation({
    mutationFn: () => request(`/api/admin/bias/${bia.id}/monetization`, "PUT", {
      origin_value: Number(bia.origin.replace(/\./g, "").replace(",", ".")),
      rig_rate: Number(bia.rigPercent.replace(",", ".")) / 100,
      institutional_start_at: bia.start,
    }),
    onSuccess: (terms) => { setBiaData({ terms, charges: biaData?.charges || [] }); toast({ title: "Termo salvo como rascunho" }); },
    onError: (error: any) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });
  const approveBiaMutation = useMutation({
    mutationFn: () => request(`/api/admin/bias/${bia.id}/monetization/approve`, "POST"),
    onSuccess: () => { loadBiaMutation.mutate(); toast({ title: "Termo aprovado e cobrança de RIG gerada" }); },
    onError: (error: any) => toast({ title: "Não foi possível aprovar", description: error.message, variant: "destructive" }),
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ subscription, action }: { subscription: Subscription; action: string }) => request(
      `/api/admin/subscriptions/${subscription.subscription_type}/${subscription.id}`,
      "PATCH",
      { action, ...(action === "set_renewal" ? { renewal_at: renewalDates[subscription.id] } : {}) },
    ),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] }); queryClient.invalidateQueries({ queryKey: ["/api/me"] }); toast({ title: "Assinatura atualizada" }); },
    onError: (error: any) => toast({ title: "Não foi possível atualizar", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <header><h1 className="text-2xl font-bold text-[#001D34]">Políticas comerciais</h1><p className="mt-1 text-sm text-slate-500">Valores versionados, nomes públicos e termos financeiros das BIAs.</p></header>

      <section className="space-y-4 border-y py-5">
        <h2 className="font-semibold">Valores vigentes</h2>
        <div className="grid gap-3 md:grid-cols-2">{activePolicies.map((policy) => <div key={policy.code} className="rounded-md border p-3"><p className="text-sm font-medium">{POLICY_LABELS[policy.code] || policy.code}</p><p className="mt-1 text-xs text-slate-500">Versão {policy.version} · {policy.code === "BIA_RIG" ? `${Number(policy.minimum_rate) * 100}%` : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(policy.amount_cents || 0) / 100)}</p></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><Select value={policyCode} onValueChange={setPolicyCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(POLICY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select><Input value={policyValue} onChange={(event) => setPolicyValue(event.target.value)} placeholder={policyCode === "BIA_RIG" ? "Percentual, ex.: 1" : "Valor em reais"} /><Button disabled={!policyValue || policyMutation.isPending} onClick={() => policyMutation.mutate()}><Save className="mr-2 h-4 w-4" />Criar nova versão</Button></div>
      </section>

      <section className="space-y-4 border-y py-5">
        <div><h2 className="font-semibold">Renovações e cobranças</h2><p className="mt-1 text-xs text-slate-500">Edite a renovação, suspenda cobranças ou pause a contagem do prazo. Toda alteração fica auditada.</p></div>
        <Input value={subscriptionSearch} onChange={(event) => setSubscriptionSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" />
        {subscriptionsQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : subscriptions.length === 0 ? <p className="text-sm text-slate-500">Nenhuma assinatura encontrada.</p> : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <div key={`${subscription.subscription_type}:${subscription.id}`} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{subscription.name}</p><p className="truncate text-xs text-slate-500">{subscription.email || "Sem e-mail"} · {subscription.subscription_type === "company" ? "Plano Empresa" : "Membro Aliado"} · {subscription.status}</p></div>
                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold uppercase">{subscription.billing_suspended && <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Cobrança suspensa</span>}{subscription.frozen_at && <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Prazo congelado</span>}</div>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-[170px_auto_auto]">
                  <Input type="date" value={renewalDates[subscription.id] || ""} onChange={(event) => setRenewalDates((current) => ({ ...current, [subscription.id]: event.target.value }))} aria-label={`Renovação de ${subscription.name}`} />
                  <Button variant="outline" disabled={!renewalDates[subscription.id] || subscriptionMutation.isPending} onClick={() => subscriptionMutation.mutate({ subscription, action: "set_renewal" })}>Salvar data</Button>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={subscriptionMutation.isPending} onClick={() => subscriptionMutation.mutate({ subscription, action: subscription.billing_suspended ? "resume_billing" : "suspend_billing" })}>{subscription.billing_suspended ? "Retomar cobrança" : "Suspender cobrança"}</Button>
                    <Button variant="outline" disabled={subscriptionMutation.isPending || !subscription.renewal_at} onClick={() => subscriptionMutation.mutate({ subscription, action: subscription.frozen_at ? "resume_time" : "freeze" })}>{subscription.frozen_at ? "Retomar prazo" : "Congelar prazo"}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">Nomes públicos</h2>{(labelsQuery.data || []).map((item) => <div key={item.code} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><Label className="self-center">{item.code}</Label><Input value={labels[item.code] || ""} onChange={(event) => setLabels({ ...labels, [item.code]: event.target.value })} /><Button variant="outline" onClick={() => labelMutation.mutate(item.code)}>Salvar</Button></div>)}</section>

      <section className="space-y-4 border-y py-5">
        <div><h2 className="font-semibold">Células e tipos de negócio</h2><p className="mt-1 text-xs text-slate-500">Edite a linguagem pública sem alterar os códigos internos.</p></div>
        {(cellTaxonomyQuery.data || []).map((cell) => {
          const cellDraft = cellTaxonomy[`cell:${cell.code}`];
          return <div key={cell.code} className="space-y-3 rounded-md border p-4">
            <div className="grid gap-2 lg:grid-cols-[1fr_2fr_120px_90px_auto]">
              <Input value={cellDraft?.public_name || ""} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`cell:${cell.code}`]: { ...current[`cell:${cell.code}`], public_name: event.target.value } }))} aria-label={`Nome público ${cell.code}`} />
              <Input value={cellDraft?.short_description || ""} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`cell:${cell.code}`]: { ...current[`cell:${cell.code}`], short_description: event.target.value } }))} aria-label={`Descrição ${cell.code}`} />
              <Select value={cellDraft?.status || "ACTIVE"} onValueChange={(status) => setCellTaxonomy((current) => ({ ...current, [`cell:${cell.code}`]: { ...current[`cell:${cell.code}`], status } }))}><SelectTrigger aria-label={`Status ${cell.code}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativa</SelectItem><SelectItem value="SUSPENDED">Suspensa</SelectItem><SelectItem value="ARCHIVED">Arquivada</SelectItem></SelectContent></Select>
              <Input type="number" min="0" value={cellDraft?.display_order ?? 0} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`cell:${cell.code}`]: { ...current[`cell:${cell.code}`], display_order: Number(event.target.value) } }))} aria-label={`Ordem ${cell.code}`} />
              <Button variant="outline" onClick={() => cellTaxonomyMutation.mutate({ kind: "cell", code: cell.code })}>Salvar Célula</Button>
            </div>
            <div className="space-y-2 border-l-2 border-blue-100 pl-3">
              {cell.markets.map((market) => {
                const marketDraft = cellTaxonomy[`market:${market.code}`];
                return <div key={market.code} className="grid gap-2 lg:grid-cols-[1fr_2fr_120px_90px_auto]">
                  <Input value={marketDraft?.public_name || ""} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`market:${market.code}`]: { ...current[`market:${market.code}`], public_name: event.target.value } }))} aria-label={`Nome público ${market.code}`} />
                  <Input value={marketDraft?.short_description || ""} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`market:${market.code}`]: { ...current[`market:${market.code}`], short_description: event.target.value } }))} aria-label={`Descrição ${market.code}`} />
                  <Select value={marketDraft?.status || "ACTIVE"} onValueChange={(status) => setCellTaxonomy((current) => ({ ...current, [`market:${market.code}`]: { ...current[`market:${market.code}`], status } }))}><SelectTrigger aria-label={`Status ${market.code}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Ativo</SelectItem><SelectItem value="SUSPENDED">Suspenso</SelectItem><SelectItem value="ARCHIVED">Arquivado</SelectItem></SelectContent></Select>
                  <Input type="number" min="0" value={marketDraft?.display_order ?? 0} onChange={(event) => setCellTaxonomy((current) => ({ ...current, [`market:${market.code}`]: { ...current[`market:${market.code}`], display_order: Number(event.target.value) } }))} aria-label={`Ordem ${market.code}`} />
                  <Button variant="ghost" onClick={() => cellTaxonomyMutation.mutate({ kind: "market", code: market.code })}>Salvar tipo</Button>
                </div>;
              })}
            </div>
          </div>;
        })}
      </section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">Áreas de contribuição e segmentos</h2><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue placeholder="Área pública" /></SelectTrigger><SelectContent>{getPublicContributionAreas().map((item) => <SelectItem key={item.value} value={item.value}>{item.displayName}</SelectItem>)}</SelectContent></Select><Input value={segmentCodes} onChange={(event) => setSegmentCodes(event.target.value)} placeholder="Códigos de segmento separados por vírgula" /><Button disabled={!area || mappingMutation.isPending} onClick={() => mappingMutation.mutate()}>Salvar relação</Button></div></section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">RIG e governança por BIA</h2><div className="flex gap-2"><Input value={bia.id} onChange={(event) => setBia({ ...bia, id: event.target.value })} placeholder="ID da BIA" /><Button variant="outline" disabled={!bia.id || loadBiaMutation.isPending} onClick={() => loadBiaMutation.mutate()}>{loadBiaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar"}</Button></div><div className="grid gap-3 sm:grid-cols-3"><div><Label>Valor de Origem</Label><Input value={bia.origin} onChange={(event) => setBia({ ...bia, origin: event.target.value })} placeholder="R$" /></div><div><Label>RIG (%)</Label><Input type="number" min="1" step="0.01" value={bia.rigPercent} onChange={(event) => setBia({ ...bia, rigPercent: event.target.value })} /></div><div><Label>Início institucional</Label><Input type="date" value={bia.start} onChange={(event) => setBia({ ...bia, start: event.target.value })} /></div></div><div className="flex flex-wrap items-center gap-3"><Button disabled={!bia.id || !bia.origin || !bia.start || saveBiaMutation.isPending} onClick={() => saveBiaMutation.mutate()}>Salvar rascunho</Button>{biaData?.terms?.status === "draft" && <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={approveBiaMutation.isPending} onClick={() => approveBiaMutation.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar termo</Button>} {biaData?.terms && <span className="text-sm text-slate-500">Status: {biaData.terms.status} · {biaData.charges?.length || 0} cobrança(s)</span>}</div></section>
    </div>
  );
}
