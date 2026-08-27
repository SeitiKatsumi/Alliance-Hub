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
  const [policyCode, setPolicyCode] = useState("MEMBER_ANNUAL");
  const [policyValue, setPolicyValue] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [area, setArea] = useState("");
  const [segmentCodes, setSegmentCodes] = useState("");
  const [bia, setBia] = useState({ id: "", origin: "", rigPercent: "1", start: "" });
  const [biaData, setBiaData] = useState<any>(null);
  const activePolicies = useMemo(() => (policiesQuery.data || []).filter((item) => item.status === "active"), [policiesQuery.data]);

  useEffect(() => {
    setLabels(Object.fromEntries((labelsQuery.data || []).map((item) => [item.code, item.display_name])));
  }, [labelsQuery.data]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <header><h1 className="text-2xl font-bold text-[#001D34]">Políticas comerciais</h1><p className="mt-1 text-sm text-slate-500">Valores versionados, nomes públicos e termos financeiros das BIAs.</p></header>

      <section className="space-y-4 border-y py-5">
        <h2 className="font-semibold">Valores vigentes</h2>
        <div className="grid gap-3 md:grid-cols-2">{activePolicies.map((policy) => <div key={policy.code} className="rounded-md border p-3"><p className="text-sm font-medium">{POLICY_LABELS[policy.code] || policy.code}</p><p className="mt-1 text-xs text-slate-500">Versão {policy.version} · {policy.code === "BIA_RIG" ? `${Number(policy.minimum_rate) * 100}%` : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(policy.amount_cents || 0) / 100)}</p></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"><Select value={policyCode} onValueChange={setPolicyCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(POLICY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select><Input value={policyValue} onChange={(event) => setPolicyValue(event.target.value)} placeholder={policyCode === "BIA_RIG" ? "Percentual, ex.: 1" : "Valor em reais"} /><Button disabled={!policyValue || policyMutation.isPending} onClick={() => policyMutation.mutate()}><Save className="mr-2 h-4 w-4" />Criar nova versão</Button></div>
      </section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">Nomes públicos</h2>{(labelsQuery.data || []).map((item) => <div key={item.code} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><Label className="self-center">{item.code}</Label><Input value={labels[item.code] || ""} onChange={(event) => setLabels({ ...labels, [item.code]: event.target.value })} /><Button variant="outline" onClick={() => labelMutation.mutate(item.code)}>Salvar</Button></div>)}</section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">Áreas de contribuição e segmentos</h2><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue placeholder="Área pública" /></SelectTrigger><SelectContent>{getPublicContributionAreas().map((item) => <SelectItem key={item.value} value={item.value}>{item.displayName}</SelectItem>)}</SelectContent></Select><Input value={segmentCodes} onChange={(event) => setSegmentCodes(event.target.value)} placeholder="Códigos de segmento separados por vírgula" /><Button disabled={!area || mappingMutation.isPending} onClick={() => mappingMutation.mutate()}>Salvar relação</Button></div></section>

      <section className="space-y-4 border-y py-5"><h2 className="font-semibold">RIG e governança por BIA</h2><div className="flex gap-2"><Input value={bia.id} onChange={(event) => setBia({ ...bia, id: event.target.value })} placeholder="ID da BIA" /><Button variant="outline" disabled={!bia.id || loadBiaMutation.isPending} onClick={() => loadBiaMutation.mutate()}>{loadBiaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar"}</Button></div><div className="grid gap-3 sm:grid-cols-3"><div><Label>Valor de Origem</Label><Input value={bia.origin} onChange={(event) => setBia({ ...bia, origin: event.target.value })} placeholder="R$" /></div><div><Label>RIG (%)</Label><Input type="number" min="1" step="0.01" value={bia.rigPercent} onChange={(event) => setBia({ ...bia, rigPercent: event.target.value })} /></div><div><Label>Início institucional</Label><Input type="date" value={bia.start} onChange={(event) => setBia({ ...bia, start: event.target.value })} /></div></div><div className="flex flex-wrap items-center gap-3"><Button disabled={!bia.id || !bia.origin || !bia.start || saveBiaMutation.isPending} onClick={() => saveBiaMutation.mutate()}>Salvar rascunho</Button>{biaData?.terms?.status === "draft" && <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={approveBiaMutation.isPending} onClick={() => approveBiaMutation.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar termo</Button>} {biaData?.terms && <span className="text-sm text-slate-500">Status: {biaData.terms.status} · {biaData.charges?.length || 0} cobrança(s)</span>}</div></section>
    </div>
  );
}
