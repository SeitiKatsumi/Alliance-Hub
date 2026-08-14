import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, MapPin, Crosshair, Briefcase, Crown, Shield, Hammer,
  Wallet, TrendingDown, Target, Building2, Globe,
  Pencil, Layers, FileText, Users, Paperclip, ExternalLink, Loader2,
  Settings2, RotateCcw, Save, LockKeyhole
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEffect, useMemo, useState } from "react";
import { getBiaPublicRef } from "@/lib/bia-url";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BiaDocumentosPage, { type DocumentoModulo } from "./bia-documentos";
import NucleoCapitalPage from "./nucleo-capital";
import BiaDemandas from "@/components/bia-demandas";
import TraceabilitySummary from "@/components/traceability-summary";
import { BiaFormSheet } from "./bias";
import {
  EMPTY_BIA_ACCESS,
  hasBiaAccess,
  normalizeBiaAccessMatrix,
  type BiaAccessKey,
  type BiaAccessLevel,
  type BiaAccessMatrix,
} from "@shared/bia-access";

// ---- Types ----
interface AnexoFile {
  id: string;
  title?: string;
  filename?: string;
  url: string;
  size?: number;
}

interface BiasProjeto {
  id: string;
  codigo_publico?: string | null;
  nome_bia: string;
  objetivo_alianca?: string;
  observacoes?: string;
  localizacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  socios_multiplicadores?: string[] | null;
  socios_guardioes?: string[] | null;
  terceiros?: string[] | null;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_alianca?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
  custo_origem_bia?: string | number;
  custo_final_previsto?: string | number;
  valor_geral_venda_vgv?: string | number;
  valor_realizado_venda?: string | number;
  total_receita?: string | number;
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  comissao_realizada?: string | number;
  ir_realizado?: string | number;
  inss_realizado?: string | number;
  manutencao_realizada?: string | number;
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  inicio_aportes?: string | null;
  total_aportes?: string | number;
  Anexos?: AnexoFile[];
  moeda?: string | null;
}

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
  empresa?: string;
}

interface AporteEntry {
  id: string;
  descricao: string;
  valor: string | number;
  data_vencimento?: string | null;
  status?: string;
  favorecido_id?: { id: string; nome?: string; Nome_de_usuario?: string } | null;
}

interface Oportunidade {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  valor_origem_opa?: string | number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
}

interface BiaAccessParticipant {
  membro_id: string;
  nome: string;
  email?: string | null;
  avatar_url?: string | null;
  roles: string[];
  role_labels: string[];
  default_permissions: BiaAccessMatrix;
  permissions: BiaAccessMatrix;
  customized: boolean;
  updated_at?: string | null;
  updated_by_nome?: string | null;
}

interface BiaAccessResponse {
  bia_id: string;
  can_manage: boolean;
  storage_available: boolean;
  current: {
    membro_id?: string | null;
    permissions: BiaAccessMatrix;
    default_permissions: BiaAccessMatrix;
    customized: boolean;
    is_participant: boolean;
    is_bypass: boolean;
  };
  participants?: BiaAccessParticipant[];
}

// ---- Helpers ----
function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMoney(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return brl(value);
  }
}

function fieldFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function calcularResultadoLiquidoBia(bia: BiasProjeto, custoFinalOverride?: number): number {
  const hasFinancialBasis =
    fieldFilled(bia.valor_realizado_venda) ||
    fieldFilled(bia.custo_final_previsto) ||
    fieldFilled(bia.comissao_realizada) ||
    fieldFilled(bia.comissao_prevista_corretor) ||
    fieldFilled(bia.ir_realizado) ||
    fieldFilled(bia.ir_previsto) ||
    fieldFilled(bia.inss_realizado) ||
    fieldFilled(bia.inss_previsto) ||
    fieldFilled(bia.manutencao_realizada) ||
    fieldFilled(bia.manutencao_pos_obra_prevista);
  if (!hasFinancialBasis) return n(bia.resultado_liquido);

  const realizado = n(bia.valor_realizado_venda);
  const custoFinal = custoFinalOverride ?? n(bia.custo_final_previsto);
  const pct = (realizadoField: keyof BiasProjeto, previstoField: keyof BiasProjeto) =>
    n(fieldFilled(bia[realizadoField]) ? bia[realizadoField] : bia[previstoField]);
  const totalDeducoes =
    ((pct("comissao_realizada", "comissao_prevista_corretor") +
      pct("ir_realizado", "ir_previsto") +
      pct("inss_realizado", "inss_previsto") +
      pct("manutencao_realizada", "manutencao_pos_obra_prevista")) / 100) * realizado;
  return (realizado - totalDeducoes) - custoFinal;
}

