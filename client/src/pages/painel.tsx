import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { InviteQrCode } from "@/components/invite-qr-code";
import { EnvironmentAccessDialog, environmentAccessFor, type EnvironmentTarget } from "@/components/environment-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Briefcase, Globe, Users, TrendingUp, TrendingDown,
  MapPin, LayoutDashboard, Building2,
  Target, Wallet, ChevronRight, Sparkles, Search, SlidersHorizontal,
  Ticket, Copy, RefreshCw, Loader2, Quote, ArrowRight, Gem, Plus, Megaphone,
  AlertTriangle, Clock, FileWarning, AlarmClock,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AuraScore, getFaixaColor } from "@/components/aura-score";
import { copyTextToClipboard } from "@/lib/clipboard";
import { DASHBOARD_DAILY_QUOTES } from "@/lib/dashboard-quotes";
import { formatBuiltInviteMessage } from "@/lib/invite-message";
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
  nome_bia: string;
  situacao?: "ativa" | "em_formacao" | null;
  objetivo_alianca?: string | null;
  destinacao?: string | null;
  localizacao?: string;
  valor_origem?: number | string | null;
  custo_final_previsto?: number | string | null;
  resultado_liquido?: number | string | null;
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
}

interface DashboardApproval {
  id: string | number;
  status?: string | null;
  tipo?: string | null;
  candidato_nome?: string | null;
  candidato_email?: string | null;
  comunidade_nome?: string | null;
}

