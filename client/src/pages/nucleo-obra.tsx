import { HardHat } from "lucide-react";
import AliancaDocsPage, { AliancaDocsPageConfig } from "./alianca-docs-page";

export const NUCLEO_OBRA_DOCS_CONFIG: AliancaDocsPageConfig = {
  modulo: "obra",
  titulo: "Núcleo de Obra",
  subtitulo: "Documentos de execução e fornecimento",
  accentColor: "#E8845A",
  icon: HardHat,
  theme: "light",
  hideHeaderIcon: true,
  hideHeaderChrome: true,
  showTitleIcon: true,
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

export default function NucleoObraPage({
  initialBiaId = null,
  embedded = false,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
} = {}) {
  return <AliancaDocsPage config={NUCLEO_OBRA_DOCS_CONFIG} initialBiaId={initialBiaId} embedded={embedded} />;
}
