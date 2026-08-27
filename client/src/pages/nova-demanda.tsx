import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DemandResolutionSelect, type DemandResolutionMode } from "@/components/demand-resolution-select";

interface BiaOption {
  id: string;
  nome_bia?: string | null;
  codigo_publico?: string | null;
}

export default function NovaDemandaPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicSummary, setPublicSummary] = useState("");
  const [resolution, setResolution] = useState<DemandResolutionMode>("NETWORK_DEMAND");
  const [biaId, setBiaId] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [specialties, setSpecialties] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [publish, setPublish] = useState(false);
  const biasQuery = useQuery<BiaOption[]>({ queryKey: ["/api/bias"] });
  const bias = useMemo(() => biasQuery.data || [], [biasQuery.data]);
  const needsBia = resolution === "INTERNAL_BIA" || resolution === "OBA";

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/demandas", {
      bia_id: biaId || null,
      tipo_resolucao: resolution,
      titulo: title.trim(),
      descricao: description.trim(),
      contexto: description.trim(),
      resumo_publico: publicSummary.trim() || description.trim(),
      urgencia: urgency,
      especialidades: specialties.split(",").map((item) => item.trim()).filter(Boolean),
      cidade: city.trim() || null,
      estado: state.trim() || null,
      pais: "Brasil",
      modalidade_distribuicao: "pulso",
      publicar: publish,
      consentimento_publicacao: publish,
    })).json(),
    onSuccess: (demand: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitrine/demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      toast({ title: "Demanda criada", description: publish ? "O resumo foi enviado para a rede." : "A Demanda foi salva para acompanhamento." });
      navigate(publish ? `/vitrine/oportunidades/demandas/${demand.id}` : "/area-aliancas?tab=oportunidades&tipo=demandas");
    },
    onError: (error: any) => toast({ title: "Não foi possível criar a Demanda", description: error?.message, variant: "destructive" }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" className="px-0" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Início</Button>
      <header>
        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50"><Target className="mr-1 h-3.5 w-3.5" />Nova Demanda</Badge>
        <h1 className="mt-3 text-2xl font-bold">O que você precisa resolver?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comece com o essencial. Você poderá complementar as informações depois.</p>
      </header>
      <section className="grid gap-5 border-y py-6">
        <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Avaliação jurídica de um imóvel" /></div>
        <div className="space-y-2"><Label>Contexto e resultado esperado</Label><Textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explique a necessidade com suas palavras." /></div>
        <div className="space-y-2"><Label>Resumo para a rede</Label><Textarea value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} placeholder="Não inclua endereço exato, documentos ou contatos privados." /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DemandResolutionSelect hasBia={Boolean(biaId)} value={resolution} onChange={setResolution} />
          <div className="space-y-2"><Label>BIA relacionada</Label><Select value={biaId || "nenhuma"} onValueChange={(value) => setBiaId(value === "nenhuma" ? "" : value)}><SelectTrigger><SelectValue placeholder="Sem BIA" /></SelectTrigger><SelectContent><SelectItem value="nenhuma" disabled={needsBia}>Sem BIA</SelectItem>{bias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome_bia || item.codigo_publico || "BIA"}</SelectItem>)}</SelectContent></Select>{needsBia && !biaId && <p className="text-xs text-amber-700">Este modo exige uma BIA.</p>}</div>
          <div className="space-y-2"><Label>Urgência</Label><Select value={urgency} onValueChange={setUrgency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Especialidades desejadas</Label><Input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Separe por vírgulas" /></div>
          <div className="space-y-2"><Label>Cidade</Label><Input value={city} onChange={(event) => setCity(event.target.value)} /></div>
          <div className="space-y-2"><Label>Estado</Label><Input value={state} onChange={(event) => setState(event.target.value)} /></div>
        </div>
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm"><Checkbox checked={publish} onCheckedChange={(checked) => setPublish(checked === true)} /><span>Publicar o resumo na rede para receber propostas. Dados privados permanecem protegidos.</span></label>
      </section>
      <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => navigate("/")}>Cancelar</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={!title.trim() || !description.trim() || (needsBia && !biaId) || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Demanda</Button></div>
    </div>
  );
}