interface DashboardOpa {
  id: string;
  nome_oportunidade?: string;
  tipo?: string;
  bia_id?: string;
  nome_bia_vinculada?: string | null;
  valor_origem_opa?: number | string | null;
  status?: string;
  nucleo_alianca?: string | null;
  perfil_aliado?: string | null;
  Minimo_esforco_multiplicador?: number | string | null;
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
const INVITE_APP_URL = "https://built.dna11.com.br";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const INVITE_TYPE_OPTIONS = [
  { value: "vitrine", label: "BUILT Vitrine" },
  { value: "capital", label: "Investidor (Capital)" },
  { value: "membros", label: "Área de Alianças" },
];
const INVITE_TYPE_LABELS: Record<string, string> = Object.fromEntries(INVITE_TYPE_OPTIONS.map((option) => [option.value, option.label]));
const DASHBOARD_ENV_IMAGES = Array.from({ length: 10 }, (_, index) => `/dashboard-env/built-env-${String(index + 1).padStart(2, "0")}.png`);

function normalizeInviteLink(link?: string | null) {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `${INVITE_APP_URL}${link.startsWith("/") ?"" : "/"}${link}`;
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
  const [, navigate] = useLocation();
  const [conviteDialogOpen, setConviteDialogOpen] = useState(false);
  const [conviteTipo, setConviteTipo] = useState("vitrine");
  const [blockedAccess, setBlockedAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);

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
    mutationFn: async ({ force = false, tipo = conviteTipo }: { force?: boolean; tipo?: string } = {}) => {
      const res = await fetch("/api/meu-convite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: !!force, tipo }),
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

  function handleConviteTipoChange(tipo: string) {
    setConviteTipo(tipo);
    gerarConviteMutation.mutate({ force: true, tipo });
  }

  const { data: auraData } = useQuery<{ score: number | null; T: number | null; R: number | null; C: number | null; n: number; faixa: string | null }>({
    queryKey: ["/api/aura/score", user?.membro_directus_id],
    enabled: !!user?.membro_directus_id,
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
  const alertasPendencias = useMemo(() => {
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

    if (convites.length > 0) return convites;

    return [
      {
        title: "Nenhum alerta pendente",
        subtitle: "Tudo certo no momento",
        icon: AlarmClock,
        tone: "blue",
      },
    ];
  }, [aprovacoesPendentes]);

  const biasAtivas = bias.filter(b => b.situacao === "ativa").length;
  const biaPapelOptions = useMemo(
    () => Array.from(new Set(bias.map((b) => b.papel_usuario).filter(Boolean))) as string[],
    [bias],
  );
  const convergenciaTipoOptions = useMemo(
    () => Array.from(new Set(convergencias.map((opa) => opa.tipo).filter(Boolean))) as string[],
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
    { name: "OPAs Convergentes", value: dashboardStats.convergencias_total },
    { name: "Interesses Manifestados", value: dashboardStats.interesses_manifestados },
  ], [dashboardStats.convergencias_total, dashboardStats.interesses_manifestados]);
  const filteredConvergencias = useMemo(() => {
    const q = normalizeText(convergenciaSearch);
    return convergencias.filter((opa) => {
      const haystack = normalizeText([
        opa.nome_oportunidade,
        opa.tipo,
        opa.nucleo_alianca,
        opa.nome_bia_vinculada,
        opa.perfil_aliado,
      ].join(" "));
      const matchSearch = !q || haystack.includes(q);
      const matchTipo = convergenciaTipo === "__all__" || opa.tipo === convergenciaTipo;
      const matchNucleo = convergenciaNucleo === "__all__" || opa.nucleo_alianca === convergenciaNucleo;
      return matchSearch && matchTipo && matchNucleo;
    });
  }, [convergencias, convergenciaSearch, convergenciaTipo, convergenciaNucleo]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const nomeExibido = user?.nome || user?.username || "membro";
  const roleLabel = deriveRole(user);

  function goToEnvironment(target: EnvironmentTarget, path: string) {
    const access = environmentAccessFor(user, target);
    if (!access.canAccess) {
      setBlockedAccess(access);
      return;
    }
    navigate(path);
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
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {greeting()}, {nomeExibido}
              </h1>
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

      <Tabs defaultValue="inicio" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-muted/40 p-1 sm:grid-cols-5">
          <TabsTrigger value="inicio" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-inicio">
            <LayoutDashboard className="w-4 h-4 text-blue-600" />
            Início
          </TabsTrigger>
          <TabsTrigger value="bias" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-bias">
            <Briefcase className="w-4 h-4 text-amber-500" />
            Minhas BIAs
          </TabsTrigger>
          <TabsTrigger value="convergencias" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-convergencias">
            <Target className="w-4 h-4 text-emerald-600" />
            Painel de Convergência
          </TabsTrigger>
          <TabsTrigger value="opas" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-opas">
            <Target className="w-4 h-4 text-cyan-600" />
            OPAs de Interesse
          </TabsTrigger>
          <TabsTrigger value="gestao" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-gestao">
            <SlidersHorizontal className="w-4 h-4 text-violet-600" />
            Gestão
          </TabsTrigger>
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
                  path: "/area-aliancas",
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
                  action: "Entrar no Capital",
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
          className="border border-border/60 cursor-pointer transition-colors hover:border-blue-500/40"
          style={{ borderColor: auraData?.score != null ?`${getFaixaColor(auraData.score)}30` : undefined }}
          onClick={() => navigate("/aura")}
          data-testid="dashboard-aura-panel"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Seu perfil</p>
              <Button variant="link" className="h-auto p-0 text-xs text-blue-600" onClick={(event) => { event.stopPropagation(); navigate("/meu-perfil"); }}>
                Ver perfil completo
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-3">
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
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-center text-xs font-semibold text-emerald-700">
                Perfil validado
              </div>
              <div className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-center text-xs font-semibold text-blue-700">
                Membro ativo
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60" data-testid="dashboard-acoes-rapidas">
          <CardContent className="p-3">
            <p className="text-sm font-semibold text-foreground">Ações rápidas</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: "Nova BIA", icon: Plus, path: "/bias?criar=true" },
                { label: "Nova OPA", icon: Target, path: "/gestao-opas?criar=true" },
                { label: "Criar anúncio", icon: Megaphone, path: "/vitrine?criarAnuncio=true", target: "vitrine" as const },
                { label: "Registrar aporte", icon: Wallet, path: "/built-capital", target: "capital" as const },
              ].map((acao) => {
                const Icon = acao.icon;
                return (
                  <button
                    key={acao.label}
                    type="button"
                    onClick={() => acao.target ? goToEnvironment(acao.target, acao.path) : navigate(acao.path)}
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
                  variant="link"
                  className="h-auto p-0 text-xs text-blue-600"
                  onClick={(event) => { event.stopPropagation(); navigate("/notificacoes"); }}
                >
                  Ver todos
                </Button>
              </div>
              <div className="space-y-2">
                {isLoadingAprovacoes ?(
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
                    const toneClass = alerta.tone === "red"
                      ? "bg-red-500/10 text-red-600"
                      : alerta.tone === "orange"
                        ? "bg-orange-500/10 text-orange-600"
                        : alerta.tone === "amber"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-blue-500/10 text-blue-600";
                    return (
                      <div key={`${alerta.title}-${index}`} className="flex items-center gap-3 rounded-lg py-1.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{alerta.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{alerta.subtitle}</p>
                        </div>
                        {aprovacoesPendentes.length > 0 && (
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
                      <p className="truncate text-xs font-semibold text-foreground">{acao.titulo}</p>
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

        <TabsContent value="bias" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-500" />
              Minhas BIAs
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredBias.map(b => (
                <Card
                  key={b.id}
                  className="border border-border/60 hover:border-blue-500/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/bias/${b.id}`)}
                  data-testid={`card-bia-${b.id}`}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                        {b.nome_bia}
                      </p>
                      {situacaoBadge(b.situacao)}
                    </div>

                    {(b.papel_usuario || b.objetivo_alianca || b.destinacao) && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.papel_usuario && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"
                            data-testid={`badge-papel-${b.id}`}
                          >
                            {b.papel_usuario}
                          </Badge>
                        )}
                        {b.objetivo_alianca && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground border-border/70 bg-muted/30"
                            data-testid={`badge-objetivo-${b.id}`}
                          >
                            {b.objetivo_alianca}
                          </Badge>
                        )}
                        {b.destinacao && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"
                            data-testid={`badge-destinacao-${b.id}`}
                          >
                            {b.destinacao}
                          </Badge>
                        )}
                      </div>
                    )}

                    {b.localizacao && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{b.localizacao}</span>
                      </div>
                    )}

                    <div className="pt-1 border-t border-border/40 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Investido</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`investido-usuario-${b.id}`}>
                          {n(b.investimento_usuario_valor) > 0 ?fmt(n(b.investimento_usuario_valor), b.moeda || "BRL") : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">CPP</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`participacao-usuario-${b.id}`}>
                          {n(b.investimento_usuario_percentual) > 0 ?fmtPercent(n(b.investimento_usuario_percentual)) : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Receita</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`receita-usuario-${b.id}`}>
                          {n(b.receita_usuario_valor) > 0 ?fmt(n(b.receita_usuario_valor), b.moeda || "BRL") : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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
                onClick={() => navigate("/opas")}
                data-testid="link-ver-convergencias"
              >
                Ver OPAs <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {!isLoading && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Card className="border border-border/60 lg:col-span-1">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-foreground">Nº de OPAs Convergentes vs Nº de Interesses Manifestados</p>
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
                  subtitle="OPAs convergentes / total de OPAs nos últimos 12 meses"
                />
                <MetricCard
                  title="Taxa de interesse"
                  value={fmtPercent(dashboardStats.taxa_interesse)}
                  subtitle="Interesses manifestados / OPAs convergentes"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_150px] gap-2">
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
                  <p className="text-sm text-muted-foreground">Nenhuma OPA convergente com suas áreas de contribuição.</p>
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
                    onClick={() => navigate(`/opas/${opa.id}`)}
                    data-testid={`card-convergencia-${opa.id}`}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                          {opa.nome_oportunidade || "OPA sem nome"}
                        </p>
                        {opa.tipo && (
                          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
                            {opa.tipo}
                          </Badge>
                        )}
                      </div>
                      {(opa.nucleo_alianca || opa.nome_bia_vinculada) && (
                        <div className="flex flex-wrap gap-1.5">
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
                          <p className="text-[10px] text-muted-foreground">Valor da OPA</p>
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

        <TabsContent value="opas" className="space-y-4 mt-0">
          {/* OPAs de Interesse */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-600" />
                OPAs com Interesse Manifestado
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => navigate("/opas")}
                data-testid="link-ver-opas"
              >
                Ver todas <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {isLoading ?(
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : opas.length === 0 ?(
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-5 text-center">
                  <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma OPA de interesse registrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {opas.filter(o => o.status !== "concluida" && o.status !== "desistencia").slice(0, 5).map(o => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-blue-500/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/opas/${o.id}`)}
                    data-testid={`item-opa-${o.id}`}
                  >
                    <Target className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {o.nome_oportunidade || "OPA sem nome"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {[
                          o.tipo,
                          n(o.valor_origem_opa) > 0 ?fmt(n(o.valor_origem_opa)) : null,
                          o.nome_bia_vinculada ?`BIA: ${o.nome_bia_vinculada}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {o.status && o.status !== "concluida" && o.status !== "desistencia" ?(
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px] shrink-0 h-4">
                        Aberta
                      </Badge>
                    ) : o.status === "concluida" ?(
                      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[9px] shrink-0 h-4">
                        Concluída
                      </Badge>
                    ) : o.status === "desistencia" ?(
                      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[9px] shrink-0 h-4">
                        Desistência
                      </Badge>
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                ))}
                {opasAbertas > 5 && (
                  <button
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => navigate("/opas")}
                    data-testid="btn-mais-opas"
                  >
                    +{opasAbertas - 5} mais
                  </button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gestao" className="space-y-4 mt-0">
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
        </TabsContent>
      </Tabs>

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

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tipo de convite</p>
            <Select value={conviteTipo} onValueChange={handleConviteTipoChange}>
              <SelectTrigger data-testid="select-dashboard-tipo-convite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meuConvite?.tipo && (
              <p className="text-[11px] text-muted-foreground">
                Link ativo: {INVITE_TYPE_LABELS[meuConvite.tipo] || "BUILT Vitrine"}
              </p>
            )}
          </div>

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
                    const copied = await copyTextToClipboard(formatBuiltInviteMessage(meuConviteLink));
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
              <InviteQrCode link={meuConviteLink} variant="light" />
              <button
                type="button"
                onClick={() => gerarConviteMutation.mutate({ force: true, tipo: conviteTipo })}
                disabled={gerarConviteMutation.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                data-testid="btn-dashboard-renovar-convite"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gerarConviteMutation.isPending ?"animate-spin" : ""}`} />
                Gerar novo link
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center space-y-3">
              <Ticket className="w-7 h-7 text-blue-600/70 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum link ativo no momento.</p>
              <Button
                onClick={() => gerarConviteMutation.mutate({ force: false, tipo: conviteTipo })}
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


