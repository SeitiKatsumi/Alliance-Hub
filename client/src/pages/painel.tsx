import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase, Globe, Users, TrendingUp, TrendingDown,
  MapPin, LayoutDashboard, Building2,
  Target, Wallet, ChevronRight, Sparkles, Search, SlidersHorizontal,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AuraScore, getFaixaColor } from "@/components/aura-score";

interface DashboardBia {
  id: string;
  nome_bia: string;
  situacao?: "ativa" | "em_formacao" | null;
  objetivo_alianca?: string | null;
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
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 1,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function normalizeText(value?: string | number | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  const redes: string[] = Array.isArray(user.Outras_redes_as_quais_pertenco) ? user.Outras_redes_as_quais_pertenco : [];
  if (redes.includes("BUILT_FOUNDING_MEMBER") || redes.includes("BUILT_ALLIANCE_PARTNER")) return "Aliado BUILT";
  const tipos: string[] = Array.isArray(user.tipos_alianca) ? user.tipos_alianca : [];
  if (tipos.includes("Liderança")) return "Diretor de Aliança";
  if (user.role === "admin") return "Administrador";
  if (user.role === "manager") return "Gestor";
  return null;
}

export default function PainelPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  const { data: auraData } = useQuery<{ score: number | null; T: number | null; R: number | null; C: number | null; n: number; faixa: string | null }>({
    queryKey: ["/api/aura/score", user?.membro_directus_id],
    enabled: !!user?.membro_directus_id,
  });

  const bias = data?.bias ?? [];
  const comunidades = data?.comunidades ?? [];
  const opas = data?.opas ?? [];
  const convergencias = data?.convergencias ?? [];
  const [biaSearch, setBiaSearch] = useState("");
  const [biaSituacao, setBiaSituacao] = useState("__all__");
  const [biaPapel, setBiaPapel] = useState("__all__");
  const [convergenciaSearch, setConvergenciaSearch] = useState("");
  const [convergenciaTipo, setConvergenciaTipo] = useState("__all__");
  const [convergenciaNucleo, setConvergenciaNucleo] = useState("__all__");
  const totals = data?.totals ?? { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 };
  const opasAbertas = data?.opas_abertas ?? opas.filter(o => o.status !== "concluida" && o.status !== "desistencia").length;

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
  const comunidadeLabel = comunidades.length > 0 ? comunidades[0].nome : null;

