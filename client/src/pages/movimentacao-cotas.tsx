import { useParams, useLocation } from "wouter";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FluxoCaixaPage from "./fluxo-caixa";

export default function MovimentacaoCotasPage() {
  const { biaId } = useParams<{ biaId: string }>();
  const [, navigate] = useLocation();

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-7xl px-8 pt-6 lg:px-10">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-2 text-muted-foreground"
          onClick={() => navigate(`/bias/${biaId}`)}
          data-testid="btn-voltar-bia-movimentacao-cotas"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para BIA
        </Button>
        <div className="mt-4 flex items-center gap-3">
          <div className="rounded-lg bg-blue-600/10 p-2 text-blue-600">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Alocação Patrimonial</h1>
            <p className="text-sm text-muted-foreground">
              Mapa de alocação patrimonial e movimentações de cotas da BIA.
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-8 pb-6 lg:px-10">
        <FluxoCaixaPage initialBiaId={biaId} embedded cotasOnly />
      </div>
    </div>
  );
}
