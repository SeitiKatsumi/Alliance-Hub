import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe2, Pause, Play, SkipForward } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DistributionFlow {
  id: string;
  status: "ativo" | "pausado" | "concluido";
  onda_atual: number;
  proxima_execucao_em?: string | null;
}

export default function OpportunityDistributionControls({ code, onUpdated }: { code: string; onUpdated?: () => void }) {
  const { toast } = useToast();
  const flowQuery = useQuery<DistributionFlow>({
    queryKey: ["/api/rede/oportunidades", code, "disparo"],
    queryFn: async () => (await apiRequest("GET", `/api/rede/oportunidades/${code}/disparo`)).json(),
  });
  const actionMutation = useMutation({
    mutationFn: async (action: "pausar" | "retomar" | "avancar" | "publicar_agora") => (await apiRequest("PATCH", `/api/rede/oportunidades/${code}/disparo`, { action })).json(),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades", code, "disparo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      onUpdated?.();
      toast({ title: action === "publicar_agora" ? "Publicada na Vitrine geral" : "Fluxo de disparo atualizado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível controlar o disparo", description: error?.message, variant: "destructive" }),
  });
  const flow = flowQuery.data;
  if (flowQuery.isLoading || !flow) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">Onda {Math.min(6, Number(flow.onda_atual || 0) + 1)} de 6</Badge>
      {flow.proxima_execucao_em && flow.status === "ativo" && <span className="text-xs text-muted-foreground">Próxima em {new Date(flow.proxima_execucao_em).toLocaleString("pt-BR")}</span>}
      {flow.status === "ativo" ? <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("pausar")}><Pause className="mr-1.5 h-3.5 w-3.5" />Pausar</Button> : flow.status === "pausado" ? <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("retomar")}><Play className="mr-1.5 h-3.5 w-3.5" />Retomar</Button> : null}
      {flow.status !== "concluido" && <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("avancar")}><SkipForward className="mr-1.5 h-3.5 w-3.5" />Próxima onda</Button>}
      {flow.status !== "concluido" && <Button variant="outline" size="sm" onClick={() => actionMutation.mutate("publicar_agora")}><Globe2 className="mr-1.5 h-3.5 w-3.5" />Vitrine agora</Button>}
    </div>
  );
}
