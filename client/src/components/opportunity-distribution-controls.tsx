import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe2, Layers3, Pause, Play, SkipForward } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface DistributionFlow {
  id: string;
  status: "ativo" | "pausado" | "concluido";
  onda_atual: number;
  proxima_execucao_em?: string | null;
  strategic_cell_ids?: string[];
  ondas?: Array<{ id: string; ordem: number; audiencia: string; status: string }>;
}

interface ActiveCell { id: string; name: string; type_public_name: string; }

export default function OpportunityDistributionControls({ code, onUpdated }: { code: string; onUpdated?: () => void }) {
  const { toast } = useToast();
  const flowQuery = useQuery<DistributionFlow | null>({
    queryKey: ["/api/rede/oportunidades", code, "disparo"],
    queryFn: async () => {
      const response = await fetch(`/api/rede/oportunidades/${code}/disparo`, { credentials: "include", cache: "no-store" });
      return response.ok ? response.json() : null;
    },
  });
  const cellsQuery = useQuery<ActiveCell[]>({ queryKey: ["/api/celulas/ativas"] });
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  useEffect(() => { if (flowQuery.data?.strategic_cell_ids) setSelectedCells(flowQuery.data.strategic_cell_ids); }, [flowQuery.data?.strategic_cell_ids]);
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
  const distributeMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/rede/oportunidades/${code}/disparo`, { modo: "gradual", strategic_cell_ids: selectedCells })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades", code, "disparo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      onUpdated?.();
      toast({ title: "Pulso iniciado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível distribuir", description: error?.message, variant: "destructive" }),
  });
  if (flowQuery.isLoading) return null;
  const totalWaves = flow?.ondas?.length || 5;
  const currentWave = flow?.status === "concluido" ? totalWaves : Math.min(totalWaves, Number(flow?.onda_atual || 0) + 1);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">O Pulso começa na comunidade de origem e avança pela rede a cada quatro horas até a Vitrine geral.</p>
      {!flow && <Button disabled={distributeMutation.isPending} onClick={() => distributeMutation.mutate()}>{distributeMutation.isPending ? "Iniciando..." : "Iniciar Pulso"}</Button>}
      {flow && <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Onda {currentWave} de {totalWaves}</Badge>
        {flow.proxima_execucao_em && flow.status === "ativo" && <span className="text-xs text-muted-foreground">Próxima em {new Date(flow.proxima_execucao_em).toLocaleString("pt-BR")}</span>}
        {flow.status === "ativo" ? <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("pausar")}><Pause className="mr-1.5 h-3.5 w-3.5" />Pausar</Button> : flow.status === "pausado" ? <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("retomar")}><Play className="mr-1.5 h-3.5 w-3.5" />Retomar</Button> : null}
        {flow.status !== "concluido" && <Button variant="ghost" size="sm" onClick={() => actionMutation.mutate("avancar")}><SkipForward className="mr-1.5 h-3.5 w-3.5" />Próxima onda</Button>}
        {flow.status !== "concluido" && <Button variant="outline" size="sm" onClick={() => actionMutation.mutate("publicar_agora")}><Globe2 className="mr-1.5 h-3.5 w-3.5" />Vitrine agora</Button>}
      </div>}
      {(cellsQuery.data || []).length > 0 && <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium"><Layers3 className="mr-2 inline h-4 w-4" />Incluir outras Células na primeira onda</summary>
        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{(cellsQuery.data || []).map((cell) => <label key={cell.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={selectedCells.includes(cell.id)} onCheckedChange={(checked) => setSelectedCells((current) => checked ? (current.includes(cell.id) ? current : [...current, cell.id]) : current.filter((id) => id !== cell.id))} /><span>{cell.name}</span><span className="text-xs text-muted-foreground">{cell.type_public_name}</span></label>)}</div>
        <Button className="mt-3" size="sm" disabled={!selectedCells.length || distributeMutation.isPending} onClick={() => distributeMutation.mutate()}>{flow ? "Atualizar Células e reiniciar Pulso" : "Iniciar Pulso com estas Células"}</Button>
      </details>}
    </div>
  );
}
