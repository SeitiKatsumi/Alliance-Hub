import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileInput,
  Lightbulb,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TraceabilitySummary from "@/components/traceability-summary";

interface EconomicOpportunityDetail {
  id: string;
  codigo: string;
  titulo: string;
  resumo_autorizado?: string | null;
  tese?: string | null;
  finalidade?: string | null;
  parecer?: string | null;
  estagio: string;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  comunidade_nome?: string | null;
  responsavel_membro_id?: string | null;
  bia_id?: string | null;
  can_manage?: boolean;
  can_review?: boolean;
  dados_completos?: boolean;
  fontes?: Array<{ id: string; source_type: string; source_id: string; metadata?: Record<string, unknown> }>;
  reunioes?: Array<{ id: string; codigo: string; titulo: string; data: string; status: string }>;
  solicitacoes_bia?: Array<{ id: string; status: string; motivo_decisao?: string | null; criado_em: string }>;
}

interface MemberOption {
  id: string;
  nome: string;
  empresa?: string | null;
}

interface AiSuggestions {
  resumo?: string;
  classificacao?: string;
  especialidades?: string[];
  perguntas?: string[];
}

const STAGES = [
  ["identificada", "Identificada"],
  ["em_analise", "Em análise"],
  ["em_amadurecimento", "Em amadurecimento"],
  ["pronta_decisao", "Pronta para decisão"],
  ["estruturacao_solicitada", "Estruturação solicitada"],
  ["bia_em_formacao", "BIA em formação"],
  ["convertida_bia", "Convertida em BIA"],
  ["descartada", "Descartada"],
  ["arquivada", "Arquivada"],
] as const;

function stageLabel(stage: string) {
  return STAGES.find(([value]) => value === stage)?.[1] || stage.replace(/_/g, " ");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    demanda: "Demanda",
    land_bank_asset: "Banco de Ativos",
    imovel: "Imóvel da Carteira",
    oportunidade_externa: "Oportunidade externa",
    servico: "Prestação de serviço",
  };
  return labels[source] || source;
}

