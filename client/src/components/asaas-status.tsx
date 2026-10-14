import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { asaasStatusSchema, asaasBiaStatusSchema, type AsaasStatus, type AsaasBiaStatus } from "@shared/asaas";

const states = {
  disabled: "Integração ainda não habilitada", configuration_pending: "Configuração pendente",
  foundation_ready: "Base preparada para homologação", production_blocked: "Produção bloqueada",
};
const accountStates = { draft: "Em preparação", pending: "Cadastro pendente", in_review: "Em análise", approved: "Aprovada", rejected: "Recusada", blocked: "Bloqueada" };
const owners = { undetermined: "Titularidade a definir", company: "Empresa responsável", bia: "Titular da BIA", platform: "Plataforma BUILT" };

export function AsaasAdminSummary({ data }: { data: AsaasStatus }) {
  return <div className="space-y-5" data-testid="asaas-admin-status">
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Asaas</CardTitle><Badge variant="outline">{data.environment === "sandbox" ? "Sandbox · testes" : "Produção · bloqueada"}</Badge></div></CardHeader><CardContent className="space-y-4">
      <p className="font-medium">{states[data.state]}</p>
      <p className="text-sm text-muted-foreground">A base está preparada para integrar as contas das SPEs e holdings. Operações bancárias serão liberadas após a configuração e homologação.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Configuração Sandbox</p><p>{data.configurationValid && data.enabled && data.credentialsPresent && data.webhookTokenPresent && data.environment === "sandbox" ? "Configurada" : "Pendente"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">BaaS</p><p>{data.baasEnabled ? "Habilitação informada · homologação pendente" : "Habilitação a confirmar"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Armazenamento</p><p>{data.storageReady ? "Estrutura disponível" : "Preparação pendente"}</p></div>
      </div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Próximos passos</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm">{data.pending.map(item => <li key={item}>{item}</li>)}</ul></CardContent></Card>
    <Card><CardHeader><CardTitle>Recursos em preparação</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{data.capabilities.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="text-sm">{item.label}</span><Badge variant="outline">Ainda não disponível</Badge></div>)}</CardContent></Card>
  </div>;
}

async function readStatus(url: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) throw new Error("Não foi possível consultar o Asaas.");
  return response.json();
}

export function AdminAsaas() {
  const query = useQuery({ queryKey: ["/api/admin/asaas/status"], queryFn: async () => asaasStatusSchema.parse(await readStatus("/api/admin/asaas/status")), staleTime: 30_000, refetchOnWindowFocus: true });
  return <div className="mx-auto max-w-6xl p-4 sm:p-6">{query.isPending ? <p>Consultando a configuração Asaas…</p> : query.isError ? <div role="alert"><p>Não foi possível consultar a configuração Asaas.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <AsaasAdminSummary data={query.data} />}</div>;
}

export function AsaasBiaSummary({ data }: { data: AsaasBiaStatus }) {
  return <Card data-testid="asaas-bia-status"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Conta da empresa · Asaas</CardTitle><Badge variant="outline">{data.environment === "sandbox" ? "Ambiente de testes" : "Produção bloqueada"}</Badge></div></CardHeader><CardContent className="space-y-3">
    <p>{states[data.integrationState]}</p>
    {data.account ? <div className="rounded-lg border p-3"><p className="font-medium break-words">{data.account.label}</p><p className="text-sm text-muted-foreground">{owners[data.account.ownership]} · {accountStates[data.account.state]}</p><p className="mt-2 text-sm">Operações ainda aguardam homologação, mesmo quando o cadastro da conta estiver aprovado.</p></div> : data.storageReady ? <p className="text-sm text-muted-foreground">Nenhuma conta Asaas vinculada a esta BIA. O vínculo será feito com a conta da SPE ou holding responsável.</p> : <p className="text-sm text-muted-foreground">O vínculo com a conta da empresa poderá ser consultado após a preparação do armazenamento.</p>}
    {!data.storageReady && <p className="text-sm text-muted-foreground">A estrutura dos vínculos de conta ainda está em preparação.</p>}
    <p className="text-sm text-muted-foreground">Saldos, extratos e operações bancárias serão disponibilizados após a homologação. Os registros anteriores permanecem no histórico.</p>
  </CardContent></Card>;
}

export function BiaAsaasStatus({ biaId }: { biaId: string }) {
  const url = `/api/bias/${encodeURIComponent(biaId)}/banco/asaas/status`;
  const query = useQuery({ queryKey: [url], queryFn: async () => asaasBiaStatusSchema.parse(await readStatus(url)), staleTime: 30_000, refetchOnWindowFocus: true });
  return query.isPending ? <p>Consultando a integração Asaas…</p> : query.isError ? <div role="alert" className="rounded-lg border p-4"><p>Não foi possível consultar o vínculo Asaas desta BIA.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Tentar novamente</Button></div> : <AsaasBiaSummary data={query.data} />;
}
