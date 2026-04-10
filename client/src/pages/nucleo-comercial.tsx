import { TrendingUp } from "lucide-react";
import AliancaDocsPage, { AliancaDocsPageConfig } from "./alianca-docs-page";

const config: AliancaDocsPageConfig = {
  modulo: "comercial",
  titulo: "Núcleo Comercial",
  subtitulo: "Documentos de alianças comerciais, vendas e marketing",
  accentColor: "#6EBF8B",
  icon: TrendingUp,
  aliancas: [
    {
      key: "comercial",
      label: "Alianças Comerciais",
      tipos: [
        { label: "Plano comercial (canais, público, metas, funil, argumentos)" },
        { label: "Política de comissionamento (se aplicável)" },
        { label: "CRM (pipeline, relatórios de conversão, origem do lead)" },
        { label: "Propostas comerciais padrão + scripts + apresentações" },
        { label: "Relatórios de performance (leads, ativos, taxa de conversão)" },
        { label: "Outro" },
      ],
    },
    {
      key: "vendas",
      label: "Alianças de Vendas",
      tipos: [
        { label: "Tabelas de preço, condições e política de descontos" },
        { label: "Contratos de reserva/proposta/compromisso (conforme modelo jurídico)" },
        { label: "Dossie do cliente (KYC/KYB, análise, documentação)" },
        { label: "Termos de repasse/aditivos + checklists de fechamento" },
        { label: "Controle de recebíveis e inadimplência (quando for renda/operação)" },
        { label: "Outro" },
      ],
    },
    {
      key: "marketing",
      label: "Alianças de Marketing",
      tipos: [
        { label: "Estratégia de marca e posicionamento do produto" },
        { label: "Plano de mídia e conteúdo + calendário editorial" },
        { label: "Criativos e peças (book, folder, landing, anúncios)" },
        { label: "Termos de uso de imagem/filmagem, releases" },
        { label: "Métricas (CAC, CPI, tráfego, taxa de conversão, ROI de campanhas)" },
        { label: "Outro" },
      ],
    },
  ],
};

export default function NucleoComercialPage() {
  return <AliancaDocsPage config={config} />;
}