export default function EconomicOpportunityDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    titulo: "",
    resumo_autorizado: "",
    tese: "",
    finalidade: "",
    parecer: "",
    estagio: "identificada",
    cidade: "",
    estado: "",
    pais: "Brasil",
    responsavel_membro_id: "",
  });
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);

  const opportunityQuery = useQuery<EconomicOpportunityDetail>({
    queryKey: ["/api/oportunidades-economicas", codigo],
    queryFn: async () => (await apiRequest("GET", `/api/oportunidades-economicas/${codigo}`)).json(),
    enabled: Boolean(codigo),
  });
  const opportunity = opportunityQuery.data;
  const canEdit = Boolean(opportunity?.can_manage || opportunity?.can_review);

  const membersQuery = useQuery<MemberOption[]>({
    queryKey: ["/api/aura/membros/busca", "economic-responsible"],
    queryFn: async () => {
      const response = await fetch("/api/aura/membros/busca", { credentials: "include", cache: "no-store" });
      return response.ok ? response.json() : [];
    },
    enabled: canEdit,
  });

  useEffect(() => {
    if (!opportunity?.dados_completos) return;
    setForm({
      titulo: opportunity.titulo || "",
      resumo_autorizado: opportunity.resumo_autorizado || "",
      tese: opportunity.tese || "",
      finalidade: opportunity.finalidade || "",
      parecer: opportunity.parecer || "",
      estagio: opportunity.estagio || "identificada",
      cidade: opportunity.cidade || "",
      estado: opportunity.estado || "",
      pais: opportunity.pais || "Brasil",
      responsavel_membro_id: opportunity.responsavel_membro_id || "",
    });
  }, [opportunity]);

  const saveMutation = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/oportunidades-economicas/${codigo}`, {
      ...form,
      responsavel_membro_id: form.responsavel_membro_id || null,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas", codigo] });
      toast({ title: "Oportunidade atualizada", description: "O parecer e o estágio foram registrados no histórico." });
    },
    onError: (error: any) => toast({ title: "Não foi possível salvar", description: error?.message, variant: "destructive" }),
  });

  const triageMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/oportunidades-economicas/${codigo}/triagem-ia`, {})).json(),
    onSuccess: (result: any) => setSuggestions(result.sugestoes || {}),
    onError: (error: any) => toast({ title: "A triagem não pôde ser concluída", description: error?.message, variant: "destructive" }),
  });

  const requestBiaMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/oportunidades-economicas/${codigo}/estruturacao-bia`, {
      observacao: form.parecer,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas", codigo] });
      queryClient.invalidateQueries({ queryKey: ["/api/bia-estruturacao-solicitacoes"] });
      toast({ title: "Estruturação solicitada", description: "A governança poderá revisar a criação da BIA." });
    },
    onError: (error: any) => toast({ title: "Não foi possível solicitar a BIA", description: error?.message, variant: "destructive" }),
  });

  const questionText = useMemo(() => (suggestions?.perguntas || []).map((item) => `- ${item}`).join("\n"), [suggestions]);

  if (opportunityQuery.isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>;
  }

  if (!opportunity) {
    return <div className="mx-auto max-w-5xl p-6"><Button variant="ghost" onClick={() => navigate("/area-aliancas?tab=oportunidades&tipo=oportunidades")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><p className="mt-12 text-center text-muted-foreground">Oportunidade não encontrada ou sem acesso.</p></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/area-aliancas?tab=oportunidades&tipo=oportunidades")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Oportunidades</Button>
        <div className="flex flex-wrap gap-2">
          {(opportunity.can_manage || opportunity.can_review) && <Button variant="outline" onClick={() => navigate(`/area-aliancas?tab=oportunidades&tipo=ros&opp=${opportunity.codigo}`)}><CalendarDays className="mr-2 h-4 w-4" />Criar RO</Button>}
          {opportunity.bia_id && <Button onClick={() => navigate(`/bias/${opportunity.bia_id}`)}><Building2 className="mr-2 h-4 w-4" />Abrir BIA</Button>}
        </div>
      </div>

      <div className="border-y py-6">
        <div className="flex flex-wrap items-center gap-2"><Badge className="bg-amber-50 text-amber-800 hover:bg-amber-50">Oportunidade</Badge><Badge variant="outline" className="font-mono">{opportunity.codigo}</Badge><Badge variant="outline">{stageLabel(opportunity.estagio)}</Badge>{!opportunity.dados_completos && <Badge variant="outline">Resumo autorizado</Badge>}</div>
        <h1 className="mt-4 text-3xl font-bold">{opportunity.titulo}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[opportunity.cidade, opportunity.estado, opportunity.pais].filter(Boolean).join(", ") || "Localização não informada"}</span>{opportunity.comunidade_nome && <span>{opportunity.comunidade_nome}</span>}</div>
      </div>

      {opportunity.dados_completos && <TraceabilitySummary objectType="oportunidade" objectId={opportunity.id} />}

      {!opportunity.dados_completos ? (
        <Card><CardContent className="p-6"><h2 className="font-semibold">Resumo autorizado</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{opportunity.resumo_autorizado || "Resumo em preparação."}</p><p className="mt-5 border-t pt-4 text-xs text-muted-foreground">Os dados completos permanecem protegidos e são liberados apenas conforme a participação no fluxo.</p></CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-600" /><h2 className="font-semibold">Tese econômica</h2></div>{canEdit ? <><div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /></div><div className="space-y-2"><Label>Tese</Label><Textarea className="min-h-32" value={form.tese} onChange={(event) => setForm({ ...form, tese: event.target.value })} /></div><div className="space-y-2"><Label>Finalidade imaginada</Label><Input value={form.finalidade} onChange={(event) => setForm({ ...form, finalidade: event.target.value })} /></div><div className="space-y-2"><Label>Resumo autorizado</Label><Textarea value={form.resumo_autorizado} onChange={(event) => setForm({ ...form, resumo_autorizado: event.target.value })} /></div></> : <><p className="whitespace-pre-wrap text-sm leading-relaxed">{opportunity.tese}</p>{opportunity.finalidade && <p className="text-sm text-muted-foreground"><strong className="text-foreground">Finalidade:</strong> {opportunity.finalidade}</p>}</>}</CardContent></Card>

            {canEdit && <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><h2 className="font-semibold">Triagem assistida por IA</h2></div><Button variant="outline" disabled={triageMutation.isPending} onClick={() => triageMutation.mutate()}>{triageMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Analisar tese</Button></div><p className="text-sm text-muted-foreground">A IA sugere caminhos. Nada é alterado até você confirmar e salvar.</p>{suggestions && <div className="space-y-4 border-t pt-4">{suggestions.classificacao && <p className="text-sm"><strong>Classificação sugerida:</strong> {suggestions.classificacao}</p>}{suggestions.resumo && <div><p className="text-sm leading-relaxed">{suggestions.resumo}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setForm({ ...form, resumo_autorizado: suggestions.resumo || form.resumo_autorizado })}>Usar este resumo</Button></div>}{Boolean(suggestions.especialidades?.length) && <div className="flex flex-wrap gap-1.5">{suggestions.especialidades?.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div>}{questionText && <div><p className="whitespace-pre-wrap text-sm text-muted-foreground">{questionText}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setForm({ ...form, parecer: [form.parecer, "Pontos a esclarecer:", questionText].filter(Boolean).join("\n\n") })}>Adicionar ao parecer</Button></div>}</div>}</CardContent></Card>}

            <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-2"><FileInput className="h-4 w-4 text-blue-600" /><h2 className="font-semibold">Fontes relacionadas</h2></div>{(opportunity.fontes || []).length ? <div className="divide-y border-y">{opportunity.fontes?.map((source) => <div key={source.id} className="flex items-center justify-between gap-3 py-3"><span className="text-sm font-medium">{sourceLabel(source.source_type)}</span><span className="max-w-[55%] truncate font-mono text-xs text-muted-foreground">{source.source_id}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Esta tese foi registrada diretamente, sem uma fonte vinculada.</p>}</CardContent></Card>
          </div>

          <div className="space-y-4">
            {canEdit && <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><h2 className="font-semibold">Análise humana</h2></div><div className="space-y-2"><Label>Estágio</Label><Select value={form.estagio} onValueChange={(estagio) => setForm({ ...form, estagio })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Parecer livre</Label><Textarea className="min-h-28" value={form.parecer} onChange={(event) => setForm({ ...form, parecer: event.target.value })} placeholder="Registre a análise, riscos e próximos passos." /></div><div className="grid grid-cols-2 gap-2"><Input value={form.cidade} onChange={(event) => setForm({ ...form, cidade: event.target.value })} placeholder="Cidade" /><Input value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })} placeholder="Estado" /></div><div className="space-y-2"><Label>Responsável</Label><Select value={form.responsavel_membro_id || "sem_responsavel"} onValueChange={(value) => setForm({ ...form, responsavel_membro_id: value === "sem_responsavel" ? "" : value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="sem_responsavel">Sem responsável definido</SelectItem>{(membersQuery.data || []).map((member) => <SelectItem key={member.id} value={member.id}>{member.nome}{member.empresa ? ` · ${member.empresa}` : ""}</SelectItem>)}</SelectContent></Select></div><Button className="w-full" disabled={!form.titulo.trim() || !form.tese.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar análise</Button></CardContent></Card>}

            <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-600" /><h2 className="font-semibold">Reuniões de Oportunidades</h2></div>{(opportunity.reunioes || []).length ? opportunity.reunioes?.map((meeting) => <button key={meeting.id} type="button" className="block w-full border-t py-3 text-left first:border-t-0" onClick={() => navigate(`/area-aliancas?tab=oportunidades&tipo=ros`)}><span className="block text-sm font-medium">{meeting.titulo}</span><span className="mt-1 block text-xs text-muted-foreground">{meeting.codigo} · {new Date(`${meeting.data}T12:00:00`).toLocaleDateString("pt-BR")}</span></button>) : <p className="text-sm text-muted-foreground">Nenhuma RO vinculada. A análise preliminar pode continuar sem reunião.</p>}</CardContent></Card>

            {(opportunity.can_manage || opportunity.can_review) && !opportunity.bia_id && <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-600" /><h2 className="font-semibold">Estruturação de BIA</h2></div><p className="text-sm text-muted-foreground">A solicitação vai para aprovação da governança e não cria a BIA imediatamente.</p>{(opportunity.solicitacoes_bia || []).map((request) => <div key={request.id} className="border-y py-3 text-sm"><span className="font-medium">Solicitação {request.status.replace(/_/g, " ")}</span>{request.motivo_decisao && <p className="mt-1 text-muted-foreground">{request.motivo_decisao}</p>}</div>)}<Button className="w-full" disabled={!form.parecer.trim() || requestBiaMutation.isPending || opportunity.estagio === "estruturacao_solicitada"} onClick={() => requestBiaMutation.mutate()}>{requestBiaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Solicitar estruturação</Button>{!form.parecer.trim() && <p className="text-xs text-muted-foreground">Registre um parecer antes de solicitar.</p>}</CardContent></Card>}

            {!canEdit && opportunity.dados_completos && <Card><CardContent className="p-5"><div className="flex items-center gap-2"><UserRound className="h-4 w-4" /><h2 className="font-semibold">Participação contextual</h2></div><p className="mt-2 text-sm text-muted-foreground">Você tem acesso completo por fazer parte deste fluxo.</p></CardContent></Card>}
          </div>
        </div>
      )}
    </div>
  );
}
