import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { confirmDiscardChanges } from "@/hooks/use-unsaved-changes";
import { InitialContributions } from "@/components/initial-contributions";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Banknote, Landmark, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AliancaDocsPageConfig } from "./alianca-docs-page";
import FluxoCaixaPage from "./fluxo-caixa";
import ResultadosPage from "./resultados";
import { useInitialMapSnapshot } from "./bias-calculadora";
import type { BiaAccessLevel } from "@shared/bia-access";
import { BiaAsaasStatus } from "@/components/asaas-status";
import { biaHasSalesThesis } from "@shared/bia-sales-analysis";

export const NUCLEO_CAPITAL_DOCS_CONFIG: AliancaDocsPageConfig = {
  modulo: "capital",
  titulo: "Documentos",
  subtitulo: "Documentos de investimento, contabilidade e gestão financeira",
  accentColor: "#D7BB7D",
  icon: Landmark,
  theme: "light",
  hideHeaderIcon: true,
  hideHeaderChrome: true,
  aliancas: [
    {
      key: "aporte-financeiro",
      label: "Alianças de Aporte Financeiro",
      tipos: [
        { label: "Memorando/teaser do investimento + pitch deck + data room" },
        { label: "Estrutura do investimento (instrumento, risco, retorno, etc.) (Padrão Políticas BUILT)" },
        { label: "Acordo de sócios/cotistas (governança, saída, preferência) (Padrão Políticas BUILT)" },
        { label: "Plano de captação por parcelas + condições + garantias" },
        { label: "Cessão de recebíveis / garantias (quando aplicável)" },
        { label: "Outro" },
      ],
    },
    {
      key: "contabil",
      label: "Alianças Contábeis e Fiscais",
      tipos: [
        { label: "Escrituração e obrigações (conforme regime)" },
        { label: "DRE do projeto, balanço, balancetes, razão, conciliações" },
        { label: "Relatórios de prestação de contas para cotistas/acionistas (Dashboard)" },
        { label: "Pastas fiscais (NF, retenções, impostos, guias, garantias)" },
        { label: "Outro" },
      ],
    },
    {
      key: "financeiro",
      label: "Alianças de Gestão Financeira",
      tipos: [
        { label: "Plano de contas do projeto (CAPEX/OPEX/receitas/distribuições) (Fluxo de Caixa)" },
        { label: "Orçamento baseline + revisões + controle de versões" },
        { label: "Fluxo de caixa (previsto x realizado) + curva de desembolso" },
        { label: "Política de pagamentos (alçadas, aprovadores, evidências)" },
        { label: "Conciliação bancária + extratos + trilha de aprovação" },
        { label: "Relatórios de distribuição (lucro distribuível, comprovantes, recibos)" },
        { label: "Estornos/correções de despesas e receitas" },
        { label: "Outro" },
      ],
    },
  ],
};

const CAPITAL_TABS = new Set(["banco", "financeiro", "analises"]);

function normalizeCapitalTab(value?: string | null) {
  return value && CAPITAL_TABS.has(value) ? value : "banco";
}

type BankHistoryData = {
  charges: Array<{ id: string; status: string | null; descricao: string | null; valor: string | number | null; data_vencimento: string | null }>;
};

