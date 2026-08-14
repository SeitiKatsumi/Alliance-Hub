import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  CalendarDays,
  ChevronRight,
  Filter,
  Handshake,
  Lightbulb,
  Loader2,
  MapPin,
  Pause,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import OportunidadesPage from "@/pages/oportunidades";
import TraceabilitySummary from "@/components/traceability-summary";

type OpportunityType = "demandas" | "oportunidades" | "obas" | "ros";

interface NetworkOpportunity {
  id: string;
  source_id: string;
  codigo: string;
  tipo: "demanda" | "oportunidade" | "oba";
  selo: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  visibilidade: string;
  urgencia?: string | null;
  especialidades?: string[];
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  bia_id?: string | null;
  imovel_id?: string | null;
  expira_em?: string | null;
  fluxo_disparo?: string | null;
  can_manage?: boolean;
  total_interesses?: number | string;
}
interface EconomicOpportunity {
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
  total_fontes?: number | string;
  total_ros?: number | string;
  dados_completos?: boolean;
  can_manage?: boolean;
  can_review?: boolean;
}

interface OpportunityMeeting {
  id: string;
  codigo: string;
  titulo: string;
  data: string;
  hora?: string | null;
  status?: string;
  total_participantes?: number | string;
  oportunidades?: Array<{ codigo: string; tipo: string; titulo: string; papel?: string }>;
}

interface OpportunityMeetingDetail extends OpportunityMeeting {
  link?: string | null;
  pauta?: string | null;
  ata?: string | null;
  proximos_passos?: Array<string | { descricao?: string }>;
  participantes?: Array<{ id: string; nome?: string | null; papel: string; confirmacao: string; presenca: string }>;
  can_organize?: boolean;
  decisoes_estruturadas?: Array<{
    id: string;
    opportunity_codigo: string;
    opportunity_titulo: string;
    acao: string;
    status: string;
  }>;
}

const EMPTY_DEMAND = {
  titulo: "",
  contexto: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  urgencia: "normal",
  especialidades: "",
  publicar: false,
};

const EMPTY_ECONOMIC = {
  titulo: "",
  tese: "",
  finalidade: "",
  cidade: "",
  estado: "",
  pais: "Brasil",
  source_type: "sem_fonte",
  source_id: "",
};

const EMPTY_MEETING = {
  titulo: "",
  data: "",
  hora: "",
  link: "",
  pauta: "",
  oportunidades: [] as string[],
  contextos: [] as string[],
};

function typeFromSearch(search: string): OpportunityType {
  const params = new URLSearchParams(search);
  const value = params.get("tipo");
  if (value === "oportunidades" || value === "obas" || value === "ros") return value;
  if (params.get("tab") === "opas") return "obas";
  return "demandas";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    aberta: "Aberta",
    em_negociacao: "Em negociação",
    contratada: "Contratada",
    em_execucao: "Em execução",
    concluida: "Concluída",
    convertida: "Convertida",
    expirada: "Expirada",
    identificada: "Identificada",
    em_analise: "Em análise",
    em_amadurecimento: "Em amadurecimento",
    pronta_decisao: "Pronta para decisão",
    estruturacao_solicitada: "Estruturação solicitada",
    bia_em_formacao: "BIA em formação",
    convertida_bia: "Convertida em BIA",
    descartada: "Descartada",
    arquivada: "Arquivada",
  };
  return labels[value] || value.replace(/_/g, " ");
}

function stageTone(stage: string) {
  if (["pronta_decisao", "convertida_bia", "concluida"].includes(stage)) return "bg-emerald-50 text-emerald-700";
  if (["descartada", "expirada", "cancelada"].includes(stage)) return "bg-red-50 text-red-700";
  if (["em_analise", "em_amadurecimento", "estruturacao_solicitada", "bia_em_formacao"].includes(stage)) return "bg-amber-50 text-amber-800";
  return "bg-blue-50 text-blue-700";
}