function pct(v?: string | number | null): string {
  const val = n(v);
  return val > 0 ?`${val.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "—";
}

function getMembroNome(m: Membro): string {
  return m.Nome_de_usuario || m.nome_completo ||
    [m.primeiro_nome, m.sobrenome].filter(Boolean).join(" ") ||
    m.nome || "";
}

// ---- Sub-components ----
function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-brand-gold/70" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function MembroChip({ nome, role, icon: Icon }: { nome?: string; role: string; icon: any }) {
  const unassigned = !nome;
  const isAliadoBuilt = role === "Aliado BUILT";
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 relative overflow-hidden ${
      isAliadoBuilt && !unassigned
        ?"border-brand-gold/30 bg-brand-gold/[0.04]"
        : unassigned
        ?"border-border/30 bg-muted/10 opacity-60"
        : "border-border/60 bg-muted/20"
    }`}>
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${
        isAliadoBuilt && !unassigned ?"bg-brand-gold/15 border-brand-gold/30" : "bg-brand-gold/10 border-brand-gold/20"
      }`}>
        <Icon className="w-3.5 h-3.5 text-brand-gold/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">{role}</p>
        <p className={`text-xs font-medium truncate mt-0.5 ${unassigned ?"text-muted-foreground/50 italic" : ""}`}>{nome || "Não atribuído"}</p>
      </div>
      {isAliadoBuilt && !unassigned && (
        <img
          src="/built-alliance-partner.png"
          alt="Alliance Partner"
          className="shrink-0 opacity-30"
          style={{ height: 32, width: "auto" }}
        />
      )}
    </div>
  );
}

const ACCESS_GROUPS: Array<{ label: string; items: Array<{ key: BiaAccessKey; label: string }> }> = [
  {
    label: "Governança",
    items: [
      { key: "diretoria", label: "Diretoria" },
      { key: "configuracao_bia", label: "Configuração da BIA" },
    ],
  },
  {
    label: "Documentos",
    items: [
      { key: "documentos_tecnico", label: "Núcleo Técnico" },
      { key: "documentos_obra", label: "Núcleo de Obra" },
      { key: "documentos_comercial", label: "Núcleo Comercial" },
      { key: "documentos_capital", label: "Núcleo de Capital" },
    ],
  },
  {
    label: "Capital",
    items: [
      { key: "capital_banco", label: "Banco" },
      { key: "capital_financeiro", label: "Financeiro" },
      { key: "capital_analises", label: "Análises" },
      { key: "capital_calculadora", label: "Calculadora DM" },
    ],
  },
];

function BiaAccessManager({ biaId, data }: { biaId: string; data: BiaAccessResponse }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<BiaAccessParticipant | null>(null);
  const [matrix, setMatrix] = useState<BiaAccessMatrix>({ ...EMPTY_BIA_ACCESS });
  const configurableParticipants = (data.participants || [])
    .filter((participant) => participant.roles.some((role) => role !== "terceiro"));

  const openParticipant = (participant: BiaAccessParticipant) => {
    setSelected(participant);
    setMatrix(normalizeBiaAccessMatrix(participant.permissions));
  };
  const close = () => setSelected(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await apiRequest("PUT", `/api/bias/${biaId}/access-control/${selected.membro_id}`, { permissions: matrix });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId, "access-control"] });
      toast({ title: "Acessos atualizados", description: `As permissões de ${selected?.nome || "participante"} foram salvas.` });
      close();
    },
    onError: (error: Error) => toast({ title: "Erro ao salvar acessos", description: error.message, variant: "destructive" }),
  });
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await apiRequest("DELETE", `/api/bias/${biaId}/access-control/${selected.membro_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias", biaId, "access-control"] });
      toast({ title: "Padrão restaurado", description: "A personalização foi removida." });
      close();
    },
    onError: (error: Error) => toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" }),
  });

  const setView = (key: BiaAccessKey, checked: boolean) => {
    setMatrix((current) => ({ ...current, [key]: checked ? (current[key] === "edit" ? "edit" : "view") : "none" }));
  };
  const setEdit = (key: BiaAccessKey, checked: boolean) => {
    setMatrix((current) => ({ ...current, [key]: checked ? "edit" : "view" }));
  };

  return (
    <Card data-testid="bia-access-manager">
      <CardContent className="pt-5 pb-4">
        <SectionTitle icon={LockKeyhole}>Acessos da BIA</SectionTitle>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Defina o que cada participante pode visualizar ou editar nesta BIA.</p>
          {!data.storage_available && <Badge variant="destructive">Armazenamento indisponível</Badge>}
        </div>
        <div className="divide-y rounded-lg border">
          {configurableParticipants.map((participant) => (
            <div key={participant.membro_id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{participant.nome}</p>
                  {participant.customized && <Badge variant="secondary">Personalizado</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{participant.role_labels.join(" · ")}</p>
                {participant.customized && participant.updated_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Atualizado{participant.updated_by_nome ? ` por ${participant.updated_by_nome}` : ""} em {new Date(participant.updated_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => openParticipant(participant)}
                disabled={!data.storage_available}
              >
                <Settings2 className="h-4 w-4" /> Configurar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && close()}>
        <SheetContent side="right" className="flex w-full flex-col bg-background p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5 text-left">
            <SheetTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-blue-600" /> Acessos de {selected?.nome}</SheetTitle>
            <p className="text-sm text-muted-foreground">{selected?.role_labels.join(" · ")}</p>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {ACCESS_GROUPS.map((group) => (
              <section key={group.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{group.label}</h3>
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_88px_70px] border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span>Módulo</span><span className="text-center">Visualizar</span><span className="text-center">Editar</span>
                  </div>
                  {group.items.map((item) => {
                    const fixedManagerAccess = item.key === "diretoria" && Boolean(selected?.roles.some((role) => role === "aliado" || role === "diretor_alianca"));
                    const level = matrix[item.key];
                    return (
                      <div key={item.key} className="grid min-h-11 grid-cols-[minmax(0,1fr)_88px_70px] items-center border-b px-3 py-2 last:border-b-0">
                        <span className="text-sm">{item.label}</span>
                        <div className="flex justify-center"><Checkbox checked={level === "view" || level === "edit"} disabled={fixedManagerAccess} onCheckedChange={(checked) => setView(item.key, checked === true)} /></div>
                        <div className="flex justify-center"><Checkbox checked={level === "edit"} disabled={fixedManagerAccess} onCheckedChange={(checked) => setEdit(item.key, checked === true)} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" className="gap-2" onClick={() => resetMutation.mutate()} disabled={!selected?.customized || resetMutation.isPending || saveMutation.isPending}>
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              <Button type="button" className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || resetMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar acessos
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function OpaCard({ opa, currency = "BRL" }: { opa: Oportunidade; currency?: string }) {
  const valor = n(opa.valor_origem_opa);
  return (
    <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/[0.03] p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-brand-gold/50 text-[10px]">◆</span>
            {opa.tipo && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{opa.tipo}</Badge>}
          </div>
          <p className="text-sm font-semibold">{opa.nome_oportunidade || "OBA sem nome"}</p>
        </div>
        {valor > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[9px] text-muted-foreground uppercase">Valor</p>
            <p className="text-sm font-bold text-brand-gold tabular-nums">{formatMoney(valor, currency)}</p>
          </div>
        )}
      </div>

      {opa.objetivo_alianca && (
        <p className="text-xs text-muted-foreground line-clamp-2">{opa.objetivo_alianca}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {opa.nucleo_alianca && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
            <Building2 className="w-2.5 h-2.5" />{opa.nucleo_alianca}
          </Badge>
        )}
        {opa.pais && (
          <Badge variant="outline" className="text-[10px] h-5 gap-1 font-normal">
            <Globe className="w-2.5 h-2.5" />{opa.pais}
          </Badge>
        )}
      </div>

      {opa.perfil_aliado && (
        <p className="text-[11px] text-muted-foreground/70 border-t border-border/40 pt-2">{opa.perfil_aliado}</p>
      )}
      {opa.descricao && (
        <p className="text-[11px] text-muted-foreground/60 line-clamp-2">{opa.descricao}</p>
      )}
    </div>
  );
}

function isMembroLinkedToBia(bia: BiasProjeto, membroId?: string | null): boolean {
  if (!membroId) return false;
  const directRoles = [
    bia.autor_bia,
    bia.aliado_built,
    bia.diretor_alianca,
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ];
  const listRoles = [
    ...(bia.socios_multiplicadores || []),
    ...(bia.socios_guardioes || []),
    ...(bia.terceiros || []),
  ];
  return [...directRoles, ...listRoles].some((id) => id === membroId);
}

const DOCUMENT_MODULE_VALUES = new Set<DocumentoModulo>(["tecnico", "obra", "comercial", "capital"]);

function documentModuleFromSearch(search: string): DocumentoModulo | undefined {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const requestedModule = params.get("nucleo");
  if (requestedModule && DOCUMENT_MODULE_VALUES.has(requestedModule as DocumentoModulo)) {
    return requestedModule as DocumentoModulo;
  }
  if (tab && DOCUMENT_MODULE_VALUES.has(tab as DocumentoModulo) && tab !== "capital") {
    return tab as DocumentoModulo;
  }
  if (tab === "capital" && params.get("capital") === "documentos") return "capital";
  return undefined;
}

function normalizeDetailTab(search: string) {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") || "visao";
  return documentModuleFromSearch(search) ? "documentos" : tab;
}

// ---- Main page ----
export default function BiaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeDetailTab, setActiveDetailTab] = useState(() => normalizeDetailTab(window.location.search));
  const [editOpen, setEditOpen] = useState(false);

  const { data: bia, isLoading: loadingBia } = useQuery<BiasProjeto>({
    queryKey: ["/api/bias", id],
    queryFn: () => fetch(`/api/bias/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: accessData, isLoading: loadingAccess } = useQuery<BiaAccessResponse>({
    queryKey: ["/api/bias", bia?.id, "access-control"],
    queryFn: async () => {
      const response = await fetch(`/api/bias/${bia!.id}/access-control`, { credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Não foi possível carregar os acessos da BIA." }));
        throw new Error(error.error || "Não foi possível carregar os acessos da BIA.");
      }
      return response.json();
    },
    enabled: Boolean(bia?.id),
    retry: false,
    refetchInterval: 30_000,
  });
  const accessMatrix = accessData?.current.permissions || EMPTY_BIA_ACCESS;

  const { data: membrosRaw = [] } = useQuery<Membro[]>({ queryKey: ["/api/membros"] });
  const { data: opasRaw = [] } = useQuery<Oportunidade[]>({ queryKey: ["/api/oportunidades"] });
  const { data: aportesRaw = [] } = useQuery<AporteEntry[]>({
    queryKey: ["/api/bias", bia?.id, "aportes"],
    queryFn: () => fetch(`/api/bias/${bia!.id}/aportes`).then(r => r.json()),
    enabled: Boolean(bia?.id && hasBiaAccess(accessMatrix, "capital_financeiro", "view")),
  });

  const gerarMouMutation = useMutation({
    mutationFn: async () => {
      if (!bia?.id) throw new Error("BIA nao encontrada.");
      const res = await apiRequest("POST", `/api/bias/${bia.id}/gerar-mou-padrao`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nucleo-tecnico-docs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alianca-docs", "tecnico"] });
      toast({
        title: "MOU Padrao gerado",
        description: data?.warning || "O documento foi salvo em Juridicas da BIA.",
        variant: data?.warning ? "destructive" : undefined,
      });
      const url = data?.arquivo?.url || data?.item?.arquivos?.[0]?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => {
      const message = String(e?.message || "");
      if (message.includes("401") || message.toLowerCase().includes("nao autenticado") || message.toLowerCase().includes("não autenticado")) {
        toast({
          title: "Sessao expirada",
          description: "Entre novamente para gerar o MOU Padrao.",
          variant: "destructive",
        });
        window.location.href = "/login";
        return;
      }
      toast({ title: "Erro ao gerar MOU", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const publicRef = getBiaPublicRef(bia);
    if (id && publicRef && publicRef !== id) {
      navigate(`/bias/${publicRef}${window.location.search || ""}`, { replace: true });
    }
  }, [bia, id, navigate]);

  useEffect(() => {
    const rawParams = new URLSearchParams(window.location.search);
    const rawTab = rawParams.get("tab") || "visao";
    const legacyModule = documentModuleFromSearch(window.location.search);
    const tab = normalizeDetailTab(window.location.search);
    if (legacyModule && rawTab !== "documentos") {
      rawParams.set("tab", "documentos");
      rawParams.set("nucleo", legacyModule);
      rawParams.delete("capital");
      navigate(`${window.location.pathname}?${rawParams.toString()}`, { replace: true });
      return;
    }
    if (tab !== activeDetailTab) setActiveDetailTab(tab);
  }, [activeDetailTab, location, navigate]);

  const membros = useMemo(() => {
    const m: Record<string, string> = {};
    (membrosRaw as Membro[]).forEach(mb => { m[mb.id] = getMembroNome(mb); });
    return m;
  }, [membrosRaw]);

  const opas = useMemo(
    () => (opasRaw as Oportunidade[]).filter(o => o.bia_id === bia?.id),
    [opasRaw, bia?.id]
  );

  const equipe = useMemo(() => {
    if (!bia) return [];
    return [
      { id: bia.autor_bia, role: "Autor da Oportunidade", icon: Target },
      { id: bia.aliado_built, role: "Aliado BUILT", icon: Shield },
      { id: bia.diretor_alianca, role: "Diretor de Aliança", icon: Crown },
      { id: bia.diretor_nucleo_tecnico, role: "Diretor de Núcleo Técnico", icon: Shield },
      { id: bia.diretor_execucao, role: "Dir. Núcleo de Obra", icon: Hammer },
      { id: bia.diretor_comercial, role: "Dir. Núcleo Comercial", icon: Briefcase },
      { id: bia.diretor_capital, role: "Dir. Núcleo de Capital", icon: Wallet },
    ];
  }, [bia]);

  const dmSummary = useMemo(() => {
    const valorOrigem = n(bia?.valor_origem);
    const rows = [
      { label: "Autor da Oportunidade", perc: n(bia?.perc_autor_opa) },
      { label: "Dir. Aliança", perc: n(bia?.perc_dir_alianca) },
      { label: "Dir. Núcleo Técnico", perc: n(bia?.perc_dir_tecnico) },
      { label: "Dir. Núcleo de Obra", perc: n(bia?.perc_dir_obras) },
      { label: "Dir. Núcleo Comercial", perc: n(bia?.perc_dir_comercial) },
      { label: "Dir. Núcleo de Capital", perc: n(bia?.perc_dir_capital) },
      { label: "Aliado BUILT", perc: n(bia?.perc_aliado_built) },
      { label: "BUILT", perc: n(bia?.perc_built) },
    ].map((row) => ({ ...row, cpp: valorOrigem * row.perc / 100 }));
    const divisor = rows.reduce((total, row) => total + row.perc, 0);
    const cppTotal = rows.reduce((total, row) => total + row.cpp, 0);
    return {
      rows,
      divisor,
      cppTotal,
      custoOrigem: valorOrigem + cppTotal,
    };
  }, [bia]);
  const cpp = dmSummary.rows;

  const documentAccess: Record<DocumentoModulo, BiaAccessLevel> = {
    tecnico: accessMatrix.documentos_tecnico,
    obra: accessMatrix.documentos_obra,
    comercial: accessMatrix.documentos_comercial,
    capital: accessMatrix.documentos_capital,
  };
  const allowedDocumentModules = useMemo<DocumentoModulo[]>(() => {
    return (Object.keys(documentAccess) as DocumentoModulo[])
      .filter((module) => documentAccess[module] === "view" || documentAccess[module] === "edit");
  }, [accessMatrix]);
  const capitalAccess = {
    banco: accessMatrix.capital_banco,
    financeiro: accessMatrix.capital_financeiro,
    analises: accessMatrix.capital_analises,
    calculadora: accessMatrix.capital_calculadora,
  };
  const hasCapitalAccess = Object.values(capitalAccess).some((level) => level === "view" || level === "edit");
  const allowedNucleoTabs = useMemo(() => {
    if (!bia) return [];
    return [
      {
        value: "demandas",
        label: "Demandas",
        testId: "tab-bia-demandas",
        allowed: hasBiaAccess(accessMatrix, "configuracao_bia", "view"),
      },
      {
        value: "diretoria",
        label: "Diretoria",
        testId: "tab-bia-nucleo-diretoria",
        allowed: hasBiaAccess(accessMatrix, "diretoria", "view"),
      },
      {
        value: "documentos",
        label: "Documentos",
        testId: "tab-bia-documentos",
        allowed: allowedDocumentModules.length > 0,
      },
      {
        value: "capital",
        label: "Núcleo de Capital",
        testId: "tab-bia-nucleo-capital",
        allowed: hasCapitalAccess,
      },
    ].filter((tab) => tab.allowed);
  }, [accessMatrix, allowedDocumentModules, bia, hasCapitalAccess]);
  const canAccessNucleos = allowedNucleoTabs.length > 0;
  const updateDetailTab = (value: string) => {
    setActiveDetailTab(value);
    const params = new URLSearchParams(window.location.search);
    if (value === "visao") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    if (value !== "capital") params.delete("capital");
    if (value !== "documentos") params.delete("nucleo");
    const query = params.toString();
    navigate(`${window.location.pathname}${query ? `?${query}` : ""}`, { replace: true });
  };
  const updateCapitalTab = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "capital");
    params.set("capital", value);
    navigate(`${window.location.pathname}?${params.toString()}`, { replace: true });
  };
  useEffect(() => {
    if (!bia) return;
    if (activeDetailTab !== "visao" && !allowedNucleoTabs.some((tab) => tab.value === activeDetailTab)) {
      toast({ title: "Acesso atualizado", description: "Você não possui mais acesso a esta área da BIA." });
      updateDetailTab("visao");
    }
  }, [activeDetailTab, allowedNucleoTabs, bia]);

  if (loadingBia || (bia && loadingAccess)) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  if (!bia) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">BIA não encontrada.</p>
        <Button variant="link" onClick={() => navigate("/area-aliancas?tab=bias")}>Voltar</Button>
      </div>
    );
  }

  const vgv = n(bia.valor_geral_venda_vgv);
  const realizado = n(bia.valor_realizado_venda);
  const resultado = calcularResultadoLiquidoBia(bia, dmSummary.cppTotal);
  const lucro = n(bia.lucro_previsto);
  const custoFinal = dmSummary.cppTotal;
  const totalAportes = n(bia.total_aportes);
  const canEditBia = hasBiaAccess(accessMatrix, "configuracao_bia", "edit");
  const canViewBiaConfiguration = hasBiaAccess(accessMatrix, "configuracao_bia", "view");

  const aporteFMEntries = Array.isArray(aportesRaw)
    ? aportesRaw as AporteEntry[]
    : Array.isArray((aportesRaw as any)?.data)
      ? (aportesRaw as any).data as AporteEntry[]
      : Array.isArray((aportesRaw as any)?.items)
        ? (aportesRaw as any).items as AporteEntry[]
        : [];
  const totalAporteFM = aporteFMEntries.reduce((sum, e) => sum + n(e.valor), 0);
  const nucleoCards = [
    {
      id: "diretoria",
      title: "Diretoria da Aliança",
      description: "Governança, papéis estratégicos e coordenação da BIA.",
      icon: Crown,
      roles: equipe.filter((e) => ["Autor da Oportunidade", "Aliado BUILT", "Diretor de Aliança"].includes(e.role)),
    },
    {
      id: "tecnico",
      title: "Núcleo Técnico",
      description: "Responsável por documentação técnica, padrões e validações.",
      icon: Shield,
      roles: equipe.filter((e) => e.role === "Diretor de Núcleo Técnico"),
      opas: opas.filter((o) => (o.nucleo_alianca || "").toLowerCase().includes("técnico") || (o.nucleo_alianca || "").toLowerCase().includes("tecnico")),
    },
    {
      id: "obra",
      title: "Núcleo de Obra",
      description: "Execução, cronograma operacional e entregas de campo.",
      icon: Hammer,
      roles: equipe.filter((e) => e.role === "Dir. Núcleo de Obra"),
      opas: opas.filter((o) => (o.nucleo_alianca || "").toLowerCase().includes("obra")),
    },
    {
      id: "comercial",
      title: "Núcleo Comercial",
      description: "Relacionamento comercial, captação e movimentação de oportunidades.",
      icon: Briefcase,
      roles: equipe.filter((e) => e.role === "Dir. Núcleo Comercial"),
      opas: opas.filter((o) => (o.nucleo_alianca || "").toLowerCase().includes("comercial")),
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/area-aliancas?tab=bias")}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          data-testid="btn-back-bias"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para BIAs
        </Button>
        {canViewBiaConfiguration && (
          <Button
            size="sm"
            className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
            onClick={() => setEditOpen(true)}
            data-testid="btn-edit-bia-detail"
          >
            <Pencil className="w-3.5 h-3.5" />
            {canEditBia ? "Editar" : "Visualizar"}
          </Button>
        )}
      </div>

      <Tabs value={activeDetailTab} onValueChange={updateDetailTab} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="visao" className="min-h-9 flex-1 basis-[120px]" data-testid="tab-bia-visao">Visão geral</TabsTrigger>
          {allowedNucleoTabs.map((nucleoTab) => (
            <TabsTrigger
              key={nucleoTab.value}
              value={nucleoTab.value}
              className="min-h-9 flex-1 basis-[120px]"
              data-testid={nucleoTab.testId}
            >
              {nucleoTab.label}
            </TabsTrigger>
          ))}
        </TabsList>

      {/* Hero header */}
      <div
        className="relative rounded-2xl border border-brand-gold/20 p-6 overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 0% 50%, #001d34 0%, #000c1f 60%, #000408 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-gold/40 rounded-tl-2xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-gold/40 rounded-tr-2xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-gold/40 rounded-bl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-gold/40 rounded-br-2xl" />

        <div className="relative z-10">
          <p className="text-[10px] text-cyan-300/60 tracking-[0.35em] uppercase font-mono mb-1">// BUILT Alliances · BIA</p>
          <h1 className="text-2xl font-bold text-cyan-300 font-mono tracking-wide">{bia.nome_bia}</h1>
          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-mono text-cyan-100/80">
            <span className="uppercase tracking-[0.22em] text-cyan-300/55">Código da BIA</span>
            <span className="truncate text-cyan-100">{getBiaPublicRef(bia).toUpperCase()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {bia.localizacao && (
              <p className="text-sm text-cyan-300/70 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{bia.localizacao}
              </p>
            )}
            {bia.latitude && bia.longitude && (
              <p className="text-xs text-cyan-300/45 font-mono flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                {n(bia.latitude).toFixed(5)}, {n(bia.longitude).toFixed(5)}
              </p>
            )}
            {opas.length > 0 && (
              <Badge className="gap-1 bg-cyan-400/15 text-cyan-200 border-cyan-300/25 hover:bg-cyan-400/20">
                <Target className="w-3 h-3" />
                {opas.length} OBA{opas.length !== 1 ?"s" : ""}
              </Badge>
            )}
          </div>

          {bia.objetivo_alianca && (
            <p className="text-sm text-cyan-300/65 mt-3 leading-relaxed max-w-3xl">{bia.objetivo_alianca}</p>
          )}
        </div>
      </div>

        <TabsContent value="visao" className="space-y-6">
          <TraceabilitySummary objectType="bia" objectId={bia.id} />
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Equipe */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <SectionTitle icon={Users}>Diretoria</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {equipe.map((e, i) => (
                  <MembroChip
                    key={i}
                    nome={e.id ?membros[e.id] : undefined}
                    role={e.role}
                    icon={e.icon}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* OBAs relacionadas */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <SectionTitle icon={Target}>
                OBAs Relacionadas
                {opas.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{opas.length}</Badge>
                )}
              </SectionTitle>
              {opas.length === 0 ?(
                <div className="text-center py-8 text-muted-foreground/50">
                  <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma OBA vinculada a esta BIA</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate("/area-aliancas?tab=opas")}
                    className="mt-1 text-brand-gold/60"
                  >
                    Criar OBA →
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {opas.map(opa => <OpaCard key={opa.id} opa={opa} currency={bia.moeda || "BRL"} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Descrição */}
          {bia.observacoes && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={FileText}>Descrição</SectionTitle>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{bia.observacoes}</p>
              </CardContent>
            </Card>
          )}

          {/* Anexos */}
          {bia.Anexos && bia.Anexos.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Paperclip}>
                  Anexos
                  <Badge variant="secondary" className="ml-2 text-xs">{bia.Anexos.length}</Badge>
                </SectionTitle>
                <div className="space-y-2">
                  {bia.Anexos.map(anexo => (
                    <a
                      key={anexo.id}
                      href={anexo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 px-3 py-2.5 transition-colors group"
                      data-testid={`link-anexo-${anexo.id}`}
                    >
                      <FileText className="w-4 h-4 text-brand-gold/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{anexo.title || anexo.filename || anexo.id}</p>
                        {anexo.size && (
                          <p className="text-[11px] text-muted-foreground">{(anexo.size / 1024).toFixed(0)} KB</p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* CPP — DM */}
          {cpp.length > 0 && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={Layers}>CPP — DM</SectionTitle>
                <div className="space-y-2.5">
                  {cpp.map((row, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-brand-gold/80">{pct(row.perc)}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{formatMoney(row.cpp, bia.moeda || "BRL")}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="space-y-1.5 text-sm">
                  {n(bia.valor_origem) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Origem</span>
                      <span className="font-medium tabular-nums">{formatMoney(n(bia.valor_origem), bia.moeda || "BRL")}</span>
                    </div>
                  )}
                  {n(bia.valor_origem) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo Origem</span>
                      <span className="font-medium tabular-nums">{formatMoney(dmSummary.custoOrigem, bia.moeda || "BRL")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Divisor/Multiplicador</span>
                    <span className="font-medium tabular-nums">{dmSummary.divisor}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deduções */}
          {(n(bia.comissao_prevista_corretor) > 0 || n(bia.ir_previsto) > 0 || n(bia.inss_previsto) > 0 || n(bia.manutencao_pos_obra_prevista) > 0) && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <SectionTitle icon={TrendingDown}>Deduções</SectionTitle>
                <div className="space-y-2.5 text-sm">
                  {n(bia.comissao_prevista_corretor) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comissão Corretor</span>
                      <span className="font-semibold text-brand-gold/80">{pct(bia.comissao_prevista_corretor)}</span>
                    </div>
                  )}
                  {n(bia.ir_previsto) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IR</span>
                      <span className="font-semibold text-brand-gold/80">{pct(bia.ir_previsto)}</span>
                    </div>
                  )}
                  {n(bia.inss_previsto) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">INSS</span>
                      <span className="font-semibold text-brand-gold/80">{pct(bia.inss_previsto)}</span>
                    </div>
                  )}
                  {n(bia.manutencao_pos_obra_prevista) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Manutenção Pós-Obra</span>
                      <span className="font-semibold text-brand-gold/80">{pct(bia.manutencao_pos_obra_prevista)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
        </TabsContent>

        {canAccessNucleos && (
          <>
              {allowedNucleoTabs.some((tab) => tab.value === "diretoria") && (
              <TabsContent value="diretoria" className="space-y-4">
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <SectionTitle icon={Crown}>Diretoria da Aliança</SectionTitle>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Governança, papéis estratégicos e coordenação da BIA.
                    </p>
                    {canEditBia && <div className="mb-4 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => gerarMouMutation.mutate()}
                        disabled={gerarMouMutation.isPending}
                        className="h-9 shrink-0 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        data-testid="btn-gerar-mou-padrao-diretoria"
                      >
                        {gerarMouMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        {gerarMouMutation.isPending ? "Gerando..." : "Gerar MOU Padrão"}
                      </Button>
                    </div>}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {equipe.map((e, i) => (
                        <MembroChip
                          key={i}
                          nome={e.id ?membros[e.id] : undefined}
                          role={e.role}
                          icon={e.icon}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {accessData?.can_manage && <BiaAccessManager biaId={bia.id} data={accessData} />}
              </TabsContent>
              )}

              {allowedNucleoTabs.some((tab) => tab.value === "demandas") && (
              <TabsContent value="demandas" className="space-y-4">
                <BiaDemandas biaId={bia.id} canEdit={hasBiaAccess(accessMatrix, "configuracao_bia", "edit")} />
              </TabsContent>
              )}

              {allowedNucleoTabs.some((tab) => tab.value === "documentos") && (
              <TabsContent value="documentos" className="space-y-4">
                <BiaDocumentosPage
                  biaId={bia.id}
                  allowedModules={allowedDocumentModules}
                  moduleAccess={documentAccess}
                  initialModule={documentModuleFromSearch(window.location.search)}
                />
              </TabsContent>
              )}

              {allowedNucleoTabs.some((tab) => tab.value === "capital") && (
              <TabsContent value="capital" className="space-y-4">
                <NucleoCapitalPage
                  initialBiaId={bia.id}
                  embedded
                  activeTab={new URLSearchParams(window.location.search).get("capital") || undefined}
                  onTabChange={updateCapitalTab}
                  access={capitalAccess}
                />
              </TabsContent>
              )}

            <div className="hidden grid gap-4 md:grid-cols-2">
              {nucleoCards.map((nucleo) => {
                const Icon = nucleo.icon;
                const relatedOpas = "opas" in nucleo ?nucleo.opas || [] : [];
                return (
                  <Card key={nucleo.id} className="border-border/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4 text-blue-600" />
                        {nucleo.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{nucleo.description}</p>
                      <div className="space-y-2">
                        {nucleo.roles.map((role, index) => (
                          <MembroChip
                            key={`${nucleo.id}-${index}`}
                            nome={role.id ?membros[role.id] : undefined}
                            role={role.role}
                            icon={role.icon}
                          />
                        ))}
                      </div>
                      {"opas" in nucleo && (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">OBAs deste núcleo</p>
                          <p className="mt-1 text-xl font-semibold text-foreground">{relatedOpas.length}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="hidden border-blue-500/20" data-testid="card-bia-nucleo-capital">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  Núcleo de Capital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="financeiro" className="space-y-4">
                  <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-muted/60 p-1 sm:grid-cols-3">
                    <TabsTrigger value="financeiro" data-testid="tab-bia-financeiro">Financeiro</TabsTrigger>
                    <TabsTrigger value="analises" data-testid="tab-bia-analises">Análises</TabsTrigger>
                    <TabsTrigger value="calculadora" data-testid="tab-bia-calculadora">Calculadora DM</TabsTrigger>
                  </TabsList>

                  <TabsContent value="financeiro" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatBox label="Total de aportes" value={formatMoney(totalAportes, bia.moeda || "BRL")} />
                      <StatBox label="Aportes DM" value={formatMoney(totalAporteFM, bia.moeda || "BRL")} />
                      <StatBox label="Registros financeiros" value={String(aporteFMEntries.length)} />
                    </div>
                    <div className="space-y-2">
                      {aporteFMEntries.length === 0 ?(
                        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Nenhum aporte registrado para esta BIA.
                        </p>
                      ) : (
                        aporteFMEntries.map((entry) => (
                          <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">{entry.descricao}</p>
                              {entry.data_vencimento && (
                                <p className="text-xs text-muted-foreground">
                                  {new Date(entry.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-semibold tabular-nums">{formatMoney(n(entry.valor), bia.moeda || "BRL")}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="analises" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatBox label="VGV" value={formatMoney(vgv, bia.moeda || "BRL")} />
                    <StatBox label="Custo final previsto" value={formatMoney(custoFinal, bia.moeda || "BRL")} />
                    <StatBox label="Resultado líquido" value={formatMoney(resultado, bia.moeda || "BRL")} color={resultado >= 0 ?"text-green-600" : "text-red-600"} />
                    <StatBox label="Lucro previsto" value={formatMoney(lucro, bia.moeda || "BRL")} />
                  </TabsContent>

                  <TabsContent value="calculadora" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatBox label="Valor origem" value={formatMoney(n(bia.valor_origem), bia.moeda || "BRL")} />
                      <StatBox label="Custo origem" value={formatMoney(dmSummary.custoOrigem, bia.moeda || "BRL")} />
                      <StatBox label="Divisor / multiplicador" value={String(dmSummary.divisor)} />
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <SectionTitle icon={Layers}>Distribuição CPP</SectionTitle>
                      {cpp.length === 0 ?(
                        <p className="text-sm text-muted-foreground">Nenhuma distribuição CPP configurada para esta BIA.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {cpp.map((row) => (
                            <div key={row.label} className="flex items-center justify-between rounded-md bg-background px-3 py-2">
                              <span className="text-sm text-muted-foreground">{row.label}</span>
                              <span className="text-sm font-semibold">{pct(row.perc)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </Tabs>
      <BiaFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        bia={bia}
        membros={membrosRaw as any}
        isLoading={loadingBia}
        readOnly={!canEditBia}
      />
    </div>
  );
}
