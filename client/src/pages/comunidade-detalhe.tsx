import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type React from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getBiaUrl } from "@/lib/bia-url";
import { getMembroUrl } from "@/lib/public-refs";
import {
  ArrowLeft, MapPin, Users, Briefcase, Shield,
  MessageCircle, Pencil, Globe, Calendar, Hash, Layers3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import NetworkOpportunitiesHub from "@/pages/network-opportunities";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Membro {
  id: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  foto_perfil?: string | null;
  tipo_de_cadastro?: string | null;
  tipo_alianca?: string | null;
  tipos_alianca?: string[] | null;
  nucleo_alianca?: string | null;
  nucleos_alianca?: string[] | null;
  Outras_redes_as_quais_pertenco?: string[] | null;
  em_built_capital?: boolean | null;
  na_vitrine?: boolean | null;
}
interface Bia {
  id: string;
  codigo_publico?: string | null;
  nome_bia?: string;
  localizacao?: string;
}
interface MembroJunction { cadastro_geral_id: Membro | string | null; }
interface BiaJunction { bias_projetos_id: Bia | string | null; }

interface StrategicCellMembership {
  id: string;
  membro_id: string;
  nome: string;
  status: "INTERESTED" | "PENDING" | "ACTIVE" | "REJECTED" | "LEFT";
}

interface StrategicCell {
  id: string;
  name: string;
  description?: string | null;
  proposal_reason?: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "ARCHIVED";
  coordinator_membro_id?: string | null;
  type_code: string;
  type_public_name: string;
  type_short_description: string;
  markets: Array<{ code: string; public_name: string; short_description?: string | null }>;
  member_count: number;
  my_membership_id?: string | null;
  my_membership_status?: StrategicCellMembership["status"] | null;
  memberships?: StrategicCellMembership[];
}

interface StrategicCellsResponse {
  cells: StrategicCell[];
  can_manage: boolean;
  is_community_member: boolean;
  has_member_entitlement: boolean;
}

interface Comunidade {
  id: string;
  nome?: string;
  sigla?: string;
  pais?: string;
  sigla_pais?: string;
  territorio?: string;
  sigla_territorio?: string;
  codigo_sequencial?: string;
  status?: string;
  date_created?: string;
  aliado?: Membro | string | null;
  membros?: MembroJunction[];
  bias?: BiaJunction[];
  analytics?: {
    opas_total: number;
    opas_por_abrangencia: Array<{ name: string; value: number }>;
    composicao: {
      parceiros_mercado: number;
      area_aliancas: number;
      parceiros_capital: number;
    };
  };
}

const CHART_COLORS = ["#D7BB7D", "#0EA5E9", "#10B981", "#8B5CF6"];
const CELL_STATUS_LABELS: Record<StrategicCell["status"], string> = {
  DRAFT: "Rascunho",
  PENDING_APPROVAL: "Aguardando aprovação",
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  REJECTED: "Rejeitada",
  ARCHIVED: "Arquivada",
};
const MEMBERSHIP_STATUS_LABELS: Record<StrategicCellMembership["status"], string> = {
  INTERESTED: "Interesse registrado",
  PENDING: "Participação em análise",
  ACTIVE: "Participante",
  REJECTED: "Participação recusada",
  LEFT: "Participação encerrada",
};

function resolveAliado(c: Comunidade): Membro | null {
  if (!c.aliado) return null;
  if (typeof c.aliado === "object") return c.aliado as Membro;
  return null;
}
function resolveMembros(c: Comunidade): Membro[] {
  if (!Array.isArray(c.membros)) return [];
  return c.membros.flatMap((m) => {
    const v = m.cadastro_geral_id;
    if (!v || typeof v === "string") return [];
    return [v as Membro];
  });
}
function resolveBias(c: Comunidade): Bia[] {
  if (!Array.isArray(c.bias)) return [];
  return c.bias.flatMap((b) => {
    const v = b.bias_projetos_id;
    if (!v || typeof v === "string") return [];
    return [v as Bia];
  });
}
function resolveAliadoId(c: Comunidade): string {
  if (!c.aliado) return "";
  if (typeof c.aliado === "string") return c.aliado;
  return c.aliado.id || "";
}
function resolveMembrosIds(c: Comunidade): string[] {
  if (!Array.isArray(c.membros)) return [];
  return c.membros.flatMap((m) => {
    const v = m.cadastro_geral_id;
    if (!v) return [];
    return [typeof v === "string" ? v : v.id];
  }).filter(Boolean);
}
function resolveBiasIds(c: Comunidade): string[] {
  if (!Array.isArray(c.bias)) return [];
  return c.bias.flatMap((b) => {
    const v = b.bias_projetos_id;
    if (!v) return [];
    return [typeof v === "string" ? v : v.id];
  }).filter(Boolean);
}
function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  return `/api/assets/${foto}?width=80&height=80&fit=cover`;
}
function getInitials(nome?: string): string {
  if (!nome) return "?";
  return nome.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

interface ComunidadeEditForm {
  pais: string;
  territorio: string;
  aliado_id: string;
  membros_ids: string[];
  bias_ids: string[];
  status: string;
}

function DarkPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 space-y-4 ${className}`}
      style={{
        background: "linear-gradient(145deg, #071626, #040e1c)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-gold/60" />
      <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">{children}</h2>
    </div>
  );
}

export default function ComunidadeDetalhePage() {
  const { id, cellId } = useParams<{ id: string; cellId?: string }>();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ComunidadeEditForm>({
    pais: "",
    territorio: "",
    aliado_id: "",
    membros_ids: [],
    bias_ids: [],
    status: "ativa",
  });
  const fromDashboard = new URLSearchParams(search).get("from") === "dashboard";
  const requestedCommunityTab = new URLSearchParams(search).get("tab");
  const activeCommunityTab = requestedCommunityTab === "celulas" || requestedCommunityTab === "ros" ? requestedCommunityTab : "visao-geral";
  const backHref = fromDashboard ?"/" : "/area-aliancas?tab=comunidades";
  const backLabel = fromDashboard ?"Voltar para Dashboard" : "Voltar para Área de Alianças";

  const { data: comunidade, isLoading, isError } = useQuery<Comunidade>({
    queryKey: ["/api/comunidades", id],
    queryFn: () =>
      fetch(`/api/comunidades/${id}`).then(r => {
        if (!r.ok) throw new Error("Não encontrado");
        return r.json();
      }),
    enabled: !!id,
  });

  const { data: strategicCellsData, isLoading: isLoadingCells } = useQuery<StrategicCellsResponse>({
    queryKey: ["/api/comunidades", id, "celulas"],
    queryFn: () => fetch(`/api/comunidades/${id}/celulas`).then(r => {
      if (!r.ok) throw new Error("Não foi possível carregar as Células.");
      return r.json();
    }),
    enabled: !!id,
  });

  const { data: membrosDisponiveis = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros", "comunidade-detalhe-edit"],
    queryFn: () => fetch("/api/membros").then(r => r.ok ? r.json() : []),
    enabled: editOpen,
  });

  const { data: biasDisponiveis = [] } = useQuery<Bia[]>({
    queryKey: ["/api/bias", "comunidade-detalhe-edit"],
    queryFn: () => fetch("/api/bias").then(r => r.ok ? r.json() : []),
    enabled: editOpen,
  });

  const membrosOrdenados = useMemo(() => [...membrosDisponiveis].sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
  ), [membrosDisponiveis]);

  const biasOrdenadas = useMemo(() => [...biasDisponiveis].sort((a, b) =>
    (a.nome_bia || a.id || "").localeCompare(b.nome_bia || b.id || "", "pt-BR", { sensitivity: "base" })
  ), [biasDisponiveis]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("PATCH", `/api/comunidades/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/comunidades"] });
      toast({ title: "Comunidade atualizada!" });
      setEditOpen(false);
    },
    onError: () => toast({ title: "Erro ao atualizar comunidade", variant: "destructive" }),
  });

  const cellParticipationMutation = useMutation({
    mutationFn: ({ cellId, action }: { cellId: string; action: "INTERESTED" | "REQUEST" | "LEAVE" }) =>
      apiRequest("POST", `/api/comunidades/${id}/celulas/${cellId}/participacao`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/comunidades", id, "celulas"] }),
    onError: (error: any) => toast({ title: "Não foi possível registrar sua escolha", description: error?.message, variant: "destructive" }),
  });

  const decideCellMembershipMutation = useMutation({
    mutationFn: ({ cellId, membershipId, status }: { cellId: string; membershipId: string; status: "ACTIVE" | "REJECTED" }) =>
      apiRequest("PATCH", `/api/comunidades/${id}/celulas/${cellId}/participacoes/${membershipId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/comunidades", id, "celulas"] }),
    onError: (error: any) => toast({ title: "Não foi possível decidir a participação", description: error?.message, variant: "destructive" }),
  });

  function openEditModal(c: Comunidade) {
    setEditForm({
      pais: c.pais || "",
      territorio: c.territorio || "",
      aliado_id: resolveAliadoId(c),
      membros_ids: resolveMembrosIds(c),
      bias_ids: resolveBiasIds(c),
      status: c.status || "ativa",
    });
    setEditOpen(true);
  }

  function toggleEditMembro(membroId: string) {
    setEditForm((current) => {
      const ids = current.membros_ids || [];
      return { ...current, membros_ids: ids.includes(membroId) ? ids.filter(x => x !== membroId) : [...ids, membroId] };
    });
  }

  function toggleEditBia(biaId: string) {
    setEditForm((current) => {
      const ids = current.bias_ids || [];
      return { ...current, bias_ids: ids.includes(biaId) ? ids.filter(x => x !== biaId) : [...ids, biaId] };
    });
  }

  function saveEdit() {
    updateMutation.mutate({
      pais: editForm.pais,
      territorio: editForm.territorio,
      aliado_id: editForm.aliado_id || null,
      membros_ids: editForm.membros_ids || [],
      bias_ids: editForm.bias_ids || [],
      status: editForm.status || "ativa",
    });
  }

  function selectCommunityTab(tab: "visao-geral" | "celulas" | "ros") {
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    navigate(`${location}?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !comunidade) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-64 gap-4">
        <MessageCircle className="w-12 h-12 text-brand-gold/20" />
        <p className="text-white/40 font-mono">Comunidade não encontrada</p>
        <Button variant="ghost" onClick={() => navigate(backHref)} className="text-brand-gold">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const aliado = resolveAliado(comunidade);
  const membros = resolveMembros(comunidade);
  const bias = resolveBias(comunidade);
  const aliadoFoto = fotoUrl(aliado?.foto_perfil);

  if (cellId) {
    if (isLoadingCells) {
      return <div className="p-6 max-w-4xl mx-auto"><Skeleton className="h-72 rounded-2xl" /></div>;
    }
    const cell = strategicCellsData?.cells.find((item) => String(item.id) === String(cellId));
    if (!cell) {
      return (
        <div className="p-6 max-w-4xl mx-auto flex min-h-64 flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Célula não encontrada.</p>
          <Button variant="outline" onClick={() => navigate(`/comunidade/${id}?tab=celulas`)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Células</Button>
        </div>
      );
    }
    const activeMemberships = (cell.memberships || []).filter((membership) => membership.status === "ACTIVE");
    const pendingMemberships = (cell.memberships || []).filter((membership) => ["INTERESTED", "PENDING"].includes(membership.status));
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" data-testid="page-celula-detalhe">
        <button
          onClick={() => navigate(`/comunidade/${id}?tab=celulas`)}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/20 px-3 py-1.5 text-sm text-brand-gold/70 transition-colors hover:bg-brand-gold/10 hover:text-brand-gold"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Células
        </button>

        <section className="rounded-2xl p-5 sm:p-7" style={{ background: "linear-gradient(145deg, #071626, #040e1c)", border: "1px solid rgba(215,187,125,0.15)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Célula · {comunidade.nome}</p>
              <h1 className="mt-2 text-2xl font-bold text-white">{cell.name || cell.type_public_name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">{cell.description || cell.type_short_description}</p>
            </div>
            <Badge variant="outline" className="w-fit border-emerald-400/30 text-emerald-300">{CELL_STATUS_LABELS[cell.status]}</Badge>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-white/50">
            <Users className="h-4 w-4" /> {Number(cell.member_count || 0)} participante(s)
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6" data-testid="section-participantes-celula">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Participantes</h2>
            <Badge variant="secondary">{activeMemberships.length}</Badge>
          </div>
          {activeMemberships.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeMemberships.map((membership) => (
                <div key={membership.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{getInitials(membership.nome || "Membro")}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{membership.nome}</p>
                    <p className="text-xs text-muted-foreground">Participante</p>
                  </div>
                  {membership.membro_id && <Button size="sm" variant="ghost" onClick={() => navigate(`/membro/${membership.membro_id}`)}>Ver perfil</Button>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não há participantes nesta Célula.</p>
          )}
        </section>

        {strategicCellsData?.can_manage && pendingMemberships.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Solicitações de participação</h2>
            <div className="space-y-3">
              {pendingMemberships.map((membership) => (
                <div key={membership.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{membership.nome}</p>
                    <p className="text-xs text-muted-foreground">{MEMBERSHIP_STATUS_LABELS[membership.status]}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decideCellMembershipMutation.mutate({ cellId: cell.id, membershipId: membership.id, status: "ACTIVE" })}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => decideCellMembershipMutation.mutate({ cellId: cell.id, membershipId: membership.id, status: "REJECTED" })}>Recusar</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  const analytics = comunidade.analytics ?? {
    opas_total: 0,
    opas_por_abrangencia: [
      { name: "Regional", value: 0 },
      { name: "Nacional", value: 0 },
      { name: "Global", value: 0 },
    ],
    composicao: {
      parceiros_mercado: 0,
      area_aliancas: 0,
      parceiros_capital: 0,
    },
  };
  const opaChartData = [
    { name: "Total", value: analytics.opas_total },
    ...analytics.opas_por_abrangencia,
  ];
  const composicaoChartData = [
    { name: "Mercado", value: analytics.composicao.parceiros_mercado },
    { name: "Área de Alianças", value: analytics.composicao.area_aliancas },
    { name: "Capital", value: analytics.composicao.parceiros_capital },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(backHref)}
        className="inline-flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg transition-colors text-brand-gold/70 hover:text-brand-gold hover:bg-brand-gold/10 border border-brand-gold/20 hover:border-brand-gold/40"
        data-testid="btn-back-comunidade"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </button>

      <nav className="flex h-auto w-full flex-nowrap gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1" aria-label="Navegação da Comunidade" role="tablist">
        <Button role="tab" aria-selected={activeCommunityTab === "visao-geral"} variant={activeCommunityTab === "visao-geral" ? "secondary" : "ghost"} size="sm" className="min-w-max" onClick={() => selectCommunityTab("visao-geral")}>Visão Geral</Button>
        <Button role="tab" aria-selected={activeCommunityTab === "celulas"} variant={activeCommunityTab === "celulas" ? "secondary" : "ghost"} size="sm" className="min-w-max" onClick={() => selectCommunityTab("celulas")}>Células</Button>
        <Button role="tab" aria-selected={activeCommunityTab === "ros"} variant={activeCommunityTab === "ros" ? "secondary" : "ghost"} size="sm" className="min-w-max" onClick={() => selectCommunityTab("ros")}>ROs</Button>
      </nav>

      {/* Hero */}
      <div
        id="visao-geral"
        className={`${activeCommunityTab === "visao-geral" ? "block" : "hidden"} relative rounded-2xl overflow-hidden p-8`}
        style={{
          background: "linear-gradient(135deg, #071626 0%, #040e1c 60%, #071420 100%)",
          border: "1px solid rgba(215,187,125,0.15)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Gold line top */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(215,187,125,0.6), transparent)" }} />

        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, #D7BB7D, transparent)" }} />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            {/* Sigla / code */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl"
                style={{ background: "rgba(215,187,125,0.1)", border: "1px solid rgba(215,187,125,0.2)" }}>
                <MessageCircle className="w-5 h-5 text-brand-gold" />
              </div>
              {comunidade.sigla && (
                <span className="text-xs font-mono text-brand-gold/60 tracking-[0.2em] uppercase">
                  {comunidade.sigla}
                </span>
              )}
            </div>

            {/* Nome */}
            <h1 className="text-2xl font-bold text-white font-mono leading-tight" data-testid="text-comunidade-nome">
              {comunidade.nome || "—"}
            </h1>

            {/* Localização */}
            {(comunidade.territorio || comunidade.pais) && (
              <div className="flex items-center gap-1.5 text-sm text-white/50 font-mono">
                <MapPin className="w-4 h-4 text-brand-gold/50" />
                {[comunidade.territorio, comunidade.pais].filter(Boolean).join(", ")}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-mono border ${
              comunidade.status === "ativa"
                ?"border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border-white/10 text-white/30 bg-white/5"
            }`} data-testid="text-status">
              {comunidade.status || "ativa"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditModal(comunidade)}
              className="border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 font-mono text-xs"
              data-testid="btn-edit-from-detail"
            >
              <Pencil className="w-3 h-3 mr-1.5" />
              Editar
            </Button>
          </div>
        </div>

        {/* Meta info */}
        <div className="relative mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-6 text-xs font-mono text-white/30">
          {comunidade.date_created && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-gold/30" />
              Criada em {formatDate(comunidade.date_created)}
            </div>
          )}
          {comunidade.codigo_sequencial && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-brand-gold/30" />
              Código {comunidade.codigo_sequencial}
            </div>
          )}
          {(comunidade.sigla_pais || comunidade.sigla_territorio) && (
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-brand-gold/30" />
              {[comunidade.sigla_pais, comunidade.sigla_territorio].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
      {/* Células ficam dentro da Comunidade; não há menu global. */}
      <section
        id="celulas"
        className={`${activeCommunityTab === "celulas" ? "block" : "hidden"} rounded-2xl p-4 sm:p-6 space-y-5`}
        style={{ background: "linear-gradient(145deg, #071626, #040e1c)", border: "1px solid rgba(215,187,125,0.15)" }}
        data-testid="section-celulas-comunidade"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl shrink-0" style={{ background: "rgba(215,187,125,0.1)", border: "1px solid rgba(215,187,125,0.2)" }}>
              <Layers3 className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Células desta Comunidade</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                Grupos organizados por uma estratégia imobiliária.
              </p>
            </div>
          </div>
        </div>

        {isLoadingCells ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
          </div>
        ) : strategicCellsData?.cells.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {strategicCellsData.cells.map((cell) => {
              const membershipStatus = cell.my_membership_status || null;
              return (
                <article
                  key={cell.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir Célula ${cell.name || cell.type_public_name}`}
                  onClick={() => navigate(`/comunidade/${id}/celulas/${cell.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/comunidade/${id}/celulas/${cell.id}`);
                    }
                  }}
                  className="rounded-xl p-4 space-y-4 min-w-0 cursor-pointer transition-shadow hover:ring-1 hover:ring-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                  data-testid={`card-celula-${cell.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Célula</p>
                      <h3 className="mt-1 text-sm font-bold text-white break-words">{cell.name || cell.type_public_name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">{cell.description || cell.type_short_description}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${cell.status === "ACTIVE" ? "border-emerald-400/30 text-emerald-300" : "border-amber-400/30 text-amber-300"}`}
                    >
                      {CELL_STATUS_LABELS[cell.status]}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {Number(cell.member_count || 0)} participante(s)</span>
                  </div>

                  {!strategicCellsData.can_manage && cell.status === "ACTIVE" && strategicCellsData.is_community_member ? (
                    <div className="border-t border-white/5 pt-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      {membershipStatus ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-white/55">{MEMBERSHIP_STATUS_LABELS[membershipStatus]}</p>
                          {!["REJECTED", "LEFT"].includes(membershipStatus) && <Button size="sm" variant="ghost" className="text-white/45" onClick={() => cellParticipationMutation.mutate({ cellId: cell.id, action: "LEAVE" })}>Sair da Célula</Button>}
                          {membershipStatus === "INTERESTED" && strategicCellsData.has_member_entitlement && <Button size="sm" onClick={() => cellParticipationMutation.mutate({ cellId: cell.id, action: "REQUEST" })}>Solicitar participação</Button>}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button size="sm" variant="outline" className="border-brand-gold/25 text-brand-gold" onClick={() => cellParticipationMutation.mutate({ cellId: cell.id, action: "INTERESTED" })}>Tenho interesse</Button>
                          {strategicCellsData.has_member_entitlement && <Button size="sm" onClick={() => cellParticipationMutation.mutate({ cellId: cell.id, action: "REQUEST" })}>Solicitar participação</Button>}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/45">Não foi possível carregar as seis Células oficiais desta Comunidade.</p>
        )}
      </section>

      <section
        id="ros"
        className={`${activeCommunityTab === "ros" ? "block" : "hidden"} rounded-2xl border border-border/60 bg-card p-4 sm:p-6`}
        data-testid="section-ros-comunidade"
      >
        <NetworkOpportunitiesHub communityId={String(id || "")} communityName={comunidade.nome} roOnly />
      </section>

      <div className={`${activeCommunityTab === "visao-geral" ? "grid" : "hidden"} grid-cols-1 md:grid-cols-2 gap-6`}>
        {/* Aliado BUILT */}
        <div
          className="rounded-2xl p-5 space-y-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #071626, #040e1c)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-brand-gold/60" />
            <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">Aliado BUILT</h2>
          </div>
          {/* Selo Alliance Partner */}
          <img
            src="/built-alliance-partner.png"
            alt="BUILT Alliance Partner"
            className="absolute top-3 right-3 opacity-20 select-none pointer-events-none"
            style={{ height: 56, width: "auto" }}
          />

          {aliado ?(
            <button
              onClick={() => navigate(getMembroUrl(aliado))}
              className="w-full flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-white/5 text-left"
              data-testid="btn-aliado-link"
            >
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-brand-gold/25"
                style={{ background: aliadoFoto ?"transparent" : "rgba(215,187,125,0.08)" }}
              >
                {aliadoFoto
                  ?<img src={aliadoFoto} alt={aliado.nome} className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-brand-gold/60">{getInitials(aliado.nome)}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white font-mono truncate">{aliado.nome}</p>
                {aliado.cargo && <p className="text-xs text-white/40 font-mono truncate">{aliado.cargo}</p>}
                {aliado.empresa && <p className="text-xs text-brand-gold/50 font-mono truncate">{aliado.empresa}</p>}
              </div>
            </button>
          ) : (
            <p className="text-xs text-white/25 font-mono italic">Nenhum Aliado BUILT definido</p>
          )}
        </div>

        {/* Stats quick view */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "linear-gradient(145deg, #071626, #040e1c)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">Resumo</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
              <p className="text-2xl font-bold text-brand-gold font-mono">{membros.length}</p>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">Membros</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
              <p className="text-2xl font-bold text-brand-gold font-mono">{bias.length}</p>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-1">BIAs</p>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Indicadores da comunidade */}
      <div className={`${activeCommunityTab === "visao-geral" ? "grid" : "hidden"} grid-cols-1 lg:grid-cols-2 gap-6`}>
        <DarkPanel>
          <SectionTitle icon={Globe}>OBAs da Comunidade</SectionTitle>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opaChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(215,187,125,0.08)" }}
                  contentStyle={{ background: "#071626", border: "1px solid rgba(215,187,125,0.25)", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => [Number(value), "OBAs"]}
                />
                <Bar dataKey="value" name="OBAs" radius={[4, 4, 0, 0]}>
                  {opaChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-white/35 font-mono">
            Nº total de OBAs da comunidade vs OBAs Regional, Nacional e Global.
          </p>
        </DarkPanel>

        <DarkPanel>
          <SectionTitle icon={Users}>Composição da Comunidade</SectionTitle>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composicaoChartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(215,187,125,0.08)" }}
                  contentStyle={{ background: "#071626", border: "1px solid rgba(215,187,125,0.25)", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => [Number(value), "Membros"]}
                />
                <Bar dataKey="value" name="Membros" radius={[4, 4, 0, 0]}>
                  {composicaoChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {composicaoChartData.map((item) => (
              <div key={item.name} className="rounded-xl p-3 text-center" style={{ background: "rgba(215,187,125,0.05)", border: "1px solid rgba(215,187,125,0.1)" }}>
                <p className="text-xl font-bold text-brand-gold font-mono">{item.value}</p>
                <p className="text-[9px] text-white/40 font-mono uppercase tracking-widest mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </DarkPanel>
      </div>

      {/* Membros */}
      <div
        className={`${activeCommunityTab === "visao-geral" ? "block" : "hidden"} rounded-2xl p-5 space-y-4`}
        style={{
          background: "linear-gradient(145deg, #071626, #040e1c)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-gold/60" />
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">
            Membros Associados
          </h2>
          <Badge variant="outline" className="ml-auto border-white/10 text-white/30 text-[10px] font-mono">
            {membros.length}
          </Badge>
        </div>

        {membros.length === 0 ?(
          <p className="text-xs text-white/25 font-mono italic">Nenhum membro associado</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {membros.map(m => {
              const foto = fotoUrl(m.foto_perfil);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(getMembroUrl(m))}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  data-testid={`btn-membro-${m.id}`}
                >
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-white/10"
                    style={{ background: foto ?"transparent" : "rgba(215,187,125,0.06)" }}
                  >
                    {foto
                      ?<img src={foto} alt={m.nome} className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-bold text-brand-gold/50">{getInitials(m.nome)}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white font-mono truncate">{m.nome || "—"}</p>
                    {m.cargo && <p className="text-[10px] text-white/35 font-mono truncate">{m.cargo}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* BIAs */}
      <div
        className={`${activeCommunityTab === "visao-geral" ? "block" : "hidden"} rounded-2xl p-5 space-y-4`}
        style={{
          background: "linear-gradient(145deg, #071626, #040e1c)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-brand-gold/60" />
          <h2 className="text-xs font-mono text-white/50 uppercase tracking-widest">
            BIAs Associadas
          </h2>
          <Badge variant="outline" className="ml-auto border-white/10 text-white/30 text-[10px] font-mono">
            {bias.length}
          </Badge>
        </div>

        {bias.length === 0 ?(
          <p className="text-xs text-white/25 font-mono italic">Nenhuma BIA associada</p>
        ) : (
          <div className="space-y-2">
            {bias.map(b => (
              <button
                key={b.id}
                onClick={() => navigate(getBiaUrl(b))}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-white/5 group"
                style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`btn-bia-${b.id}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(215,187,125,0.08)", border: "1px solid rgba(215,187,125,0.15)" }}
                >
                  <Briefcase className="w-3.5 h-3.5 text-brand-gold/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white font-mono truncate group-hover:text-brand-gold transition-colors">
                    {b.nome_bia || "—"}
                  </p>
                  {b.localizacao && (
                    <p className="text-[10px] text-white/35 font-mono truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {b.localizacao}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-brand-gold/20 text-white" style={{ background: "#001428" }}>
          <DialogHeader>
            <DialogTitle className="font-mono text-brand-gold text-lg">Editar Comunidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-white/50 mb-1.5 block">País</Label>
                <Input
                  value={editForm.pais}
                  onChange={(e) => setEditForm(f => ({ ...f, pais: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  data-testid="input-detail-comunidade-pais"
                />
              </div>
              <div>
                <Label className="text-xs font-mono text-white/50 mb-1.5 block">Território</Label>
                <Input
                  value={editForm.territorio}
                  onChange={(e) => setEditForm(f => ({ ...f, territorio: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-brand-gold/40"
                  data-testid="input-detail-comunidade-territorio"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Aliado BUILT</Label>
              <Select value={editForm.aliado_id || "_none"} onValueChange={(value) => setEditForm(f => ({ ...f, aliado_id: value === "_none" ? "" : value }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-detail-comunidade-aliado">
                  <SelectValue placeholder="Selecione o Aliado BUILT" />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="_none">— Nenhum —</SelectItem>
                  {membrosOrdenados.map(membro => (
                    <SelectItem key={membro.id} value={membro.id}>{membro.nome || membro.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                Membros Associados ({editForm.membros_ids.length} selecionados)
              </Label>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {membrosOrdenados.map(membro => {
                  const selected = editForm.membros_ids.includes(membro.id);
                  return (
                    <button
                      key={membro.id}
                      type="button"
                      onClick={() => toggleEditMembro(membro.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? "bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-detail-membro-${membro.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{membro.nome || membro.id}</span>
                      {membro.empresa && <span className="text-xs text-white/30 font-mono ml-auto truncate">{membro.empresa}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">
                BIAs Associadas ({editForm.bias_ids.length} selecionadas)
              </Label>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                {biasOrdenadas.map(bia => {
                  const selected = editForm.bias_ids.includes(bia.id);
                  return (
                    <button
                      key={bia.id}
                      type="button"
                      onClick={() => toggleEditBia(bia.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? "bg-brand-gold/10" : "hover:bg-white/5"}`}
                      data-testid={`btn-detail-bia-${bia.id}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-gold border-brand-gold" : "border-white/20"}`}>
                        {selected && <span className="text-brand-navy text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm text-white/80 font-mono truncate">{bia.nome_bia || bia.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-white/50 mb-1.5 block">Status</Label>
              <Select value={editForm.status || "ativa"} onValueChange={(value) => setEditForm(f => ({ ...f, status: value }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-brand-gold/40" data-testid="select-detail-comunidade-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#001428] border-white/10 text-white">
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-white/50 hover:text-white">
              Cancelar
            </Button>
            <Button
              onClick={saveEdit}
              disabled={updateMutation.isPending}
              className="font-mono"
              style={{ background: "#D7BB7D", color: "#001D34" }}
              data-testid="btn-salvar-comunidade-detalhe"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
