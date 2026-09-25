import { useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBiaUrl } from "@/lib/bia-url";
import FluxoCaixaPage from "./fluxo-caixa";
import { BiaMapZero } from "./bias-calculadora";
import { BiaMapHistory } from "@/components/bia-map-history";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";

type BiaRef = {
  id: string;
  codigo_publico?: string | null;
  nome_bia?: string | null;
};

export default function MovimentacaoCotasPage() {
  const { biaId } = useParams<{ biaId: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const requestedView = new URLSearchParams(search).get("view");
  const view = requestedView === "zero" || requestedView === "historico" ? requestedView : "atual";
  const { data: bia, isPending, isError } = useQuery<BiaRef>({
    queryKey: ["/api/bias", biaId],
    queryFn: async () => (await apiRequest("GET", `/api/bias/${biaId}`)).json(),
    enabled: !!biaId,
  });
  const internalBiaId = bia?.id || biaId;
  if (isPending) return <p className="p-6">Carregando MAP…</p>;
  if (isError || !internalBiaId) return <p role="alert" className="p-6">Não foi possível consultar esta BIA.</p>;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-8 lg:px-10">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-2 text-muted-foreground"
          onClick={() => navigate(bia ? getBiaUrl(bia) : `/bias/${biaId}`)}
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
      <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-8 lg:px-10">
        <Tabs value={view} onValueChange={next => {
          const params = new URLSearchParams(search); params.set("view", next);
          navigate(`${window.location.pathname}?${params.toString()}`);
        }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="atual">MAP Atual</TabsTrigger><TabsTrigger value="zero">MAP Inicial</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
          <TabsContent value="atual">{view === "atual" && <FluxoCaixaPage initialBiaId={internalBiaId} embedded cotasOnly />}</TabsContent>
          <TabsContent value="zero">{view === "zero" && <BiaMapZero biaId={internalBiaId} />}</TabsContent>
          <TabsContent value="historico">{view === "historico" && <BiaMapHistory biaId={internalBiaId} />}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
