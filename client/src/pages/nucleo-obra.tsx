import { HardHat } from "lucide-react";
import AliancaDocsPage, { AliancaDocsPageConfig } from "./alianca-docs-page";

const config: AliancaDocsPageConfig = {
  modulo: "obra",
  titulo: "Núcleo de Obra",
  subtitulo: "Documentos de execução e fornecimento",
  accentColor: "#E8845A",
  icon: HardHat,
  aliancas: [
    {
      key: "execucao",
      label: "Alianças de Execução",
      tipos: [
        { label: "Diário de obra + relatórios semanais + fotos" },
        { label: "Medições (boletim) + memória de cálculo + termos de aceite" },
        { label: "Controle de qualidade (checklists, ensaios, não conformidades, correções)" },
        { label: "Outro" },
      ],
    },
    {
      key: "fornecimento",
      label: "Alianças de Fornecimento",
      tipos: [
        { label: "Homologação de fornecedor (documentos, fichas, compliance)" },
        { label: "Cotação / mapa de concorrência / comparativos" },
        { label: "Pedido de compra / contrato de fornecimento + SLAs" },
        { label: "Nº e., carimbos, romaneios, comprovantes de entrega" },
        { label: "Controle de estoque / entrada-saída / inventário de canteiro" },
        { label: "Garantias, manuais, certificados, rastreabilidade de lote" },
        { label: "Registro de não conformidade + trocas/devoluções" },
        { label: "Outro" },
      ],
    },
  ],
};

export default function NucleoObraPage() {
  return <AliancaDocsPage config={config} />;
}
