import { Landmark } from "lucide-react";
import AliancaDocsPage, { AliancaDocsPageConfig } from "./alianca-docs-page";

const config: AliancaDocsPageConfig = {
  modulo: "capital",
  titulo: "Núcleo de Capital",
  subtitulo: "Documentos de investimento, contabilidade e gestão financeira",
  accentColor: "#D7BB7D",
  icon: Landmark,
  aliancas: [
    {
      key: "investimento",
      label: "Alianças de Investimento",
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

export default function NucleoCapitalPage() {
  return <AliancaDocsPage config={config} />;
}
