import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { InviteQrCode } from "@/components/invite-qr-code";
import { CompanyAccessPanel } from "@/components/company-access-panel";
import { EnvironmentAccessDialog, environmentAccessFor, type EnvironmentTarget } from "@/components/environment-access";
import { ModuleInfo } from "@/components/module-info";
import { isBuiltMemberForAura } from "@/lib/aura-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Briefcase, Globe, Users, TrendingUp, TrendingDown,
  MapPin, LayoutDashboard, Building2,
  Target, Wallet, ChevronRight, Sparkles, Search, SlidersHorizontal,
  Ticket, Copy, RefreshCw, Loader2, Quote, ArrowRight, Gem, Plus, Megaphone,
  AlertTriangle, Clock, FileWarning, AlarmClock, BookOpen, UserCheck,
  Crosshair, Landmark, ClipboardCheck, EyeOff, Lightbulb, BriefcaseBusiness,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AuraScore, getFaixaColor } from "@/components/aura-score";
import { copyTextToClipboard } from "@/lib/clipboard";
import { DASHBOARD_DAILY_QUOTES } from "@/lib/dashboard-quotes";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
import { getBiaPublicRef, getBiaUrl } from "@/lib/bia-url";
import { getOpaUrl } from "@/lib/public-refs";
import { getProfileCompletion, type ProfileCompletionSource } from "@/lib/profile-completion";
import {
  dashboardNavigationUrl,
  resolveDashboardNavigation,
  type BusinessSection,
  type CarteiraView,
  type DashboardTab,
} from "@/lib/dashboard-navigation";
import { CarteiraDashboardPanel } from "@/pages/carteira";
import MemberBusinessFeed from "@/components/member-business-feed";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardBia {
  id: string;
  codigo_publico?: string | null;
  nome_bia: string;
  situacao?: "ativa" | "em_formacao" | null;
  objetivo_alianca?: string | null;
  destinacao?: string | null;
  localizacao?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  observacoes?: string | null;
  imagem_directus_id?: string | null;
  valor_origem?: number | string | null;
  valor_geral_venda_vgv?: number | string | null;
  valor_realizado_venda?: number | string | null;
  custo_final_previsto?: number | string | null;
  resultado_liquido?: number | string | null;
  cpp_autor_opa?: number | string | null;
  cpp_aliado_built?: number | string | null;
  cpp_built?: number | string | null;
  cpp_dir_alianca?: number | string | null;
  cpp_dir_tecnico?: number | string | null;
  cpp_dir_obras?: number | string | null;
  cpp_dir_comercial?: number | string | null;
  cpp_dir_capital?: number | string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  investimento_usuario_valor?: number | string | null;
  investimento_usuario_percentual?: number | string | null;
  receita_usuario_valor?: number | string | null;
  moeda?: string | null;
  papel_usuario?: string;
}

interface DashboardComunidade {
  id: string;
  nome?: string;
  sigla?: string;
  pais?: string;
  territorio?: string;
  sigla_territorio?: string;
  membros?: any[];
  bias?: any[];
}

interface AgendaTarefa {
  id: string;
  titulo: string;
  descricao?: string | null;
  data: string;
  hora?: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  prioridade?: "baixa" | "media" | "alta" | null;
}

const PRIORIDADE_LABEL: Record<NonNullable<AgendaTarefa["prioridade"]>, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const PRIORIDADE_CLASS: Record<NonNullable<AgendaTarefa["prioridade"]>, string> = {
  baixa: "border-slate-200 bg-slate-50 text-slate-600",
  media: "border-blue-200 bg-blue-50 text-blue-700",
  alta: "border-red-200 bg-red-50 text-red-700",
};

interface DashboardApproval {
  id: string | number;
  status?: string | null;
  tipo?: string | null;
  candidato_nome?: string | null;
  candidato_email?: string | null;
  comunidade_nome?: string | null;
}

interface DiretorSolicitacao {
  id: string;
  bia_id: string;
  bia_nome?: string | null;
  papel: string;
  percentual?: string | number | null;
  status?: string | null;
}

interface SocioSolicitacao {
  id: string;
  bia_id: string;
  bia_nome?: string | null;
  papel: string;
  status?: string | null;
}

interface ChamadaAlianca {
  id: string;
  bia_id: string;
  bia_nome?: string | null;
  titulo: string;
  escopo: string;
  data_hora: string;
  nucleo_alianca?: string | null;
}

interface CarteiraDashboardAlert {
  id: string;
  imovel_id: string;
  imovel_nome: string;
  imovel_cidade?: string | null;
  imovel_estado?: string | null;
  titulo: string;
  descricao?: string | null;
  acao_sugerida?: string | null;
  acao_registrada?: string | null;
  severidade: string;
  status: string;
  can_act: boolean;
}

interface DashboardOpa {
  id: string;
  codigo?: string | null;
  opportunity_kind?: "demanda" | "oba";
  selo?: "Demanda" | "OBA";
  nome_oportunidade?: string;
  tipo?: string;
  ramo_atuacao?: string | null;
  bia_id?: string;
  nome_bia_vinculada?: string | null;
  valor_origem_opa?: number | string | null;
  status?: string;
  nucleo_alianca?: string | null;
  perfil_aliado?: string | null;
  Minimo_esforco_multiplicador?: number | string | null;
  date_created?: string | null;
}

interface DashboardData {
  bias: DashboardBia[];
  comunidades: DashboardComunidade[];
  opas: DashboardOpa[];
  convergencias?: DashboardOpa[];
  dashboard_stats?: {
    convergencias_total: number;
    opas_total_periodo: number;
    interesses_manifestados: number;
    indice_convergencia: number;
    taxa_interesse: number;
    opas_comunidade_total: number;
    opas_por_abrangencia: Array<{ name: string; value: number }>;
  };
  totals: {
    valor_origem: number;
    custo_final_previsto: number;
    resultado_liquido: number;
  };
  opas_abertas: number;
}

