import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle2, Clock3, FileQuestion, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface StructuringRequest {
  id: string;
  asset_id: string;
  status: string;
  comunidade_nome?: string | null;
  solicitante_nome?: string | null;
  motivo_decisao?: string | null;
  observacao?: string | null;
  bia_id?: string | null;
  criado_em?: string | null;
  can_review?: boolean;
  can_complement?: boolean;
  asset_data?: { qualificacao?: string; tese_inicial?: string; descricao?: string; cidade?: string; estado?: string };
}

const statusLabels: Record<string, string> = {
  pendente: "Aguardando decisão",
  complementos_solicitados: "Complementos solicitados",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export function BiaStructuringQueue({ mine = false, compact = false }: { mine?: boolean; compact?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queryKey = ["/api/bia-estruturacao-solicitacoes", mine ? "mine" : "review"] as const;
  const requestsQuery = useQuery<StructuringRequest[]>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", `/api/bia-estruturacao-solicitacoes${mine ? "?mine=1" : ""}`)).json(),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ request, action }: { request: StructuringRequest; action: "aprovar" | "rejeitar" | "complementos" | "complementar" }) => {
      const payload = action === "complementar" ? { complemento: notes[request.id] || "" } : { motivo: notes[request.id] || null };
      return (await apiRequest("PATCH", `/api/bia-estruturacao-solicitacoes/${request.id}/${action}`, payload)).json();
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bia-estruturacao-solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/land-bank-assets"] });
      setNotes((current) => ({ ...current, [variables.request.id]: "" }));
      toast({ title: variables.action === "aprovar" ? "BIA criada em formação" : variables.action === "complementar" ? "Complementos enviados" : "Solicitação atualizada" });
      if (data?.bia_id) navigate(`/bias/${data.bia_id}`);
    },
    onError: (error: any) => toast({ title: "Não foi possível concluir a ação", description: error?.message, variant: "destructive" }),
  });
  const requests = requestsQuery.data || [];

  if (compact && !requestsQuery.isLoading && requests.length === 0) return null;

  return (
    <section className={compact ? "space-y-3" : "mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8"}>
      <div><h2 className={compact ? "text-lg font-semibold" : "text-2xl font-bold"}>Estruturação de BIAs</h2><p className="mt-1 text-sm text-muted-foreground">Oportunidades com pré-viabilidade aprovada aguardando decisão de governança.</p></div>
      {requestsQuery.isLoading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div> : requests.length === 0 ? <div className="border-y py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação de estruturação disponível.</div> : <div className="divide-y border-y">{requests.map((request) => {
        const asset = request.asset_data || {};
        const canAct = request.can_review && request.status === "pendente";
        const canComplement = request.can_complement && request.status === "complementos_solicitados";
        return <article key={request.id} className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{asset.qualificacao || "Oportunidade imobiliária"}</h3><Badge variant="outline">{statusLabels[request.status] || request.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{asset.tese_inicial || asset.descricao}</p><p className="mt-2 text-xs text-muted-foreground">{[asset.cidade, asset.estado, request.comunidade_nome].filter(Boolean).join(" · ")}</p></div><Button variant="outline" size="sm" onClick={() => navigate(`/oportunidades/${request.asset_id}`)}>Abrir oportunidade</Button></div>
          {request.motivo_decisao && <div className="border-l-2 border-amber-400 pl-3 text-sm"><strong>Parecer:</strong> {request.motivo_decisao}</div>}
          {(canAct || canComplement) && <Textarea value={notes[request.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder={canComplement ? "Descreva os complementos realizados..." : "Parecer, motivo ou complementos necessários..."} />}
          {canAct && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={actionMutation.isPending || !(notes[request.id] || "").trim()} onClick={() => actionMutation.mutate({ request, action: "complementos" })}><FileQuestion className="mr-2 h-4 w-4" />Solicitar complementos</Button><Button variant="outline" className="border-red-200 text-red-600" disabled={actionMutation.isPending || !(notes[request.id] || "").trim()} onClick={() => actionMutation.mutate({ request, action: "rejeitar" })}><XCircle className="mr-2 h-4 w-4" />Rejeitar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ request, action: "aprovar" })}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar e criar BIA</Button></div>}
          {canComplement && <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={actionMutation.isPending || !(notes[request.id] || "").trim()} onClick={() => actionMutation.mutate({ request, action: "complementar" })}>Enviar complementos</Button>}
          {request.status === "aprovada" && request.bia_id && <Button variant="outline" onClick={() => navigate(`/bias/${request.bia_id}`)}><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />Abrir BIA em formação</Button>}
          {request.status === "pendente" && !canAct && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />Aguardando a primeira decisão válida do admin ou Aliado da comunidade.</p>}
        </article>;
      })}</div>}
    </section>
  );
}

export default BiaStructuringQueue;