  const avatarInitials = nomeExibido
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-[#D7BB7D]/30" data-testid="avatar-profile">
            {user?.foto_perfil && (
              <AvatarImage src={user.foto_perfil} alt={nomeExibido} />
            )}
            <AvatarFallback className="bg-[#D7BB7D]/15 text-[#D7BB7D] text-sm font-semibold">
              {avatarInitials || <LayoutDashboard className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {greeting()}, {nomeExibido}
            </h1>
          </div>
        </div>
        <div className="pl-[52px] flex flex-wrap items-center gap-2">
          {roleLabel && (
            <Badge
              variant="outline"
              className="text-[11px] text-[#D7BB7D] border-[#D7BB7D]/40 bg-[#D7BB7D]/5"
              data-testid="badge-role"
            >
              {roleLabel}
            </Badge>
          )}
          {comunidadeLabel && (
            <Badge
              variant="outline"
              className="text-[11px] text-muted-foreground border-border/60"
              data-testid="badge-comunidade"
            >
              {comunidadeLabel}
            </Badge>
          )}
          {!roleLabel && !comunidadeLabel && (
            <p className="text-sm text-muted-foreground">
              Visão geral da sua atividade na plataforma Built Alliances.
            </p>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <Card
              className="border border-border/60 cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              onClick={() => navigate("/bias")}
              data-testid="stat-card-bias"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">BIAs ativas</span>
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-value-bias">
                  {biasAtivas}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{bias.length} total</p>
              </CardContent>
            </Card>

            <Card
              className="border border-border/60 cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              onClick={() => navigate("/opas")}
              data-testid="stat-card-opas"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">OPAs abertas</span>
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-value-opas">
                  {opasAbertas}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opas.length} com interesse</p>
              </CardContent>
            </Card>

            <Card
              className="border border-border/60 cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              onClick={() => navigate(comunidades[0]?.id ? `/comunidade/${comunidades[0].id}` : "/comunidade")}
              data-testid="stat-card-comunidades"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">Minha Comunidade</span>
                </div>
                <div className="space-y-0.5" data-testid="stat-value-comunidades">
                  <p className="text-base font-bold text-foreground truncate">
                    {comunidades[0]?.nome || "-"}
                  </p>
                  {comunidades[0]?.sigla && (
                    <p className="text-[10px] font-mono text-[#D7BB7D] truncate">
                      {comunidades[0].sigla}
                    </p>
                  )}
                </div>
                {comunidades[0] ? (
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {Array.isArray(comunidades[0].membros) ? comunidades[0].membros.length : 0} membros
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {Array.isArray(comunidades[0].bias) ? comunidades[0].bias.length : 0} BIAs
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">nenhuma comunidade</p>
                )}
              </CardContent>
            </Card>

            <Card
              className="border border-border/60 cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              style={{ borderColor: auraData?.score != null ? `${getFaixaColor(auraData.score)}30` : undefined }}
              onClick={() => navigate("/aura")}
              data-testid="stat-card-aura"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">Aura Percebida</span>
                </div>
                <div className="flex items-center gap-3">
                  <AuraScore score={auraData?.score ?? null} size="sm" showLabel={false} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: auraData?.score != null ? getFaixaColor(auraData.score) : undefined }}>
                      {auraData?.score != null ? auraData.faixa : "Aguardando avaliações"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {auraData?.score != null ? "resultado atual" : "sem avaliações"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Dashboard tabs */}
      <Tabs defaultValue="bias" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-muted/40 p-1 sm:grid-cols-3">
          <TabsTrigger value="bias" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-bias">
            <Briefcase className="w-4 h-4" />
            Minhas BIAs
          </TabsTrigger>
          <TabsTrigger value="convergencias" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-convergencias">
            <Target className="w-4 h-4" />
            Painel de Convergências
          </TabsTrigger>
          <TabsTrigger value="opas" className="gap-2 text-xs sm:text-sm" data-testid="tab-dashboard-opas">
            <Target className="w-4 h-4" />
            Minhas OPAs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bias" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#D7BB7D]" />
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

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <BiaCardSkeleton key={i} />)}
            </div>
          ) : bias.length === 0 ? (
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
          ) : filteredBias.length === 0 ? (
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
                  className="border border-border/60 hover:border-[#D7BB7D]/40 cursor-pointer transition-colors"
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

                    {(b.papel_usuario || b.objetivo_alianca) && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.papel_usuario && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-[#D7BB7D] border-[#D7BB7D]/40 bg-[#D7BB7D]/5"
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
                          {n(b.investimento_usuario_valor) > 0 ? fmt(n(b.investimento_usuario_valor), b.moeda || "BRL") : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">CPP</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`participacao-usuario-${b.id}`}>
                          {n(b.investimento_usuario_percentual) > 0 ? fmtPercent(n(b.investimento_usuario_percentual)) : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Receita</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`receita-usuario-${b.id}`}>
                          {n(b.receita_usuario_valor) > 0 ? fmt(n(b.receita_usuario_valor), b.moeda || "BRL") : "-"}
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
                <Target className="w-4 h-4 text-[#D7BB7D]" />
                Painel de Convergências
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

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <BiaCardSkeleton key={i} />)}
              </div>
            ) : convergencias.length === 0 ? (
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-6 text-center space-y-2">
                  <Target className="w-7 h-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma OPA convergente com suas áreas de contribuição.</p>
                  <p className="text-xs text-muted-foreground/70">Atualize suas áreas em Meu Perfil para melhorar as recomendações.</p>
                </CardContent>
              </Card>
            ) : filteredConvergencias.length === 0 ? (
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
                    className="border border-border/60 hover:border-[#D7BB7D]/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/opas/${opa.id}`)}
                    data-testid={`card-convergencia-${opa.id}`}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                          {opa.nome_oportunidade || "OPA sem nome"}
                        </p>
                        {opa.tipo && (
                          <Badge variant="outline" className="text-[10px] text-[#D7BB7D] border-[#D7BB7D]/40 bg-[#D7BB7D]/5">
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
                            {n(opa.valor_origem_opa) > 0 ? fmt(n(opa.valor_origem_opa)) : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Mín. esforço</p>
                          <p className="text-xs font-medium tabular-nums">
                            {n(opa.Minimo_esforco_multiplicador) > 0 ? fmtPercent(n(opa.Minimo_esforco_multiplicador)) : "-"}
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
          {/* Minhas OPAs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-[#D7BB7D]" />
                Minhas OPAs
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

            {isLoading ? (
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
            ) : opas.length === 0 ? (
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-5 text-center">
                  <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma OPA com interesse manifestado.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {opas.filter(o => o.status !== "concluida" && o.status !== "desistencia").slice(0, 5).map(o => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-[#D7BB7D]/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/opas/${o.id}`)}
                    data-testid={`item-opa-${o.id}`}
                  >
                    <Target className="w-3.5 h-3.5 text-[#D7BB7D] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {o.nome_oportunidade || "OPA sem nome"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {[
                          o.tipo,
                          n(o.valor_origem_opa) > 0 ? fmt(n(o.valor_origem_opa)) : null,
                          o.nome_bia_vinculada ? `BIA: ${o.nome_bia_vinculada}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {o.status && o.status !== "concluida" && o.status !== "desistencia" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px] shrink-0 h-4">
                        Aberta
                      </Badge>
                    ) : o.status === "concluida" ? (
                      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[9px] shrink-0 h-4">
                        Concluída
                      </Badge>
                    ) : o.status === "desistencia" ? (
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
      </Tabs>

    </div>
  );
}