function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function fmt(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

function situacaoBadge(s?: string | null) {
  if (s === "ativa")
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Ativa</Badge>;
  if (s === "em_formacao") {
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">Em Formação</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">-</Badge>;
}

function fmtPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value > 0 && value < 1 ?2 : 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function normalizeText(value?: string | number | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const CHART_COLORS = ["#0B4EA2", "#0B63F6", "#12B981", "#38BDF8", "#22C55E", "#1E40AF", "#64748B"];
const INVITE_APP_URL = "https://app.builtalliances.com";
const ASSET_CACHE_VERSION = "directus-db-20260616";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_ENV_IMAGES = Array.from({ length: 10 }, (_, index) => `/dashboard-env/built-env-${String(index + 1).padStart(2, "0")}.png`);

function normalizeInviteLink(link?: string | null) {
  if (!link) return "";
  if (/^https?:\/\/built\.dna11\.com\.br/i.test(link)) {
    return link.replace(/^https?:\/\/built\.dna11\.com\.br/i, INVITE_APP_URL);
  }
  if (/^https?:\/\/app\.builtalliances\.com\.br/i.test(link)) {
    return link.replace(/^https?:\/\/app\.builtalliances\.com\.br/i, INVITE_APP_URL);
  }
  if (/^https?:\/\//i.test(link)) return link;
  return `${INVITE_APP_URL}${link.startsWith("/") ?"" : "/"}${link}`;
}

function directusAssetId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.id || value.uuid || value.directus_files_id || value.file || null;
  return String(value);
}

function versionAssetUrl(value?: any): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.includes("/api/assets/")) {
    return `${value}${value.includes("?") ? "&" : "?"}v=${ASSET_CACHE_VERSION}`;
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  const assetId = directusAssetId(value);
  return assetId ? `/api/assets/${assetId}?v=${ASSET_CACHE_VERSION}` : null;
}

function compactLabel(value?: string | null): string {
  return String(value || "Não definido").trim() || "Não definido";
}

function getDailyQuoteIndex(date = new Date()) {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.abs(Math.floor(localMidnight / DAY_IN_MS)) % DASHBOARD_DAILY_QUOTES.length;
}

function getDailyEnvironmentImages(date = new Date()) {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayIndex = Math.abs(Math.floor(localMidnight / DAY_IN_MS));
  const start = dayIndex % DASHBOARD_ENV_IMAGES.length;
  return [0, 3, 6].map((offset) => DASHBOARD_ENV_IMAGES[(start + offset) % DASHBOARD_ENV_IMAGES.length]);
}

function canonicalChartLabel(value?: string | null): { key: string; label: string } {
  const label = compactLabel(value);
  const key = normalizeText(label).replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = {
    operacao: "Operação",
    venda: "Venda",
    vendas: "Vendas",
    renda: "Renda",
    residencial: "Residencial",
    hospedagem: "Hospedagem",
    industrial: "Industrial",
    rural: "Rural",
    "nao definido": "Não definido",
  };
  return { key: key || "nao definido", label: aliases[key] || label };
}

function groupCurrencyBy(items: DashboardBia[], key: keyof DashboardBia) {
  const grouped = new Map<string, { name: string; value: number }>();
  items.forEach((item) => {
    const { key: groupKey, label } = canonicalChartLabel(item[key] as string | null);
    const current = grouped.get(groupKey);
    grouped.set(groupKey, { name: current?.name || label, value: (current?.value || 0) + n(item.investimento_usuario_valor) });
  });
  const rows = Array.from(grouped.values());
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return rows
    .map(({ name, value }) => ({ name, value, percent: total > 0 ?(value / total) * 100 : 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function DashboardBiaCard({ bia }: { bia: DashboardBia }) {
  const [, navigate] = useLocation();
  const vgv = n(bia.valor_geral_venda_vgv ?? bia.valor_origem);
  const valorRealizado = n(bia.valor_realizado_venda);
  const progresso = vgv > 0
    ? Math.max(0, Math.min(100, Math.round((valorRealizado / vgv) * 100)))
    : bia.situacao === "ativa" ? 35 : 15;
  const situacaoLabel = bia.situacao === "em_formacao" ? "Em estruturação" : "Ativa";
  const situacaoClass = bia.situacao === "em_formacao"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
  const imageUrl = versionAssetUrl(bia.imagem_directus_id);
  const cppCount = [
    bia.cpp_autor_opa,
    bia.cpp_aliado_built,
    bia.cpp_built,
    bia.cpp_dir_alianca,
    bia.cpp_dir_tecnico,
    bia.cpp_dir_obras,
    bia.cpp_dir_comercial,
    bia.cpp_dir_capital,
  ].filter(value => n(value) > 0).length;
  const nucleosAtivos = [
    bia.diretor_nucleo_tecnico,
    bia.diretor_execucao,
    bia.diretor_comercial,
    bia.diretor_capital,
  ].filter(Boolean).length;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/70 bg-card shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`dashboard-card-bia-${bia.id}`}
      onClick={() => navigate(getBiaUrl(bia))}
    >
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 lg:h-[96px] lg:w-[142px]">
            {imageUrl ? (
              <img src={imageUrl} alt={bia.nome_bia} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(37,99,235,0.18),rgba(241,245,249,0.95))] text-blue-500/35">
                <Building2 className="h-10 w-10" />
              </div>
            )}
          </div>

          <div className="min-w-0 lg:flex-[1.05]">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`h-5 px-2 text-[9px] font-semibold ${situacaoClass}`}>
                {situacaoLabel}
              </Badge>
              {bia.destinacao && (
                <Badge variant="secondary" className="h-5 bg-blue-500 px-2 text-[9px] font-medium text-white">
                  {bia.destinacao}
                </Badge>
              )}
              {bia.papel_usuario && (
                <Badge variant="outline" className="h-5 border-blue-200 bg-blue-50 px-2 text-[9px] font-medium text-blue-700">
                  {bia.papel_usuario}
                </Badge>
              )}
            </div>
            <CardTitle className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base" data-testid={`dashboard-text-bia-nome-${bia.id}`}>
              {bia.nome_bia}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {bia.localizacao && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{bia.localizacao}</span>
                  {bia.latitude && bia.longitude && <Crosshair className="h-3 w-3 shrink-0 text-blue-500/60" aria-label="Geolocalizado" />}
                </span>
              )}
              {(bia.codigo_publico || bia.id) && <span className="font-mono text-[11px]">BIA-{getBiaPublicRef(bia).toUpperCase()}</span>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {bia.observacoes || bia.objetivo_alianca || "Aliança patrimonial integrada BUILT."}
            </p>
          </div>

          <div className="min-w-0 space-y-2 lg:max-w-[440px] lg:flex-[1.3] xl:max-w-[500px]">
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>Progresso geral</span>
                <span className="font-semibold text-foreground">{progresso}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${bia.situacao === "em_formacao" ? "bg-emerald-500" : "bg-blue-600"}`}
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-[72px_minmax(130px,1fr)_72px] gap-4">
              <div>
                <p className="text-[9px] text-muted-foreground">CPPs distribuídas</p>
                <p className="text-xs font-semibold text-foreground">{cppCount || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground">VGV</p>
                <p className="break-words text-xs font-semibold leading-tight text-foreground" data-testid={`dashboard-text-vgv-${bia.id}`}>
                  {vgv > 0 ? fmt(vgv, bia.moeda || "BRL") : "-"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Núcleos</p>
                <p className="text-xs font-semibold text-foreground">{nucleosAtivos || "-"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:ml-auto lg:w-[220px] lg:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-[112px] border-blue-200 px-4 text-xs text-blue-700 hover:bg-blue-50"
              onClick={(event) => { event.stopPropagation(); navigate(getBiaUrl(bia)); }}
              data-testid={`dashboard-btn-view-bia-${bia.id}`}
            >
              Ver detalhes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text = "Sem dados suficientes" }: { text?: string }) {
  return (
    <div className="flex h-[190px] items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function PieDistributionCard({ title, data }: { title: string; data: Array<{ name: string; value: number; percent: number }> }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">Percentual do capital investido</p>
        {data.length === 0 ?(
          <EmptyChart />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr]">
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {data.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, props) => [
                      `${fmt(Number(value))} (${fmtPercent(props.payload.percent)})`,
                      props.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 self-center">
              {data.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPercent(item.percent)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-5">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-7 w-32" />
      </CardContent>
    </Card>
  );
}

function BiaCardSkeleton() {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}

function ProfileCompletionRing({ percentage }: { percentage: number }) {
  return (
    <div
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#2563eb ${percentage * 3.6}deg, #e2e8f0 0deg)`,
      }}
      role="img"
      aria-label={`Perfil ${percentage}% completo`}
    >
      <div className="grid h-11 w-11 place-items-center rounded-full bg-background">
        <span className="text-xs font-bold tabular-nums text-blue-700">{percentage}%</span>
      </div>
    </div>
  );
}

