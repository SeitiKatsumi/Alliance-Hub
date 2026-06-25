import { useState } from "react";
import { BarChart3, Calculator, FileText, Landmark, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AliancaDocsPage, { AliancaDocsPageConfig } from "./alianca-docs-page";
import FluxoCaixaPage from "./fluxo-caixa";
import ResultadosPage from "./resultados";
import BiasCalculadoraPage from "./bias-calculadora";

const config: AliancaDocsPageConfig = {
  modulo: "capital",
  titulo: "Documentos",
  subtitulo: "Documentos de investimento, contabilidade e gestao financeira",
  accentColor: "#D7BB7D",
  icon: Landmark,
  theme: "light",
  hideHeaderIcon: true,
  hideHeaderChrome: true,
  aliancas: [
    {
      key: "aporte-financeiro",
      label: "Aliancas de Aporte Financeiro",
      tipos: [
        { label: "Memorando/teaser do investimento + pitch deck + data room" },
        { label: "Estrutura do investimento (instrumento, risco, retorno, etc.) (Padrao Politicas BUILT)" },
        { label: "Acordo de socios/cotistas (governanca, saida, preferencia) (Padrao Politicas BUILT)" },
        { label: "Plano de captacao por parcelas + condicoes + garantias" },
        { label: "Cessao de recebiveis / garantias (quando aplicavel)" },
        { label: "Outro" },
      ],
    },
    {
      key: "contabil",
      label: "Aliancas Contabeis e Fiscais",
      tipos: [
        { label: "Escrituracao e obrigacoes (conforme regime)" },
        { label: "DRE do projeto, balanco, balancetes, razao, conciliacoes" },
        { label: "Relatorios de prestacao de contas para cotistas/acionistas (Dashboard)" },
        { label: "Pastas fiscais (NF, retencoes, impostos, guias, garantias)" },
        { label: "Outro" },
      ],
    },
    {
      key: "financeiro",
      label: "Aliancas de Gestao Financeira",
      tipos: [
        { label: "Plano de contas do projeto (CAPEX/OPEX/receitas/distribuicoes) (Fluxo de Caixa)" },
        { label: "Orcamento baseline + revisoes + controle de versoes" },
        { label: "Fluxo de caixa (previsto x realizado) + curva de desembolso" },
        { label: "Politica de pagamentos (alcadas, aprovadores, evidencias)" },
        { label: "Conciliacao bancaria + extratos + trilha de aprovacao" },
        { label: "Relatorios de distribuicao (lucro distribuivel, comprovantes, recibos)" },
        { label: "Estornos/correcoes de despesas e receitas" },
        { label: "Outro" },
      ],
    },
  ],
};

export default function NucleoCapitalPage({
  initialBiaId = null,
  embedded = false,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
} = {}) {
  const [activeTab, setActiveTab] = useState("documentos");

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
          Documentos, financeiro, análises e calculadora DM em uma visão única.
        </p>
      </div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1 md:grid-cols-4">
          <TabsTrigger value="documentos" className="gap-2" data-testid="tab-capital-documentos">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2" data-testid="tab-capital-financeiro">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="analises" className="gap-2" data-testid="tab-capital-analises">
            <BarChart3 className="h-4 w-4" />
            Análises
          </TabsTrigger>
          <TabsTrigger value="calculadora" className="gap-2" data-testid="tab-capital-calculadora">
            <Calculator className="h-4 w-4" />
            Calculadora DM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="[&>div]:p-0 [&>div]:max-w-none">
          {activeTab === "documentos" && <AliancaDocsPage config={config} initialBiaId={initialBiaId} embedded={embedded} />}
        </TabsContent>
        <TabsContent value="financeiro" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "financeiro" && <FluxoCaixaPage initialBiaId={initialBiaId} embedded={embedded} />}
        </TabsContent>
        <TabsContent value="analises" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "analises" && <ResultadosPage initialBiaId={initialBiaId} embedded={embedded} />}
        </TabsContent>
        <TabsContent value="calculadora" className="[&>div]:p-0 [&>div]:max-w-none [&_[data-testid='text-page-title']>div]:hidden">
          {activeTab === "calculadora" && <BiasCalculadoraPage initialBiaId={initialBiaId} embedded={embedded} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