function BancoBiaPage({ biaId, readOnly = false }: { biaId?: string | null; readOnly?: boolean }) {
  const history = useQuery<BankHistoryData>({ queryKey: [`/api/bias/${biaId}/banco`], enabled: !!biaId });
  return <div className="space-y-5">
    {biaId ? <BiaAsaasStatus key={biaId} biaId={biaId} canEdit={!readOnly} /> : <Card><CardHeader><CardTitle>Banco da BIA</CardTitle></CardHeader><CardContent>
      <p>Estamos preparando a integração com o Asaas. Abertura de conta e operações bancárias ficarão disponíveis após a homologação.</p>
      <p className="mt-2 text-sm text-muted-foreground">Os lançamentos e registros financeiros existentes continuam disponíveis para consulta.</p>
    </CardContent></Card>}
    {biaId && <Card><CardHeader><CardTitle>Histórico anterior da BIA</CardTitle></CardHeader><CardContent>
      {history.isPending ? <p>Carregando histórico…</p> : history.isError ? <div role="alert"><p>Não foi possível consultar o histórico.</p><Button variant="outline" onClick={() => history.refetch()}>Tentar novamente</Button></div> : history.data?.charges.length ? <div className="space-y-3">{history.data.charges.map(charge => <div key={charge.id} className="rounded-lg border p-3">
        <p className="font-medium">{charge.descricao || "Cobrança da BIA"}</p>
        <p className="text-sm text-muted-foreground">{charge.valor == null || !Number.isFinite(Number(charge.valor)) ? "Valor não informado" : Number(charge.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {charge.status || "Status não informado"}</p>
      </div>)}</div> : <p>Nenhuma cobrança registrada.</p>}
    </CardContent></Card>}
  </div>;
}

export default function NucleoCapitalPage({
  initialBiaId = null,
  embedded = false,
  activeTab: controlledActiveTab,
  onTabChange,
  access,
  bia,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  access?: Partial<Record<"banco" | "financeiro" | "analises" | "calculadora", BiaAccessLevel>>;
  bia?: { business_type_code?: unknown; objetivo_alianca?: unknown };
} = {}) {
  const tabDefinitions = [
    { key: "banco", label: "Banco", icon: Banknote, testId: "tab-capital-banco" },
    { key: "financeiro", label: "Financeiro", icon: Wallet, testId: "tab-capital-financeiro" },
    { key: "analises", label: "Análises", icon: BarChart3, testId: "tab-capital-analises" },
  ] as const;
  const allowedTabs = tabDefinitions.filter((tab) => {
    if (tab.key === "analises" && !biaHasSalesThesis(bia)) return false;
    const level = access?.[tab.key] || (access ? "none" : "edit");
    return level === "view" || level === "edit";
  });
  const allowedTabKey = allowedTabs.map((tab) => tab.key).join("|");
  const resolveAllowedTab = (value?: string | null) => {
    const normalized = normalizeCapitalTab(value);
    return allowedTabs.some((tab) => tab.key === normalized) ? normalized : allowedTabs[0]?.key || "banco";
  };
  const [activeTab, setActiveTab] = useState(() => resolveAllowedTab(controlledActiveTab));

  useEffect(() => {
    const next = resolveAllowedTab(controlledActiveTab);
    setActiveTab(next);
    if (controlledActiveTab && controlledActiveTab !== next) onTabChange?.(next);
  }, [controlledActiveTab, allowedTabKey]);

  const handleTabChange = (value: string) => {
    if (!confirmDiscardChanges()) return;
    const next = resolveAllowedTab(value);
    setActiveTab(next);
    onTabChange?.(next);
  };

  if (allowedTabs.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Você não possui acesso aos módulos de Capital desta BIA.</div>;
  }

  return (
    <div className={`${embedded ? "space-y-6" : "p-6 space-y-6 max-w-7xl mx-auto"}`}>
      {!embedded && <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-nucleo-capital-title">
          <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
            <Landmark className="h-6 w-6" />
          </div>
          Núcleo de Capital
        </h1>
        <p className="text-sm text-muted-foreground">
          Banco, financeiro e análises em uma visão única.
        </p>
      </div>}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList className={`grid h-auto w-full min-w-0 gap-1 bg-muted/60 p-1 ${allowedTabs.length === 3 ? "grid-cols-2 sm:grid-cols-3" : allowedTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {allowedTabs.some((tab) => tab.key === "banco") && <TabsTrigger value="banco" className="min-w-max flex-1 shrink-0 gap-2 whitespace-nowrap" data-testid="tab-capital-banco">
            <Banknote className="h-4 w-4" />
            Banco
          </TabsTrigger>}
          {allowedTabs.some((tab) => tab.key === "financeiro") && <TabsTrigger value="financeiro" className="min-w-max flex-1 shrink-0 gap-2 whitespace-nowrap" data-testid="tab-capital-financeiro">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>}
          {allowedTabs.some((tab) => tab.key === "analises") && <TabsTrigger value="analises" className="min-w-max flex-1 shrink-0 gap-2 whitespace-nowrap" data-testid="tab-capital-analises">
            <BarChart3 className="h-4 w-4" />
            Análises
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="banco" className="[&>div]:p-0 [&>div]:max-w-none">
          {activeTab === "banco" && <BancoBiaPage biaId={initialBiaId} readOnly={access?.banco === "view"} />}
        </TabsContent>
        <TabsContent value="financeiro" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "financeiro" && <FinanceiroBia initialBiaId={initialBiaId} embedded={embedded} readOnly={access?.financeiro === "view"} />}
        </TabsContent>
        <TabsContent value="analises" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "analises" && allowedTabs.some(tab => tab.key === "analises") && <ResultadosPage initialBiaId={initialBiaId} embedded={embedded} readOnly={access?.analises === "view"} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinanceiroBia({ initialBiaId, embedded, readOnly }: { initialBiaId?: string | null; embedded: boolean; readOnly: boolean }) {
  const snapshot = useInitialMapSnapshot(initialBiaId);
  const search = useSearch();
  const [, navigate] = useLocation();
  const section = new URLSearchParams(search).get("financeiro") === "aportes" ? "aportes" : "lancamentos";
  const compatible = Number(snapshot.data?.modeloCalculo) >= 3;
  const membros = useQuery<Array<{ id: string; nome?: string; Nome_de_usuario?: string | null }>>({ queryKey: ["/api/membros"], enabled: compatible && section === "aportes" });
  return <Tabs value={section} onValueChange={value => {
    const params = new URLSearchParams(search); params.set("financeiro", value);
    navigate(`${window.location.pathname}?${params.toString()}`);
  }} className="space-y-4">
    <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>{compatible && <TabsTrigger value="aportes">Aportes e parcelas</TabsTrigger>}</TabsList>
    <TabsContent value="lancamentos">{section === "lancamentos" && <FluxoCaixaPage initialBiaId={initialBiaId} embedded={embedded} readOnly={readOnly} />}</TabsContent>
    <TabsContent value="aportes">{section === "aportes" && (snapshot.isPending ? <p>Carregando aportes…</p> : snapshot.isError ? <p role="alert">Não foi possível consultar o modelo da BIA. <Button onClick={() => snapshot.refetch()}>Tentar novamente</Button></p> : compatible && initialBiaId ? <InitialContributions key={initialBiaId} biaId={initialBiaId} membros={membros.data || []} readOnly={readOnly} /> : <p>Esta BIA não usa o modelo de aportes iniciais. Seus lançamentos continuam disponíveis na seção Lançamentos.</p>)}</TabsContent>
  </Tabs>;
}