export default function NetworkOpportunitiesHub() {
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const activeType = typeFromSearch(searchParams);
  const preselectedOpportunity = new URLSearchParams(searchParams).get("opp");
  const preselectedMeeting = new URLSearchParams(searchParams).get("ro");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [demandOpen, setDemandOpen] = useState(false);
  const [economicOpen, setEconomicOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [managedDemand, setManagedDemand] = useState<NetworkOpportunity | null>(null);
  const [publicationConsent, setPublicationConsent] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(preselectedMeeting);
  const [demandForm, setDemandForm] = useState(EMPTY_DEMAND);
  const [economicForm, setEconomicForm] = useState(EMPTY_ECONOMIC);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING);
  const [meetingEdit, setMeetingEdit] = useState({ ata: "", proximos_passos: "", status: "agendada" });
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, { acao: string; parecer: string }>>({});
  const [demandEditForm, setDemandEditForm] = useState({
    titulo: "",
    descricao: "",
    cidade: "",
    estado: "",
    pais: "Brasil",
    urgencia: "normal",
    especialidades: "",
  });

  const meQuery = useQuery<any>({ queryKey: ["/api/me"] });
  const canCreateEconomic = Boolean(
    meQuery.data?.em_membros_built
    || ["admin", "manager", "superadmin", "membro", "aliado"].includes(String(meQuery.data?.role || "").toLowerCase()),
  );

  const demandsQuery = useQuery<NetworkOpportunity[]>({
    queryKey: ["/api/rede/oportunidades", "demanda", search, city, specialty],
    queryFn: async () => {
      const params = new URLSearchParams({ tipo: "demanda" });
      if (search.trim()) params.set("q", search.trim());
      if (city.trim()) params.set("cidade", city.trim());
      if (specialty.trim()) params.set("especialidade", specialty.trim());
      const response = await fetch(`/api/rede/oportunidades?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar as Demandas.");
      return response.json();
    },
    enabled: activeType === "demandas",
  });

  const economicsQuery = useQuery<EconomicOpportunity[]>({
    queryKey: ["/api/oportunidades-economicas", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/oportunidades-economicas?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar as Oportunidades.");
      return response.json();
    },
    enabled: activeType === "oportunidades" || activeType === "ros" || meetingOpen,
  });

  const contextsQuery = useQuery<NetworkOpportunity[]>({
    queryKey: ["/api/rede/oportunidades", "meeting-contexts"],
    queryFn: async () => {
      const response = await fetch("/api/rede/oportunidades", { credentials: "include", cache: "no-store" });
      if (!response.ok) return [];
      const rows: NetworkOpportunity[] = await response.json();
      return rows.filter((item) => item.tipo === "demanda" || item.tipo === "oba");
    },
    enabled: meetingOpen,
  });

  const meetingsQuery = useQuery<OpportunityMeeting[]>({
    queryKey: ["/api/reunioes-oportunidades"],
    enabled: activeType === "ros" || Boolean(selectedMeetingId),
  });

  const meetingDetailQuery = useQuery<OpportunityMeetingDetail>({
    queryKey: ["/api/reunioes-oportunidades", selectedMeetingId],
    queryFn: async () => (await apiRequest("GET", `/api/reunioes-oportunidades/${selectedMeetingId}`)).json(),
    enabled: Boolean(selectedMeetingId),
  });

  useEffect(() => {
    if (activeType === "ros" && preselectedOpportunity) {
      setMeetingForm((current) => ({ ...current, oportunidades: current.oportunidades.length ? current.oportunidades : [preselectedOpportunity] }));
      setMeetingOpen(true);
    }
  }, [activeType, preselectedOpportunity]);

  useEffect(() => {
    setSelectedMeetingId(activeType === "ros" ? preselectedMeeting : null);
  }, [activeType, preselectedMeeting]);

  function openMeeting(identifier: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "oportunidades");
    params.set("tipo", "ros");
    params.set("ro", identifier);
    navigate(`/area-aliancas?${params.toString()}`);
  }

  function closeMeeting() {
    const params = new URLSearchParams(searchParams);
    params.delete("ro");
    navigate(`/area-aliancas?${params.toString()}`);
  }

  useEffect(() => {
    const meeting = meetingDetailQuery.data;
    if (!meeting) return;
    setMeetingEdit({
      ata: meeting.ata || "",
      proximos_passos: (meeting.proximos_passos || []).map((item) => typeof item === "string" ? item : item.descricao || "").filter(Boolean).join("\n"),
      status: meeting.status || "agendada",
    });
  }, [meetingDetailQuery.data]);

  const createDemand = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/demandas", {
      titulo: demandForm.titulo,
      contexto: demandForm.contexto,
      descricao: demandForm.contexto,
      cidade: demandForm.cidade,
      estado: demandForm.estado,
      pais: demandForm.pais,
      urgencia: demandForm.urgencia,
      especialidades: demandForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean),
      publicar: demandForm.publicar,
      consentimento_publicacao: demandForm.publicar,
    })).json(),
    onSuccess: () => {
      setDemandOpen(false);
      setDemandForm(EMPTY_DEMAND);
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      toast({ title: "Demanda criada", description: demandForm.publicar ? "Ela já está disponível na Vitrine." : "Ela foi salva como rascunho." });
    },
    onError: (error: any) => toast({ title: "Não foi possível criar a Demanda", description: error?.message, variant: "destructive" }),
  });

  const createEconomic = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/oportunidades-economicas", {
      ...economicForm,
      source_type: economicForm.source_type === "sem_fonte" ? undefined : economicForm.source_type,
      source_id: economicForm.source_type === "sem_fonte" ? undefined : economicForm.source_id,
    })).json(),
    onSuccess: (data: any) => {
      setEconomicOpen(false);
      setEconomicForm(EMPTY_ECONOMIC);
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas"] });
      toast({ title: "Oportunidade criada", description: "A tese está pronta para análise e amadurecimento." });
      navigate(`/area-aliancas/oportunidades/${data.codigo}`);
    },
    onError: (error: any) => toast({ title: "Não foi possível criar a Oportunidade", description: error?.message, variant: "destructive" }),
  });

  const createMeeting = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/reunioes-oportunidades", meetingForm)).json(),
    onSuccess: () => {
      setMeetingOpen(false);
      setMeetingForm(EMPTY_MEETING);
      queryClient.invalidateQueries({ queryKey: ["/api/reunioes-oportunidades"] });
      toast({ title: "RO criada", description: "A pauta e os participantes foram registrados na Agenda." });
    },
    onError: (error: any) => toast({ title: "Não foi possível criar a RO", description: error?.message, variant: "destructive" }),
  });

  const updateMeeting = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/reunioes-oportunidades/${selectedMeetingId}`, {
      ata: meetingEdit.ata,
      proximos_passos: meetingEdit.proximos_passos.split("\n").map((item) => item.trim()).filter(Boolean),
      status: meetingEdit.status,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reunioes-oportunidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reunioes-oportunidades", selectedMeetingId] });
      toast({ title: "RO atualizada" });
    },
    onError: (error: any) => toast({ title: "Não foi possível atualizar a RO", description: error?.message, variant: "destructive" }),
  });

  const executeDecision = useMutation({
    mutationFn: async ({ opportunity, draft }: { opportunity: NetworkOpportunity; draft: { acao: string; parecer: string } }) => (
      await apiRequest("POST", `/api/reunioes-oportunidades/${selectedMeetingId}/decisoes`, {
        oportunidade_codigo: opportunity.codigo,
        acao: draft.acao,
        parecer: draft.parecer,
      })
    ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reunioes-oportunidades", selectedMeetingId] });
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas"] });
      toast({ title: "Decisão executada", description: "O resultado e os vínculos foram registrados no histórico." });
    },
    onError: (error: any) => toast({ title: "Não foi possível executar a decisão", description: error?.message, variant: "destructive" }),
  });

  const openDemandManagement = (demand: NetworkOpportunity) => {
    setManagedDemand(demand);
    setPublicationConsent(false);
    setDemandEditForm({
      titulo: demand.titulo || "",
      descricao: demand.descricao || "",
      cidade: demand.cidade || "",
      estado: demand.estado || "",
      pais: demand.pais || "Brasil",
      urgencia: demand.urgencia || "normal",
      especialidades: (demand.especialidades || []).join(", "),
    });
  };

  const updateDemand = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/demandas/${managedDemand?.source_id}`, {
      ...demandEditForm,
      especialidades: demandEditForm.especialidades.split(",").map((item) => item.trim()).filter(Boolean),
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      setManagedDemand(null);
      toast({ title: "Demanda atualizada" });
    },
    onError: (error: any) => toast({ title: "Não foi possível atualizar a Demanda", description: error?.message, variant: "destructive" }),
  });

  const updateDemandPublication = useMutation({
    mutationFn: async (action: "publicar" | "pausar") => (await apiRequest("POST", `/api/rede/oportunidades/${managedDemand?.codigo}/publicacao`, {
      action,
      consentimento_publicacao: action === "publicar" ? publicationConsent : undefined,
    })).json(),
    onSuccess: (_result, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      setManagedDemand(null);
      toast({ title: action === "publicar" ? "Demanda publicada" : "Publicação pausada" });
    },
    onError: (error: any) => toast({ title: "Não foi possível atualizar a publicação", description: error?.message, variant: "destructive" }),
  });

  const generateEconomicFromDemand = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/demandas/${managedDemand?.source_id}/gerar-oportunidade`, {})).json(),
    onSuccess: (result: any) => {
      const opportunity = result.oportunidade || result;
      setManagedDemand(null);
      queryClient.invalidateQueries({ queryKey: ["/api/rede/oportunidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades-economicas"] });
      if (opportunity?.codigo) navigate(`/area-aliancas/oportunidades/${opportunity.codigo}`);
    },
    onError: (error: any) => toast({ title: "Não foi possível criar a Oportunidade", description: error?.message, variant: "destructive" }),
  });

  const setType = (type: OpportunityType) => navigate(`/area-aliancas?tab=oportunidades&tipo=${type}`, { replace: true });
  const selectedEconomicCodes = useMemo(() => new Set(meetingForm.oportunidades), [meetingForm.oportunidades]);
  const selectedContextCodes = useMemo(() => new Set(meetingForm.contextos), [meetingForm.contextos]);
  const principalMeetingItems = (meetingDetailQuery.data?.oportunidades || []).filter((item) => item.tipo === "oportunidade" && item.papel === "principal") as NetworkOpportunity[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Oportunidades</h2>
          <p className="mt-1 text-sm text-muted-foreground">Necessidades viram Demandas. Teses amadurecem em Oportunidades. BIAs buscam parceiros por OBAs.</p>
        </div>
        {activeType === "demandas" && <Button onClick={() => setDemandOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova Demanda</Button>}
        {activeType === "oportunidades" && <Button disabled={!canCreateEconomic} onClick={() => setEconomicOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova Oportunidade</Button>}
        {activeType === "ros" && <Button onClick={() => setMeetingOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova RO</Button>}
      </div>

      <Tabs value={activeType} onValueChange={(value) => setType(value as OpportunityType)}>
        <TabsList className="flex h-11 w-full flex-nowrap overflow-x-auto">
          <TabsTrigger className="min-w-max flex-1" value="demandas"><Target className="mr-2 h-4 w-4 text-blue-600" />Demandas</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="oportunidades"><Lightbulb className="mr-2 h-4 w-4 text-amber-600" />Oportunidades</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="obas"><Handshake className="mr-2 h-4 w-4 text-emerald-600" />OBAs</TabsTrigger>
          <TabsTrigger className="min-w-max flex-1" value="ros"><CalendarDays className="mr-2 h-4 w-4 text-violet-600" />ROs</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeType === "obas" ? (
        <div className="[&>div]:max-w-none [&>div]:p-0"><OportunidadesPage /></div>
      ) : activeType === "ros" ? (
        <div className="space-y-3">
          {(meetingsQuery.data || []).length === 0 ? (
            <div className="border-y py-12 text-center"><CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma RO cadastrada</p><p className="mt-1 text-sm text-muted-foreground">Crie uma reunião quando uma ou mais teses precisarem de decisão conjunta.</p></div>
          ) : (meetingsQuery.data || []).map((meeting) => (
            <div key={meeting.id} className="border-b py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-violet-50 text-violet-700"><CalendarDays className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{meeting.titulo}</p><Badge variant="outline" className="font-mono">{meeting.codigo}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{new Date(`${meeting.data}T12:00:00`).toLocaleDateString("pt-BR")}{meeting.hora ? ` às ${meeting.hora}` : ""} · {Number(meeting.total_participantes || 0)} participantes</p><div className="mt-2 flex flex-wrap gap-1">{(meeting.oportunidades || []).map((item) => <Badge key={`${item.codigo}-${item.papel}`} variant="outline" className="text-[10px]">{item.papel === "principal" ? "Tese" : item.tipo === "demanda" ? "Demanda" : "OBA"} · {item.codigo}</Badge>)}</div></div>
                <Button variant="outline" onClick={() => openMeeting(meeting.codigo || meeting.id)}>Gerenciar</Button>
              </div>
              <TraceabilitySummary objectType="ro" objectId={meeting.id} compact />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, nome ou palavra-chave..." /></div>
            <div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" disabled={activeType === "oportunidades"} /></div>
            <div className="relative"><Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Especialidade" disabled={activeType === "oportunidades"} /></div>
          </div>
          {activeType === "demandas" ? (
            demandsQuery.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Carregando Demandas...</p> : (demandsQuery.data || []).length === 0 ? (
              <div className="border-y py-12 text-center"><Target className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma Demanda encontrada</p><p className="mt-1 text-sm text-muted-foreground">Uma Demanda pode nascer de um imóvel, de uma BIA ou de uma necessidade direta.</p></div>
            ) : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(demandsQuery.data || []).map((item) => (
              <Card key={item.id} className="rounded-md"><CardContent className="flex h-full flex-col p-4"><div className="flex items-center justify-between gap-2"><Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">Demanda</Badge><span className="font-mono text-[11px] text-muted-foreground">{item.codigo}</span></div><h3 className="mt-3 text-base font-semibold">{item.titulo}</h3>{item.descricao && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.descricao}</p>}<div className="mt-3 flex flex-wrap gap-1.5">{(item.especialidades || []).slice(0, 3).map((value) => <Badge key={value} variant="outline" className="text-[10px]">{value}</Badge>)}</div><div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="text-xs text-muted-foreground"><p>{[item.cidade, item.estado, item.pais].filter(Boolean).join(", ") || "Localização não informada"}</p><p className="mt-1">{statusLabel(item.status)} · {Number(item.total_interesses || 0)} interessados</p></div><Button variant="ghost" size="icon" title="Abrir gestão" onClick={() => item.imovel_id ? navigate(`/carteira/${item.imovel_id}?tab=demandas`) : item.bia_id ? navigate(`/bias/${item.bia_id}?tab=demandas`) : item.can_manage ? openDemandManagement(item) : navigate(`/vitrine/oportunidades/demandas/${item.source_id}`)}>{item.can_manage && !item.imovel_id && !item.bia_id ? <Pencil className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></div></CardContent></Card>
            ))}</div>
          ) : (
            economicsQuery.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Carregando Oportunidades...</p> : (economicsQuery.data || []).length === 0 ? (
              <div className="border-y py-12 text-center"><Lightbulb className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">Nenhuma tese econômica encontrada</p><p className="mt-1 text-sm text-muted-foreground">Membros podem registrar uma tese e amadurecê-la antes de solicitar uma BIA.</p></div>
            ) : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(economicsQuery.data || []).map((item) => (
              <Card key={item.id} className="rounded-md"><CardContent className="flex h-full flex-col p-4"><div className="flex items-center justify-between gap-2"><Badge className="bg-amber-50 text-amber-800 hover:bg-amber-50">Oportunidade</Badge><span className="font-mono text-[11px] text-muted-foreground">{item.codigo}</span></div><h3 className="mt-3 text-base font-semibold">{item.titulo}</h3><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.resumo_autorizado || item.tese || "Resumo em preparação."}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge className={stageTone(item.estagio)}>{statusLabel(item.estagio)}</Badge>{!item.dados_completos && <Badge variant="outline">Resumo autorizado</Badge>}</div><div className="mt-auto flex items-end justify-between gap-3 pt-5"><div className="text-xs text-muted-foreground"><p>{[item.cidade, item.estado, item.pais].filter(Boolean).join(", ") || "Localização não informada"}</p><p className="mt-1">{Number(item.total_fontes || 0)} fontes · {Number(item.total_ros || 0)} ROs</p></div><Button variant="ghost" size="icon" title="Abrir Oportunidade" onClick={() => navigate(`/area-aliancas/oportunidades/${item.codigo}`)}><ChevronRight className="h-4 w-4" /></Button></div></CardContent></Card>
            ))}</div>
          )}
        </>
      )}

      <Dialog open={demandOpen} onOpenChange={setDemandOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Nova Demanda</DialogTitle><DialogDescription>Descreva uma necessidade específica. Você pode criar uma Demanda mesmo sem imóvel vinculado.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input value={demandForm.titulo} onChange={(event) => setDemandForm({ ...demandForm, titulo: event.target.value })} placeholder="Preciso regularizar um imóvel" /></div><div className="space-y-2 sm:col-span-2"><Label>Contexto</Label><Textarea value={demandForm.contexto} onChange={(event) => setDemandForm({ ...demandForm, contexto: event.target.value })} placeholder="Explique o que precisa ser resolvido." /></div><div className="space-y-2"><Label>Cidade</Label><Input value={demandForm.cidade} onChange={(event) => setDemandForm({ ...demandForm, cidade: event.target.value })} /></div><div className="space-y-2"><Label>Estado</Label><Input value={demandForm.estado} onChange={(event) => setDemandForm({ ...demandForm, estado: event.target.value })} /></div><div className="space-y-2"><Label>Urgência</Label><Select value={demandForm.urgencia} onValueChange={(urgencia) => setDemandForm({ ...demandForm, urgencia })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Especialidades</Label><Input value={demandForm.especialidades} onChange={(event) => setDemandForm({ ...demandForm, especialidades: event.target.value })} placeholder="Avaliação, Jurídico..." /></div><label className="flex items-start gap-3 sm:col-span-2"><Checkbox checked={demandForm.publicar} onCheckedChange={(checked) => setDemandForm({ ...demandForm, publicar: checked === true })} /><span className="text-sm">Publicar na Vitrine e autorizar o compartilhamento do resumo. Dados privados permanecem protegidos.</span></label></div><DialogFooter><Button variant="outline" onClick={() => setDemandOpen(false)}>Cancelar</Button><Button disabled={!demandForm.titulo.trim() || !demandForm.contexto.trim() || createDemand.isPending} onClick={() => createDemand.mutate()}>Criar Demanda</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(managedDemand)} onOpenChange={(open) => !open && setManagedDemand(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Gerenciar Demanda</DialogTitle><DialogDescription>{managedDemand?.codigo} · edite a necessidade, controle a publicação ou transforme-a em uma tese econômica.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input value={demandEditForm.titulo} onChange={(event) => setDemandEditForm({ ...demandEditForm, titulo: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Textarea className="min-h-28" value={demandEditForm.descricao} onChange={(event) => setDemandEditForm({ ...demandEditForm, descricao: event.target.value })} /></div><div className="space-y-2"><Label>Cidade</Label><Input value={demandEditForm.cidade} onChange={(event) => setDemandEditForm({ ...demandEditForm, cidade: event.target.value })} /></div><div className="space-y-2"><Label>Estado</Label><Input value={demandEditForm.estado} onChange={(event) => setDemandEditForm({ ...demandEditForm, estado: event.target.value })} /></div><div className="space-y-2"><Label>Urgência</Label><Select value={demandEditForm.urgencia} onValueChange={(urgencia) => setDemandEditForm({ ...demandEditForm, urgencia })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Especialidades</Label><Input value={demandEditForm.especialidades} onChange={(event) => setDemandEditForm({ ...demandEditForm, especialidades: event.target.value })} /></div></div><div className="space-y-3 border-y py-4"><div className="flex flex-wrap gap-2">{managedDemand?.visibilidade === "publicada" ? <Button variant="outline" disabled={updateDemandPublication.isPending} onClick={() => updateDemandPublication.mutate("pausar")}><Pause className="mr-2 h-4 w-4" />Pausar na Vitrine</Button> : <Button variant="outline" disabled={!publicationConsent || updateDemandPublication.isPending} onClick={() => updateDemandPublication.mutate("publicar")}><Upload className="mr-2 h-4 w-4" />Publicar na Vitrine</Button>}{canCreateEconomic && <Button variant="outline" disabled={generateEconomicFromDemand.isPending} onClick={() => generateEconomicFromDemand.mutate()}>{generateEconomicFromDemand.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}Criar Oportunidade</Button>}</div>{managedDemand?.visibilidade !== "publicada" && <label className="flex items-start gap-3 text-sm"><Checkbox checked={publicationConsent} onCheckedChange={(checked) => setPublicationConsent(checked === true)} /><span>Autorizo a publicação do resumo na Vitrine. Endereço exato, documentos e contatos permanecem privados.</span></label>}</div><DialogFooter><Button variant="outline" onClick={() => setManagedDemand(null)}>Cancelar</Button><Button disabled={!demandEditForm.titulo.trim() || !demandEditForm.descricao.trim() || updateDemand.isPending} onClick={() => updateDemand.mutate()}>{updateDemand.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={economicOpen} onOpenChange={setEconomicOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Nova Oportunidade econômica</DialogTitle><DialogDescription>Registre uma tese de negócio. Isso ainda não cria uma BIA nem uma OBA.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input value={economicForm.titulo} onChange={(event) => setEconomicForm({ ...economicForm, titulo: event.target.value })} placeholder="Aquisição e retrofit do Edifício Central" /></div><div className="space-y-2 sm:col-span-2"><Label>Tese inicial</Label><Textarea className="min-h-28" value={economicForm.tese} onChange={(event) => setEconomicForm({ ...economicForm, tese: event.target.value })} placeholder="Explique o ativo, a transformação imaginada e o resultado econômico esperado." /></div><div className="space-y-2 sm:col-span-2"><Label>Finalidade imaginada</Label><Input value={economicForm.finalidade} onChange={(event) => setEconomicForm({ ...economicForm, finalidade: event.target.value })} placeholder="Aquisição, retrofit e operação para renda" /></div><div className="space-y-2"><Label>Cidade</Label><Input value={economicForm.cidade} onChange={(event) => setEconomicForm({ ...economicForm, cidade: event.target.value })} /></div><div className="space-y-2"><Label>Estado</Label><Input value={economicForm.estado} onChange={(event) => setEconomicForm({ ...economicForm, estado: event.target.value })} /></div><div className="space-y-2"><Label>Origem</Label><Select value={economicForm.source_type} onValueChange={(source_type) => setEconomicForm({ ...economicForm, source_type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem_fonte">Registro direto</SelectItem><SelectItem value="demanda">Demanda</SelectItem><SelectItem value="land_bank_asset">Banco de Ativos</SelectItem><SelectItem value="imovel">Imóvel da Carteira</SelectItem><SelectItem value="oportunidade_externa">Oportunidade externa</SelectItem><SelectItem value="servico">Prestação de serviço</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Código/ID da origem</Label><Input disabled={economicForm.source_type === "sem_fonte"} value={economicForm.source_id} onChange={(event) => setEconomicForm({ ...economicForm, source_id: event.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEconomicOpen(false)}>Cancelar</Button><Button disabled={!economicForm.titulo.trim() || !economicForm.tese.trim() || (economicForm.source_type !== "sem_fonte" && !economicForm.source_id.trim()) || createEconomic.isPending} onClick={() => createEconomic.mutate()}>Criar Oportunidade</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Nova Reunião de Oportunidades</DialogTitle><DialogDescription>A pauta principal é formada por teses econômicas. Demandas e OBAs entram apenas como contexto.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input value={meetingForm.titulo} onChange={(event) => setMeetingForm({ ...meetingForm, titulo: event.target.value })} placeholder="RO semanal de oportunidades" /></div><div className="space-y-2"><Label>Data</Label><Input type="date" value={meetingForm.data} onChange={(event) => setMeetingForm({ ...meetingForm, data: event.target.value })} /></div><div className="space-y-2"><Label>Horário</Label><Input type="time" value={meetingForm.hora} onChange={(event) => setMeetingForm({ ...meetingForm, hora: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>Link</Label><Input value={meetingForm.link} onChange={(event) => setMeetingForm({ ...meetingForm, link: event.target.value })} placeholder="https://..." /></div><div className="space-y-2 sm:col-span-2"><Label>Pauta</Label><Textarea value={meetingForm.pauta} onChange={(event) => setMeetingForm({ ...meetingForm, pauta: event.target.value })} /></div><div className="space-y-2 sm:col-span-2"><Label>Oportunidades da pauta</Label><div className="max-h-48 divide-y overflow-y-auto border-y">{(economicsQuery.data || []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 py-3"><Checkbox checked={selectedEconomicCodes.has(item.codigo)} onCheckedChange={(checked) => setMeetingForm((current) => ({ ...current, oportunidades: checked ? [...current.oportunidades, item.codigo] : current.oportunidades.filter((code) => code !== item.codigo) }))} /><Badge className="bg-amber-50 text-amber-800">Tese</Badge><span className="min-w-0 flex-1 truncate text-sm">{item.titulo}</span><span className="font-mono text-[10px] text-muted-foreground">{item.codigo}</span></label>)}</div></div><div className="space-y-2 sm:col-span-2"><Label>Demandas e OBAs relacionadas</Label><div className="max-h-40 divide-y overflow-y-auto border-y">{(contextsQuery.data || []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 py-3"><Checkbox checked={selectedContextCodes.has(item.codigo)} onCheckedChange={(checked) => setMeetingForm((current) => ({ ...current, contextos: checked ? [...current.contextos, item.codigo] : current.contextos.filter((code) => code !== item.codigo) }))} /><Badge variant="outline">{item.tipo === "demanda" ? "Demanda" : "OBA"}</Badge><span className="min-w-0 flex-1 truncate text-sm">{item.titulo}</span></label>)}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setMeetingOpen(false)}>Cancelar</Button><Button disabled={!meetingForm.titulo || !meetingForm.data || meetingForm.oportunidades.length === 0 || createMeeting.isPending} onClick={() => createMeeting.mutate()}>Criar RO</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selectedMeetingId)} onOpenChange={(open) => !open && closeMeeting()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{meetingDetailQuery.data?.can_organize ? "Gerenciar" : "Consultar"} {meetingDetailQuery.data?.codigo || "RO"}</DialogTitle><DialogDescription>{meetingDetailQuery.data?.can_organize ? "Registre a ata e execute uma decisão confirmada para cada Oportunidade da pauta." : "Consulte a pauta, os participantes e as decisões registradas."}</DialogDescription></DialogHeader>{meetingDetailQuery.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Carregando reunião...</p> : <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Ata</Label><Textarea className="min-h-28" value={meetingEdit.ata} disabled={!meetingDetailQuery.data?.can_organize} onChange={(event) => setMeetingEdit({ ...meetingEdit, ata: event.target.value })} /></div><div className="space-y-2"><Label>Próximos passos</Label><Textarea value={meetingEdit.proximos_passos} disabled={!meetingDetailQuery.data?.can_organize} onChange={(event) => setMeetingEdit({ ...meetingEdit, proximos_passos: event.target.value })} placeholder="Um passo por linha" /></div><div className="space-y-2"><Label>Status</Label><Select value={meetingEdit.status} disabled={!meetingDetailQuery.data?.can_organize} onValueChange={(status) => setMeetingEdit({ ...meetingEdit, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agendada">Agendada</SelectItem><SelectItem value="realizada">Realizada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div></div><div><h3 className="font-semibold">Decisões por Oportunidade</h3><div className="mt-2 divide-y border-y">{principalMeetingItems.map((item) => { const existing = (meetingDetailQuery.data?.decisoes_estruturadas || []).find((decision) => decision.opportunity_codigo === item.codigo); const draft = decisionDrafts[item.codigo] || { acao: "amadurecer", parecer: "" }; return <div key={item.codigo} className="space-y-3 py-4"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-amber-50 text-amber-800">{item.codigo}</Badge><p className="font-medium">{item.titulo}</p>{existing && <Badge variant="outline">{statusLabel(existing.acao)} · {existing.status}</Badge>}</div>{!existing && meetingDetailQuery.data?.can_organize && <><div className="grid gap-3 sm:grid-cols-[210px_1fr]"><Select value={draft.acao} onValueChange={(acao) => setDecisionDrafts((current) => ({ ...current, [item.codigo]: { ...draft, acao } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="descartar">Descartar</SelectItem><SelectItem value="amadurecer">Amadurecer</SelectItem><SelectItem value="gerar_demanda">Gerar Demanda</SelectItem><SelectItem value="solicitar_bia">Solicitar estruturação de BIA</SelectItem></SelectContent></Select><Input value={draft.parecer} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [item.codigo]: { ...draft, parecer: event.target.value } }))} placeholder="Parecer que fundamenta a decisão" /></div><Button size="sm" disabled={!draft.parecer.trim() || executeDecision.isPending} onClick={() => executeDecision.mutate({ opportunity: item, draft })}>Executar decisão</Button></>}</div>; })}</div></div><div><h3 className="font-semibold">Participantes</h3><div className="mt-2 flex flex-wrap gap-2">{(meetingDetailQuery.data?.participantes || []).map((participant) => <Badge key={participant.id} variant="outline"><Users className="mr-1 h-3 w-3" />{participant.nome || "Participante BUILT"} · {participant.presenca === "presente" ? "presente" : participant.confirmacao}</Badge>)}</div></div></div>}<DialogFooter><Button variant="outline" onClick={closeMeeting}>Fechar</Button>{meetingDetailQuery.data?.can_organize && <Button onClick={() => updateMeeting.mutate()} disabled={updateMeeting.isPending}>Salvar ata</Button>}</DialogFooter></DialogContent></Dialog>
    </div>
  );
}