function deriveRole(user: any): string | null {
  if (!user) return null;
  const redes: string[] = Array.isArray(user.Outras_redes_as_quais_pertenco) ?user.Outras_redes_as_quais_pertenco : [];
  if (redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER")) return "Aliado BUILT";
  const tipos: string[] = Array.isArray(user.tipos_alianca) ?user.tipos_alianca : [];
  if (tipos.includes("Liderança")) return "Diretor de Aliança";
  if (user.role === "admin") return "Administrador";
  if (user.role === "manager") return "Gestor";
  return null;
}

export default function PainelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const initialNavigation = resolveDashboardNavigation(window.location.search);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(initialNavigation.tab);
  const [carteiraView, setCarteiraView] = useState<CarteiraView>(initialNavigation.carteiraView);
  const [businessSection, setBusinessSection] = useState<BusinessSection>(initialNavigation.businessSection);
  const [conviteDialogOpen, setConviteDialogOpen] = useState(false);
  const [blockedAccess, setBlockedAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);
  const [selectedCarteiraAlert, setSelectedCarteiraAlert] = useState<CarteiraDashboardAlert | null>(null);
  const [carteiraAlertAction, setCarteiraAlertAction] = useState("");

  useEffect(() => {
    const nextNavigation = resolveDashboardNavigation(window.location.search);
    setDashboardTab(nextNavigation.tab);
    setCarteiraView(nextNavigation.carteiraView);
    setBusinessSection(nextNavigation.businessSection);
  }, [location]);

  function handleDashboardTabChange(nextTab: string) {
    const tab = nextTab as DashboardTab;
    const nextCarteiraView = tab === "carteira" ? "imoveis" : carteiraView;
    const nextBusinessSection = tab === "negocios" ? "recomendados" : businessSection;
    setDashboardTab(tab);
    setCarteiraView(nextCarteiraView);
    setBusinessSection(nextBusinessSection);
    window.history.replaceState(window.history.state, "", dashboardNavigationUrl({ tab, carteiraView: nextCarteiraView, businessSection: nextBusinessSection }));
  }

  function handleCarteiraViewChange(nextView: string) {
    const view = nextView as CarteiraView;
    setCarteiraView(view);
    window.history.replaceState(window.history.state, "", dashboardNavigationUrl({ tab: "carteira", carteiraView: view, businessSection }));
  }

  function handleBusinessSectionChange(section: BusinessSection) {
    setBusinessSection(section);
    window.history.replaceState(window.history.state, "", dashboardNavigationUrl({ tab: "negocios", carteiraView, businessSection: section }));
  }

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  const { data: meuConvite } = useQuery<any>({
    queryKey: ["/api/meu-convite"],
    queryFn: async () => {
      const res = await fetch("/api/meu-convite", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.membro_directus_id,
    staleTime: 60000,
  });
  const meuConviteLink = normalizeInviteLink(meuConvite?.link);

  const { data: agendaTarefas = [] } = useQuery<AgendaTarefa[]>({
    queryKey: ["/api/agenda"],
  });

  const gerarConviteMutation = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const res = await fetch("/api/meu-convite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: !!force, tipo: "unificado" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar convite");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meu-convite"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar convite", description: err.message, variant: "destructive" });
    },
  });

  const { data: auraData } = useQuery<{ score: number | null; T: number | null; R: number | null; C: number | null; n: number; faixa: string | null }>({
    queryKey: ["/api/aura/score", user?.membro_directus_id],
    enabled: !!user?.membro_directus_id,
  });

  const {
    data: profileDetails,
    isLoading: isLoadingProfileDetails,
    isError: isProfileDetailsError,
  } = useQuery<ProfileCompletionSource>({
    queryKey: ["/api/membros", user?.membro_directus_id],
    enabled: !!user?.membro_directus_id && !user?.company_employee,
  });
  const profileCompletion = useMemo(() => getProfileCompletion(profileDetails), [profileDetails]);
  const canShowProfileCompletion = !!user?.membro_directus_id
    && !user.company_employee
    && !isProfileDetailsError;
  const showProfileCompletion = canShowProfileCompletion
    && !isLoadingProfileDetails
    && profileCompletion.percentage < 100;
  const visibleProfileMissing = profileCompletion.missing.slice(0, 2);
  const remainingProfileMissing = Math.max(0, profileCompletion.missing.length - visibleProfileMissing.length);
  const profileMissingText = visibleProfileMissing.map((item) => item.label).join(", ");
  const allProfileMissingText = profileCompletion.missing.map((item) => item.label).join(", ");

  const { data: carteiraAlerts = [], isLoading: isLoadingCarteiraAlerts } = useQuery<CarteiraDashboardAlert[]>({
    queryKey: ["/api/carteira/alertas"],
    queryFn: async () => {
      const response = await fetch("/api/carteira/alertas?limit=12", { credentials: "include" });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    },
    staleTime: 30000,
  });

  const registerCarteiraAlertAction = useMutation({
    mutationFn: async ({ alert, action }: { alert: CarteiraDashboardAlert; action: string }) => (
      await apiRequest("PATCH", `/api/carteira/imoveis/${alert.imovel_id}/alertas/${alert.id}`, {
        status: "em_andamento",
        acao_registrada: action,
      })
    ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/alertas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
      if (selectedCarteiraAlert) {
        queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", selectedCarteiraAlert.imovel_id, "alertas"] });
      }
      setSelectedCarteiraAlert(null);
      setCarteiraAlertAction("");
      toast({ title: "Ação registrada", description: "O alerta continuará visível enquanto estiver em andamento." });
    },
    onError: (error: any) => toast({ title: "Não foi possível registrar a ação", description: error?.message, variant: "destructive" }),
  });

  const ignoreCarteiraAlert = useMutation({
    mutationFn: async (alert: CarteiraDashboardAlert) => (
      await apiRequest("PATCH", `/api/carteira/imoveis/${alert.imovel_id}/alertas/${alert.id}`, { status: "ignorado" })
    ).json(),
    onSuccess: (_result, alert) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/alertas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/imoveis", alert.imovel_id, "alertas"] });
      toast({ title: "Alerta ignorado" });
    },
    onError: (error: any) => toast({ title: "Não foi possível ignorar o alerta", description: error?.message, variant: "destructive" }),
  });

  const bias = data?.bias ?? [];
  const comunidades = data?.comunidades ?? [];
  const opas = data?.opas ?? [];
  const convergencias = data?.convergencias ?? [];
  const dashboardStats = data?.dashboard_stats ?? {
    convergencias_total: convergencias.length,
    opas_total_periodo: 0,
    interesses_manifestados: opas.length,
    indice_convergencia: 0,
    taxa_interesse: 0,
    opas_comunidade_total: 0,
    opas_por_abrangencia: [
      { name: "Regional", value: 0 },
      { name: "Nacional", value: 0 },
      { name: "Global", value: 0 },
    ],
  };
  const [biaSearch, setBiaSearch] = useState("");
  const [biaSituacao, setBiaSituacao] = useState("__all__");
  const [biaPapel, setBiaPapel] = useState("__all__");
  const [convergenciaSearch, setConvergenciaSearch] = useState("");
  const [convergenciaTipo, setConvergenciaTipo] = useState("__all__");
  const [convergenciaSelo, setConvergenciaSelo] = useState("__all__");
  const [convergenciaRamo, setConvergenciaRamo] = useState("__all__");
  const [convergenciaNucleo, setConvergenciaNucleo] = useState("__all__");
  const totals = data?.totals ?? { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 };
  const opasAbertas = data?.opas_abertas ?? opas.filter(o => o.status !== "concluida" && o.status !== "desistencia").length;
  const comunidadeIds = useMemo(() => comunidades.map((c) => String(c.id)).filter(Boolean), [comunidades]);

  const { data: aprovacoesPendentes = [], isLoading: isLoadingAprovacoes } = useQuery<DashboardApproval[]>({
    queryKey: ["/api/dashboard/aprovacoes-pendentes", comunidadeIds.join(",")],
    enabled: comunidadeIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(
        comunidadeIds.map(async (id) => {
          const res = await fetch(`/api/convites?comunidade_id=${encodeURIComponent(id)}`, {
            credentials: "include",
          });
          if (!res.ok) return [];
          return res.json();
        }),
      );
      return responses
        .flat()
        .filter((convite: DashboardApproval) =>
          ["candidato", "aguardando_avaliacao_aura", "termos_aceitos", "pagamento_pendente"].includes(String(convite.status || "")),
        );
    },
    staleTime: 60000,
  });

  const { data: diretorSolicitacoes = [], isLoading: isLoadingDiretorSolicitacoes } = useQuery<DiretorSolicitacao[]>({
    queryKey: ["/api/bia-diretor-solicitacoes/minhas"],
    queryFn: async () => {
      const res = await fetch("/api/bia-diretor-solicitacoes/minhas", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000,
  });

  const { data: socioSolicitacoes = [], isLoading: isLoadingSocioSolicitacoes } = useQuery<SocioSolicitacao[]>({
    queryKey: ["/api/bia-socio-solicitacoes/minhas"],
    queryFn: async () => {
      const res = await fetch("/api/bia-socio-solicitacoes/minhas", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000,
  });

  const { data: chamadasAlianca = [], isLoading: isLoadingChamadasAlianca } = useQuery<ChamadaAlianca[]>({
    queryKey: ["/api/chamadas-alianca/minhas"],
    queryFn: async () => {
      const res = await fetch("/api/chamadas-alianca/minhas", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000,
  });

  const alertasPendencias = useMemo(() => {
    const carteira = carteiraAlerts.slice(0, 4).map((alert) => ({
      title: alert.titulo,
      subtitle: alert.acao_registrada
        ? `${alert.imovel_nome} · Ação em andamento`
        : `${alert.imovel_nome}${alert.imovel_cidade ? ` · ${alert.imovel_cidade}` : ""}`,
      icon: AlertTriangle,
      tone: alert.severidade === "critica" || alert.severidade === "alta" ? "red" : "amber",
      kind: "carteira" as const,
      carteiraAlert: alert,
    }));

    const diretorias = diretorSolicitacoes.slice(0, 4).map((solicitacao) => {
      const percentual = solicitacao.percentual !== null && solicitacao.percentual !== undefined && String(solicitacao.percentual) !== ""
        ? ` — ${solicitacao.percentual}%`
        : "";
      return {
        title: `Indicação para ${solicitacao.papel}${percentual}`,
        subtitle: solicitacao.bia_nome || "BIA aguardando aceite",
        icon: UserCheck,
        tone: "blue",
      };
    });

    const socios = socioSolicitacoes.slice(0, 4).map((solicitacao) => ({
      title: `Convite para ${solicitacao.papel}`,
      subtitle: solicitacao.bia_nome || "BIA aguardando aceite",
      icon: UserCheck,
      tone: "amber",
    }));

    const chamadas = chamadasAlianca.slice(0, 4).map((chamada) => ({
      title: chamada.titulo || "Chamada para aliança",
      subtitle: `${chamada.bia_nome || chamada.bia_id} · ${new Date(chamada.data_hora).toLocaleDateString("pt-BR")}`,
      icon: Megaphone,
      tone: "blue",
    }));

    const convites = aprovacoesPendentes.slice(0, 4).map((convite) => {
      const status = String(convite.status || "");
      const nome = convite.candidato_nome || convite.candidato_email || "Candidato";
      const tituloPorStatus: Record<string, string> = {
        candidato: `${nome} aguardando aprovação`,
        aguardando_avaliacao_aura: `${nome} aguardando avaliação AURA`,
        termos_aceitos: `${nome} com termos aceitos`,
        pagamento_pendente: `${nome} com pagamento pendente`,
      };
      return {
        title: tituloPorStatus[status] || `${nome} requer atenção`,
        subtitle: convite.comunidade_nome || (convite.tipo ?`Convite ${convite.tipo}` : "Convite pendente"),
        icon: status === "pagamento_pendente" ?Clock : status === "termos_aceitos" ?FileWarning : AlertTriangle,
        tone: status === "pagamento_pendente" ? "orange" : status === "termos_aceitos" ? "amber" : "red",
      };
    });

    const pendencias = [...carteira, ...chamadas, ...diretorias, ...socios, ...convites].slice(0, 4);
    if (pendencias.length > 0) return pendencias;

    return [
      {
        title: "Nenhum alerta pendente",
        subtitle: "Tudo certo no momento",
        icon: AlarmClock,
        tone: "blue",
      },
    ];
  }, [aprovacoesPendentes, carteiraAlerts, diretorSolicitacoes, socioSolicitacoes, chamadasAlianca]);

  const biasAtivas = bias.filter(b => b.situacao === "ativa").length;
  const biaPapelOptions = useMemo(
    () => Array.from(new Set(bias.map((b) => b.papel_usuario).filter(Boolean))) as string[],
    [bias],
  );
  const convergenciaTipoOptions = useMemo(
    () => Array.from(new Set(convergencias.map((opa) => opa.tipo).filter(Boolean))) as string[],
    [convergencias],
  );
  const convergenciaRamoOptions = useMemo(
    () => Array.from(new Set(convergencias.map((opa) => opa.ramo_atuacao).filter(Boolean))) as string[],
    [convergencias],
  );
  const convergenciaNucleoOptions = useMemo(
    () => Array.from(new Set(convergencias.map((opa) => opa.nucleo_alianca).filter(Boolean))) as string[],
    [convergencias],
  );
  const filteredBias = useMemo(() => {
    const q = normalizeText(biaSearch);
    return bias.filter((b) => {
      const haystack = normalizeText([
        b.nome_bia,
        b.objetivo_alianca,
        b.localizacao,
        b.papel_usuario,
        b.situacao,
      ].join(" "));
      const matchSearch = !q || haystack.includes(q);
      const matchSituacao = biaSituacao === "__all__" || b.situacao === biaSituacao;
      const matchPapel = biaPapel === "__all__" || b.papel_usuario === biaPapel;
      return matchSearch && matchSituacao && matchPapel;
    });
  }, [bias, biaSearch, biaSituacao, biaPapel]);
  const totalInvestimentoUsuario = useMemo(
    () => bias.reduce((sum, b) => sum + n(b.investimento_usuario_valor), 0),
    [bias],
  );
  const totalReceitaUsuario = useMemo(
    () => bias.reduce((sum, b) => sum + n(b.receita_usuario_valor), 0),
    [bias],
  );
  const receitaVsInvestimentoData = useMemo(
    () => bias
      .map((b) => ({
        name: b.nome_bia?.length > 18 ?`${b.nome_bia.slice(0, 18)}...` : b.nome_bia,
        investimento: n(b.investimento_usuario_valor),
        receita: n(b.receita_usuario_valor),
      }))
      .filter((item) => item.investimento > 0 || item.receita > 0)
      .slice(0, 8),
    [bias],
  );
  const alocacaoPorDestinacao = useMemo(() => groupCurrencyBy(bias, "destinacao"), [bias]);
  const alocacaoPorObjetivo = useMemo(() => groupCurrencyBy(bias, "objetivo_alianca"), [bias]);
  const convergenciaMetricsData = useMemo(() => [
    { name: "Oportunidades", value: dashboardStats.convergencias_total },
    { name: "Interesses Manifestados", value: dashboardStats.interesses_manifestados },
  ], [dashboardStats.convergencias_total, dashboardStats.interesses_manifestados]);
  const filteredConvergencias = useMemo(() => {
    const q = normalizeText(convergenciaSearch);
    return convergencias.filter((opa) => {
      const haystack = normalizeText([
        opa.nome_oportunidade,
        opa.tipo,
        opa.ramo_atuacao,
        opa.nucleo_alianca,
        opa.nome_bia_vinculada,
        opa.perfil_aliado,
      ].join(" "));
      const matchSearch = !q || haystack.includes(q);
      const matchTipo = convergenciaTipo === "__all__" || opa.tipo === convergenciaTipo;
      const matchSelo = convergenciaSelo === "__all__" || opa.selo === convergenciaSelo;
      const matchRamo = convergenciaRamo === "__all__" || opa.ramo_atuacao === convergenciaRamo;
      const matchNucleo = convergenciaNucleo === "__all__" || opa.nucleo_alianca === convergenciaNucleo;
      return matchSearch && matchSelo && matchTipo && matchRamo && matchNucleo;
    });
  }, [convergencias, convergenciaSearch, convergenciaSelo, convergenciaTipo, convergenciaRamo, convergenciaNucleo]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const nomeExibido = user?.nome || user?.username || "membro";
  const roleLabel = deriveRole(user);
  const canUsePremium = ["admin", "manager", "superadmin"].includes(String(user?.role || "").toLowerCase())
    || user?.membership?.active === true;
  const isBuiltAlliancesMember = environmentAccessFor(user, "alliances").canAccess;

  function goToEnvironment(target: EnvironmentTarget, path: string) {
    const access = environmentAccessFor(user, target);
    if (!access.canAccess) {
      setBlockedAccess(access);
      return;
    }
    navigate(path);
  }

  function goToAuraRegister() {
    if (!isBuiltMemberForAura(user)) {
      setBlockedAccess(environmentAccessFor(user, "alliances"));
      return;
    }
    navigate("/aura?registrar=1");
  }
  const comunidadeLabel = comunidades.length > 0 ?comunidades[0].nome : null;

  const avatarInitials = nomeExibido
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();
  const dailyQuote = useMemo(() => DASHBOARD_DAILY_QUOTES[getDailyQuoteIndex()], []);
  const environmentImages = useMemo(() => getDailyEnvironmentImages(), []);
  const proximasAcoes = useMemo(() => agendaTarefas
    .filter(acao => acao.status !== "concluida" && acao.status !== "cancelada")
    .sort((a, b) => `${a.data} ${a.hora || "99:99"}`.localeCompare(`${b.data} ${b.hora || "99:99"}`))
    .slice(0, 4)
    .map((acao) => {
      const [year, month, day] = acao.data.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return {
        id: acao.id,
        dia: date.toLocaleDateString("pt-BR", { day: "2-digit" }),
        mes: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
        titulo: acao.titulo,
        subtitulo: acao.descricao || (acao.status === "em_andamento" ? "Em andamento" : "Pendente"),
        hora: acao.hora || "--:--",
        prioridade: acao.prioridade || "media",
      };
    }), [agendaTarefas]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 ring-2 ring-blue-500/30" data-testid="avatar-profile">
              {user?.foto_perfil && (
                <AvatarImage src={user.foto_perfil} alt={nomeExibido} />
              )}
              <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-semibold">
                {avatarInitials || <LayoutDashboard className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-semibold text-foreground">
                {greeting()}, {nomeExibido}
              </h1>
              <ModuleInfo
                title="Início"
                description="Reúne sua atividade, pendências, Carteira, negócios e atalhos dos ambientes BUILT em uma visão única."
              />
            </div>
          </div>
          {user?.membro_directus_id && (
            <Button
              className="gap-2 border border-[#005BFF] bg-[#005BFF] text-white shadow-sm hover:bg-[#004FE0] hover:text-white"
              onClick={() => setConviteDialogOpen(true)}
              data-testid="btn-dashboard-convidar-parceiro"
            >
              <Ticket className="w-4 h-4" />
              Convidar parceiro
            </Button>
          )}
        </div>
        <div className="pl-[52px] flex flex-wrap items-center gap-2">
          {roleLabel && (
            <Badge
              variant="outline"
              className="text-[11px] text-[#005BFF] border-[#005BFF]/35 bg-[#005BFF]/10"
              data-testid="badge-role"
            >
              {roleLabel}
            </Badge>
          )}
          {comunidadeLabel && (
            <button
              type="button"
              onClick={() => navigate(comunidades[0]?.id ?`/comunidade/${comunidades[0].id}?from=dashboard` : "/comunidade")}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="btn-comunidade-header"
            >
              <Badge
                variant="outline"
                className="cursor-pointer text-[11px] text-muted-foreground border-border/60 transition-colors hover:border-blue-500/40 hover:text-blue-700"
                data-testid="badge-comunidade"
              >
                {comunidadeLabel}
              </Badge>
            </button>
          )}
          {!roleLabel && !comunidadeLabel && (
            <p className="text-sm text-muted-foreground">
              Visão geral da sua atividade na plataforma Built Alliances.
            </p>
          )}
        </div>
      </div>

      <Tabs value={!canUsePremium && dashboardTab === "gestao" ? "inicio" : dashboardTab} onValueChange={handleDashboardTabChange} className="space-y-4">
        <TabsList className={`grid h-auto w-full grid-cols-2 gap-1 bg-muted/40 p-1 ${canUsePremium ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <TabsTrigger value="inicio" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-inicio">
            <LayoutDashboard className="w-4 h-4 text-blue-600" />
            Início
          </TabsTrigger>
          <TabsTrigger value="carteira" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-carteira">
            <Landmark className="w-4 h-4 text-blue-600" />
            Carteira
          </TabsTrigger>
          <TabsTrigger value="negocios" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-negocios">
            <BriefcaseBusiness className="w-4 h-4 text-cyan-600" />
            Negócios para você
          </TabsTrigger>
          {canUsePremium && <TabsTrigger value="gestao" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-gestao">
            <SlidersHorizontal className="w-4 h-4 text-violet-600" />
            Gestão
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="inicio" className="space-y-4 mt-0">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
        {dailyQuote ? (
          <Card className="border border-border/60 bg-card">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Quote className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">
                    Frase do dia
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    “{dailyQuote.text}”
                  </p>
                  {dailyQuote.author && (
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {dailyQuote.author}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div />
        )}

        <Card className="border border-border/60">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-foreground">Seus ambientes BUILT</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "BUILT Vitrine",
                  subtitle: "Conecte-se. Apresente-se.",
                  action: "Entrar na Vitrine",
                  path: "/vitrine",
                  target: "vitrine" as const,
                  icon: Gem,
                  accent: "text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.9)]",
                  border: "border-yellow-300/90",
                  button: "text-yellow-200 hover:bg-yellow-300/20",
                  glow: "bg-yellow-300/45",
                  line: "bg-yellow-300/90",
                  bg: "from-[#020617] via-[#00375A] to-[#050B1E]",
                  image: environmentImages[0],
                },
                {
                  title: "BUILT Alliances",
                  subtitle: "Estruture. Execute.",
                  action: "Entrar em Alliances",
                  path: "/area-aliancas?tab=oportunidades&tipo=demandas",
                  target: "alliances" as const,
                  icon: Users,
                  accent: "text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.9)]",
                  border: "border-cyan-300/90",
                  button: "text-cyan-200 hover:bg-cyan-300/20",
                  glow: "bg-cyan-300/45",
                  line: "bg-cyan-300/90",
                  bg: "from-[#050B2A] via-[#0044B8] to-[#090E2D]",
                  image: environmentImages[1],
                },
                {
                  title: "BUILT Capital",
                  subtitle: "Invista. Acompanhe.",
                  action: "Entrar em Capital",
                  path: "/built-capital",
                  target: "capital" as const,
                  icon: TrendingUp,
                  accent: "text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]",
                  border: "border-emerald-300/90",
                  button: "text-emerald-200 hover:bg-emerald-300/20",
                  glow: "bg-emerald-300/45",
                  line: "bg-emerald-300/90",
                  bg: "from-[#031B2D] via-[#00605F] to-[#06121D]",
                  image: environmentImages[2],
                },
              ].map((ambiente) => {
                const Icon = ambiente.icon;
                return (
                  <button
                    key={ambiente.title}
                    type="button"
                    onClick={() => goToEnvironment(ambiente.target, ambiente.path)}
                    className={`group relative min-h-[156px] overflow-hidden rounded-lg border bg-gradient-to-br ${ambiente.bg} p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.24)]`}
                    style={{
                      backgroundImage: `linear-gradient(120deg, rgba(0, 10, 24, 0.62), rgba(0, 20, 42, 0.38) 48%, rgba(0, 8, 20, 0.52)), url(${ambiente.image})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                    data-testid={`dashboard-ambiente-${ambiente.path.replace("/", "")}`}
                  >
                    <span className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${ambiente.glow}`} />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                    <span className={`pointer-events-none absolute bottom-8 right-8 h-24 w-px rotate-45 ${ambiente.line}`} />
                    <span className={`pointer-events-none absolute bottom-8 right-14 h-16 w-px rotate-45 ${ambiente.line}`} />
                    <span className={`pointer-events-none absolute bottom-8 right-20 h-10 w-px rotate-45 ${ambiente.line}`} />
                    <div className="relative flex h-full flex-col justify-between">
                      <div>
                        <Icon className={`h-8 w-8 ${ambiente.accent}`} />
                        <p className="mt-6 text-base font-bold text-white">{ambiente.title}</p>
                        <p className="mt-1 text-xs font-medium text-white/75">{ambiente.subtitle}</p>
                      </div>
                      <span className={`mt-4 inline-flex items-center justify-between rounded-md border px-3 py-2 text-xs font-semibold ${ambiente.border} ${ambiente.button}`}>
                        {ambiente.action}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="space-y-4">
        <Card
          className="border border-border/60"
          style={{ borderColor: auraData?.score != null ?`${getFaixaColor(auraData.score)}30` : undefined }}
          data-testid="dashboard-profile-panel"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Seu perfil</p>
              <Button variant="ghost" className="h-auto p-0 text-xs text-blue-600 hover:bg-transparent hover:text-blue-700" onClick={() => navigate("/meu-perfil")}>
                Ver perfil completo
              </Button>
            </div>

            {canShowProfileCompletion && isLoadingProfileDetails && (
              <div className="mt-3 flex items-center gap-3" data-testid="dashboard-profile-completion-loading">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            )}

            {showProfileCompletion && (
              <button
                type="button"
                className="mt-3 flex w-full items-center gap-3 rounded-md border border-blue-100 bg-blue-50/60 p-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                onClick={() => navigate("/meu-perfil")}
                data-testid="dashboard-profile-completion"
              >
                <ProfileCompletionRing percentage={profileCompletion.percentage} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Complete seu perfil</p>
                  <p
                    className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                    title={`Falta preencher: ${allProfileMissingText}`}
                    data-testid="dashboard-profile-missing-fields"
                  >
                    <span className="font-semibold text-slate-700">Falta:</span>{" "}
                    {profileMissingText}
                    {remainingProfileMissing > 0 ? ` +${remainingProfileMissing}` : ""}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                    Completar cadastro
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            )}

            <button
              type="button"
              className={`flex w-full items-center gap-3 text-left ${showProfileCompletion ? "mt-3 border-t border-border/60 pt-3" : "mt-3"}`}
              onClick={() => navigate("/aura")}
              data-testid="dashboard-aura-panel"
            >
              <AuraScore score={auraData?.score ?? null} size="sm" showLabel={false} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Aura Percebida</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {auraData?.score != null ?auraData.faixa : "Aguardando avaliações"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {auraData?.score != null ?"resultado atual da rede" : "sem avaliações"}
                </p>
              </div>
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-center text-xs font-semibold text-emerald-700">
                Perfil validado
              </div>
              {isBuiltAlliancesMember ? (
                <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-center text-xs font-semibold text-blue-700">
                  Membro ativo
                </div>
              ) : (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-center text-xs font-semibold text-amber-700">
                  Parceiro de mercado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60" data-testid="dashboard-acoes-rapidas">
          <CardContent className="p-3">
            <p className="text-sm font-semibold text-foreground">Ações rápidas</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: "Nova BIA", icon: Plus, path: "/area-aliancas?tab=bias&criar=true" },
                { label: "Registrar Percepção de AURA", icon: Sparkles, path: "/aura?registrar=1", auraRegister: true },
                { label: "Criar destaque", icon: Megaphone, path: "/vitrine?criarAnuncio=true", target: "vitrine" as const },
                { label: "Registrar aporte", icon: Wallet, path: "/built-capital", target: "capital" as const },
              ].map((acao) => {
                const Icon = acao.icon;
                return (
                  <button
                    key={acao.label}
                    type="button"
                    onClick={() => acao.auraRegister ? goToAuraRegister() : acao.target ? goToEnvironment(acao.target, acao.path) : navigate(acao.path)}
                    className="group flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background text-center text-xs font-semibold text-[#001D34] transition-colors hover:border-blue-500/40 hover:bg-blue-50 hover:text-blue-700"
                    data-testid={`acao-rapida-${acao.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-6 w-6 text-blue-700 transition-transform group-hover:scale-110" />
                    <span>{acao.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        </div>

        <EnvironmentAccessDialog
          access={blockedAccess}
          open={!!blockedAccess}
          onOpenChange={(open) => !open && setBlockedAccess(null)}
        />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ?(
          Array.from({ length: 2 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
          <Card
            className="border border-border/60 cursor-pointer hover:border-blue-500/40 transition-colors"
            onClick={() => navigate("/notificacoes")}
            data-testid="stat-card-notificacoes"
          >
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Alertas e pendências</h2>
                <Button
                  variant="ghost"
                  className="h-auto p-0 text-xs text-blue-600 hover:bg-transparent hover:text-blue-700"
                  onClick={(event) => { event.stopPropagation(); navigate("/notificacoes"); }}
                >
                  Ver todos
                </Button>
              </div>
              <div className="space-y-2">
                {isLoadingAprovacoes || isLoadingCarteiraAlerts || isLoadingDiretorSolicitacoes || isLoadingSocioSolicitacoes || isLoadingChamadasAlianca ?(
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                ) : (
                  alertasPendencias.map((alerta, index) => {
                    const Icon = alerta.icon;
                    const carteiraAlert = "carteiraAlert" in alerta
                      ? alerta.carteiraAlert as CarteiraDashboardAlert
                      : null;
                    const toneClass = alerta.tone === "red"
                      ? "bg-red-500/10 text-red-600"
                      : alerta.tone === "orange"
                        ? "bg-orange-500/10 text-orange-600"
                        : alerta.tone === "amber"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-blue-500/10 text-blue-600";
                    return (
                      <div
                        key={`${alerta.title}-${index}`}
                        className={`flex items-center gap-3 rounded-lg py-1.5 ${carteiraAlert ? "cursor-pointer" : ""}`}
                        onClick={(event) => {
                          if (!carteiraAlert) return;
                          event.stopPropagation();
                          navigate(`/carteira/${carteiraAlert.imovel_id}`);
                        }}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{alerta.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{alerta.subtitle}</p>
                        </div>
                        {carteiraAlert?.can_act ? (
                          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => {
                                setSelectedCarteiraAlert(carteiraAlert);
                                setCarteiraAlertAction(carteiraAlert.acao_registrada || carteiraAlert.acao_sugerida || "");
                              }}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Ação
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              aria-label="Ignorar alerta"
                              title="Ignorar alerta"
                              disabled={ignoreCarteiraAlert.isPending}
                              onClick={() => ignoreCarteiraAlert.mutate(carteiraAlert)}
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : aprovacoesPendentes.length + diretorSolicitacoes.length + socioSolicitacoes.length + chamadasAlianca.length + carteiraAlerts.length > 0 && (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60" data-testid="stat-card-proximas-acoes">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Próximas ações</h2>
                <button type="button" onClick={() => navigate("/agenda")} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Ver agenda
                </button>
              </div>
              <div className="space-y-2">
                {proximasAcoes.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate("/agenda")}
                    className="w-full rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground hover:border-blue-300 hover:text-blue-700"
                  >
                    Nenhuma ação pendente. Criar na agenda.
                  </button>
                ) : proximasAcoes.map((acao) => (
                  <div key={acao.id} className="flex items-center gap-3 rounded-lg py-1">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-900">
                      <span className="text-sm font-bold leading-none">{acao.dia}</span>
                      <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none">{acao.mes}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-xs font-semibold text-foreground">{acao.titulo}</p>
                        <Badge variant="outline" className={`h-5 shrink-0 px-1.5 text-[10px] ${PRIORIDADE_CLASS[acao.prioridade]}`}>
                          {PRIORIDADE_LABEL[acao.prioridade]}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{acao.subtitulo}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">{acao.hora}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          </>
        )}
      </div>

        </TabsContent>

        <TabsContent value="carteira" className="space-y-4 mt-0">
          <Tabs value={carteiraView} onValueChange={handleCarteiraViewChange} className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/40 p-1">
              <TabsTrigger value="imoveis" className="gap-2 text-xs sm:text-sm" data-testid="tab-carteira-imoveis">
                <Landmark className="h-4 w-4 text-blue-600" />
                Imóveis
              </TabsTrigger>
              <TabsTrigger value="bias" className="gap-2 text-xs sm:text-sm" data-testid="tab-carteira-bias">
                <Briefcase className="h-4 w-4 text-amber-500" />
                Minhas Alianças
              </TabsTrigger>
            </TabsList>

            <TabsContent value="imoveis" className="mt-0">
              <CarteiraDashboardPanel compact />
            </TabsContent>

            <TabsContent value="bias" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-500" />
              Minhas Alianças
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => navigate("/bias")}
              data-testid="link-ver-todas-bias"
            >
              Ver todas <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_150px] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={biaSearch}
                onChange={(event) => setBiaSearch(event.target.value)}
                placeholder="Buscar BIA..."
                className="h-9 pl-8 text-xs"
                data-testid="input-filtro-bias-dashboard"
              />
            </div>
            <Select value={biaSituacao} onValueChange={setBiaSituacao}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-filtro-bia-situacao">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="em_formacao">Em formação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={biaPapel} onValueChange={setBiaPapel}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-filtro-bia-papel">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os papéis</SelectItem>
                {biaPapelOptions.map((papel) => (
                  <SelectItem key={papel} value={papel}>{papel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isLoading && (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <Card className="border border-border/60 xl:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-foreground">Capital Total Alocado</p>
                  </div>
                  <p className="mt-5 text-2xl font-bold tabular-nums text-foreground" data-testid="chart-total-investimento">
                    {fmt(totalInvestimentoUsuario)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">capital alocado nas suas BIAs</p>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.min(100, Math.max(6, totalInvestimentoUsuario > 0 ?100 : 0))}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 xl:col-span-3">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">Alocação vs Receita</p>
                  <p className="text-[11px] text-muted-foreground">
                    Capital Total Alocado: {fmt(totalInvestimentoUsuario)} vs Receita total: {fmt(totalReceitaUsuario)}
                  </p>
                  {receitaVsInvestimentoData.length === 0 ?(
                    <EmptyChart />
                  ) : (
                    <div className="mt-3 h-[210px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={receitaVsInvestimentoData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                          <Tooltip formatter={(value: number) => fmt(Number(value))} />
                          <Bar dataKey="investimento" name="Alocação" fill="#0B63F6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="receita" name="Receita" fill="#12B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="xl:col-span-2">
                <PieDistributionCard title="Alocação por destinação" data={alocacaoPorDestinacao} />
              </div>
              <div className="xl:col-span-2">
                <PieDistributionCard title="Alocação por objetivo de aliança" data={alocacaoPorObjetivo} />
              </div>
            </div>
          )}

          {isLoading ?(
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <BiaCardSkeleton key={i} />)}
            </div>
          ) : bias.length === 0 ?(
            <Card className="border border-dashed border-border/60">
              <CardContent className="p-8 text-center space-y-3">
                <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma BIA vinculada ao seu perfil.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/bias")}
                  data-testid="btn-criar-bia-empty"
                >
                  Criar minha primeira BIA
                </Button>
              </CardContent>
            </Card>
          ) : filteredBias.length === 0 ?(
            <Card className="border border-dashed border-border/60">
              <CardContent className="p-6 text-center space-y-2">
                <SlidersHorizontal className="w-7 h-7 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma BIA encontrada com esses filtros.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredBias.map(b => (
                <DashboardBiaCard key={b.id} bia={b} />
              ))}
            </div>
          )}

            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="convergencias" className="space-y-4 mt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                Painel de Convergência
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => navigate("/area-aliancas?tab=oportunidades")}
                data-testid="link-ver-convergencias"
              >
                Ver Oportunidades <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {!isLoading && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Card className="border border-border/60 lg:col-span-1">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-foreground">Oportunidades convergentes vs interesses manifestados</p>
                    <p className="text-[11px] text-muted-foreground">Comparativo dos últimos 12 meses</p>
                    <div className="mt-3 h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={convergenciaMetricsData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value: number) => [Number(value), "Quantidade"]} />
                          <Bar dataKey="value" name="Quantidade" fill="#0B63F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <MetricCard
                  title="Índice de Convergência"
                  value={fmtPercent(dashboardStats.indice_convergencia)}
                  subtitle="Oportunidades convergentes / total publicado nos últimos 12 meses"
                />
                <MetricCard
                  title="Taxa de interesse"
                  value={fmtPercent(dashboardStats.taxa_interesse)}
                  subtitle="Interesses manifestados / Oportunidades convergentes"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_130px_120px_170px_150px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={convergenciaSearch}
                  onChange={(event) => setConvergenciaSearch(event.target.value)}
                  placeholder="Buscar oportunidade..."
                  className="h-9 pl-8 text-xs"
                  data-testid="input-filtro-convergencias-dashboard"
                />
              </div>
              <Select value={convergenciaSelo} onValueChange={setConvergenciaSelo}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">Demandas e OBAs</SelectItem><SelectItem value="Demanda">Demandas</SelectItem><SelectItem value="OBA">OBAs</SelectItem></SelectContent>
              </Select>
              <Select value={convergenciaTipo} onValueChange={setConvergenciaTipo}>
                <SelectTrigger className="h-9 text-xs" data-testid="select-filtro-convergencia-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {convergenciaTipoOptions.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={convergenciaRamo} onValueChange={setConvergenciaRamo}>
                <SelectTrigger className="h-9 text-xs" data-testid="select-filtro-convergencia-ramo">
                  <SelectValue placeholder="Ramo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os ramos</SelectItem>
                  {convergenciaRamoOptions.map((ramo) => (
                    <SelectItem key={ramo} value={ramo}>{ramo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={convergenciaNucleo} onValueChange={setConvergenciaNucleo}>
                <SelectTrigger className="h-9 text-xs" data-testid="select-filtro-convergencia-nucleo">
                  <SelectValue placeholder="Núcleo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os núcleos</SelectItem>
                  {convergenciaNucleoOptions.map((nucleo) => (
                    <SelectItem key={nucleo} value={nucleo}>{nucleo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ?(
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <BiaCardSkeleton key={i} />)}
              </div>
            ) : convergencias.length === 0 ?(
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-6 text-center space-y-2">
                  <Target className="w-7 h-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma Oportunidade converge com suas áreas de contribuição.</p>
                  <p className="text-xs text-muted-foreground/70">Atualize suas áreas em Meu Perfil para melhorar as recomendações.</p>
                </CardContent>
              </Card>
            ) : filteredConvergencias.length === 0 ?(
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-6 text-center space-y-2">
                  <SlidersHorizontal className="w-7 h-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma convergência encontrada com esses filtros.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredConvergencias.map((opa) => (
                  <Card
                    key={opa.id}
                    className="border border-border/60 hover:border-blue-500/40 cursor-pointer transition-colors"
                    onClick={() => navigate(opa.opportunity_kind === "demanda" ? `/vitrine/oportunidades/demandas/${opa.id}` : getOpaUrl(opa, bias.find((item) => item.id === opa.bia_id), opas))}
                    data-testid={`card-convergencia-${opa.id}`}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                          {opa.nome_oportunidade || "Oportunidade sem nome"}
                        </p>
                        <Badge className={opa.selo === "Demanda" ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"}>{opa.selo || "OBA"}</Badge>
                        {opa.tipo && (
                          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
                            {opa.tipo}
                          </Badge>
                        )}
                      </div>
                      {(opa.ramo_atuacao || opa.nucleo_alianca || opa.nome_bia_vinculada) && (
                        <div className="flex flex-wrap gap-1.5">
                          {opa.ramo_atuacao && (
                            <Badge variant="outline" className="max-w-full truncate text-[10px] text-cyan-700 border-cyan-200 bg-cyan-50">
                              Ramo: {opa.ramo_atuacao}
                            </Badge>
                          )}
                          {opa.nucleo_alianca && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/70 bg-muted/30">
                              {opa.nucleo_alianca}
                            </Badge>
                          )}
                          {opa.nome_bia_vinculada && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/70 bg-muted/30">
                              {opa.nome_bia_vinculada}
                            </Badge>
                          )}
                        </div>
                      )}
                      {opa.perfil_aliado && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{opa.perfil_aliado}</p>
                      )}
                      <div className="pt-1 border-t border-border/40 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">{opa.selo === "Demanda" ? "Valor do fechamento" : "Valor da OBA"}</p>
                          <p className="text-xs font-medium tabular-nums">
                            {n(opa.valor_origem_opa) > 0 ?fmt(n(opa.valor_origem_opa)) : "-"}
                          </p>
                        </div>
                        <div title="Mínimo Esforço Multiplicador">
                          <p className="text-[10px] text-muted-foreground">MEM</p>
                          <p className="text-xs font-medium tabular-nums">
                            {n(opa.Minimo_esforco_multiplicador) > 0 ?fmtPercent(n(opa.Minimo_esforco_multiplicador)) : "-"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="negocios" className="space-y-4 mt-0">
          <MemberBusinessFeed
            initialSection={businessSection}
            onSectionChange={handleBusinessSectionChange}
            convergenceStats={dashboardStats}
          />
        </TabsContent>

        {canUsePremium && <TabsContent value="gestao" className="space-y-4 mt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <Button variant="outline" className="h-auto justify-start gap-3 p-4 text-left" onClick={() => navigate("/comunidade")}><Globe className="h-5 w-5 text-emerald-600" /><span><span className="block font-semibold">Comunidades e ROs</span><span className="block text-xs font-normal text-muted-foreground">Acesse sua comunidade e rodadas de oportunidade.</span></span></Button>
            <Button variant="outline" className="h-auto justify-start gap-3 p-4 text-left" onClick={() => navigate("/area-membros")}><Users className="h-5 w-5 text-blue-600" /><span><span className="block font-semibold">Rede de Membros Aliados</span><span className="block text-xs font-normal text-muted-foreground">Encontre membros da rede BUILT.</span></span></Button>
            <Button variant="outline" className="h-auto justify-start gap-3 p-4 text-left" onClick={() => navigate("/banco-ativos")}><Landmark className="h-5 w-5 text-amber-600" /><span><span className="block font-semibold">Banco de Ativos</span><span className="block text-xs font-normal text-muted-foreground">Consulte os ativos compartilhados.</span></span></Button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-600" />
                Gestão de comunidade
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => navigate(comunidades[0]?.id ?`/comunidade/${comunidades[0].id}?from=dashboard` : "/comunidade")}
                data-testid="link-gestao-comunidade"
              >
                Abrir <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {isLoading ?(
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <StatCardSkeleton key={i} />)}
              </div>
            ) : comunidades.length === 0 ?(
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-6 text-center space-y-2">
                  <Globe className="w-7 h-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma comunidade vinculada ao seu perfil.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {comunidades.map((comunidade) => {
                  const membrosCount = Array.isArray(comunidade.membros) ? comunidade.membros.length : 0;
                  const biasCount = Array.isArray(comunidade.bias) ? comunidade.bias.length : 0;
                  return (
                    <Card
                      key={comunidade.id}
                      className="border border-border/60 hover:border-blue-500/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/comunidade/${comunidade.id}?from=dashboard`)}
                      data-testid={`card-gestao-comunidade-${comunidade.id}`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {comunidade.nome || "Comunidade"}
                            </p>
                            {comunidade.sigla && (
                              <p className="mt-0.5 text-[10px] font-mono text-blue-600 truncate">
                                {comunidade.sigla}
                              </p>
                            )}
                            {(comunidade.territorio || comunidade.pais) && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{[comunidade.territorio, comunidade.pais].filter(Boolean).join(", ")}</span>
                              </p>
                            )}
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Membros</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">{membrosCount}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">BIAs</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">{biasCount}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Pendências</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {isLoadingAprovacoes ?"-" : aprovacoesPendentes.length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <CompanyAccessPanel />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-600" />
                Documentações
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => navigate("/documentacao")}
                data-testid="link-gestao-documentacoes"
              >
                Abrir <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card
                className="border border-border/60 hover:border-violet-500/40 cursor-pointer transition-colors"
                onClick={() => navigate("/documentacao")}
                data-testid="card-gestao-documentacoes-aceite"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            Documentações de aceite
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Consulte termos, políticas e MOUs aceitos por você.
                          </p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="border border-border/60 hover:border-blue-500/40 cursor-pointer transition-colors"
                onClick={() => navigate("/documentacao/relatorio-funcionalidades")}
                data-testid="card-gestao-relatorio-funcionalidades"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            Relatório de funcionalidades
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Consulte os módulos e recursos entregues na plataforma.
                          </p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </TabsContent>}
      </Tabs>

      <Dialog
        open={!!selectedCarteiraAlert}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedCarteiraAlert(null);
          setCarteiraAlertAction("");
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              Registrar ação
            </DialogTitle>
            <DialogDescription>
              {selectedCarteiraAlert?.titulo} · {selectedCarteiraAlert?.imovel_nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="carteira-alert-action" className="text-sm font-medium text-foreground">
              O que será feito?
            </label>
            <Textarea
              id="carteira-alert-action"
              value={carteiraAlertAction}
              onChange={(event) => setCarteiraAlertAction(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Descreva a ação, o responsável ou a próxima etapa."
            />
            {selectedCarteiraAlert?.acao_sugerida && (
              <p className="text-xs text-muted-foreground">
                Sugestão: {selectedCarteiraAlert.acao_sugerida}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCarteiraAlert(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!carteiraAlertAction.trim() || registerCarteiraAlertAction.isPending}
              onClick={() => {
                if (!selectedCarteiraAlert || !carteiraAlertAction.trim()) return;
                registerCarteiraAlertAction.mutate({ alert: selectedCarteiraAlert, action: carteiraAlertAction.trim() });
              }}
            >
              {registerCarteiraAlertAction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar ação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conviteDialogOpen} onOpenChange={setConviteDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-600" />
              Convidar parceiro
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              Gere e compartilhe um link de convite para novos parceiros entrarem na rede BUILT. O link é válido por 1 dia.
            </DialogDescription>
          </DialogHeader>

          {meuConviteLink ?(
            <div className="w-full min-w-0 space-y-3">
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-mono text-muted-foreground" data-testid="text-dashboard-convite-link">
                  {meuConviteLink}
                </span>
                <button
                  type="button"
                  title="Copiar link"
                  onClick={async () => {
                    const copied = await copyTextToClipboard(formatBuiltInviteMessage(meuConviteLink, meuConvite?.expires_at));
                    if (copied) {
                      toast({ title: "Convite copiado!", description: "A mensagem completa está pronta para compartilhar." });
                    } else {
                      toast({ title: "Não foi possível copiar", description: "Selecione o link e copie manualmente.", variant: "destructive" });
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                  data-testid="btn-dashboard-copiar-convite"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {meuConvite?.expires_at && (
                <p className="text-[11px] text-muted-foreground">
                  Expira em: {new Date(meuConvite.expires_at).toLocaleDateString("pt-BR")}
                </p>
              )}
              <button
                type="button"
                onClick={() => gerarConviteMutation.mutate({ force: true })}
                disabled={gerarConviteMutation.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                data-testid="btn-dashboard-renovar-convite"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gerarConviteMutation.isPending ?"animate-spin" : ""}`} />
                Gerar novo link
              </button>
              <InviteQrCode link={meuConviteLink} variant="light" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center space-y-3">
              <Ticket className="w-7 h-7 text-blue-600/70 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum link ativo no momento.</p>
              <Button
                onClick={() => gerarConviteMutation.mutate({ force: false })}
                disabled={gerarConviteMutation.isPending}
                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                data-testid="btn-dashboard-gerar-convite"
              >
                {gerarConviteMutation.isPending ?(
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                Gerar link de convite
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConviteDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}


