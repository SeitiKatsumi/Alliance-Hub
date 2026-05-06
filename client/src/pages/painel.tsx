import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase, Globe, Users, TrendingUp, TrendingDown,
  MapPin, LayoutDashboard, Building2,
  Target, Wallet, ChevronRight, Sparkles,
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
}

interface DashboardData {
  bias: DashboardBia[];
  comunidades: DashboardComunidade[];
  opas: DashboardOpa[];
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
  const totals = data?.totals ?? { valor_origem: 0, custo_final_previsto: 0, resultado_liquido: 0 };
  const opasAbertas = data?.opas_abertas ?? opas.filter(o => o.status !== "concluida" && o.status !== "desistencia").length;

  const biasAtivas = bias.filter(b => b.situacao === "ativa").length;

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
                <p className="text-[11px] text-muted-foreground mt-0.5">{opas.length} total nas suas BIAs</p>
              </CardContent>
            </Card>

            <Card
              className="border border-border/60 cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              onClick={() => navigate("/comunidade")}
              data-testid="stat-card-comunidades"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">Comunidades</span>
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-value-comunidades">
                  {comunidades.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">vinculadas</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60" data-testid="stat-card-valor">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-[#D7BB7D]" />
                  <span className="text-xs text-muted-foreground">Valor de Origem</span>
                </div>
                <p className="text-lg font-bold text-foreground tabular-nums leading-tight" data-testid="stat-value-vorigem">
                  {fmt(totals.valor_origem)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">total consolidado</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Minhas BIAs - 2 cols */}
        <div className="lg:col-span-2 space-y-4">
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bias.map(b => (
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

                    <div className="pt-1 border-t border-border/40 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Valor de Origem</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`valor-origem-${b.id}`}>
                          {n(b.valor_origem) > 0 ? fmt(n(b.valor_origem), b.moeda || "BRL") : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Custo Final Prev.</p>
                        <p className="text-xs font-medium tabular-nums" data-testid={`custo-final-${b.id}`}>
                          {n(b.custo_final_previsto) > 0 ? fmt(n(b.custo_final_previsto), b.moeda || "BRL") : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Aura Percebida */}
          {user?.membro_directus_id && (
            <Card
              className="border cursor-pointer hover:border-[#D7BB7D]/40 transition-colors"
              style={{ borderColor: auraData?.score != null ? `${getFaixaColor(auraData.score)}30` : "rgba(255,255,255,0.08)" }}
              onClick={() => navigate("/aura")}
              data-testid="card-aura-painel"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D7BB7D]" />
                    Aura Percebida
                  </h2>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                </div>
                <div className="flex items-center gap-4">
                  <AuraScore score={auraData?.score ?? null} size="sm" showLabel={false} />
                  <div className="flex-1 space-y-1.5">
                    {auraData?.score != null ? (
                      <>
                        <p className="text-xs font-medium" style={{ color: getFaixaColor(auraData.score) }}>{auraData.faixa}</p>
                        {[
                          { label: "Téc.", val: auraData.T ?? 0, color: "#3B82F6" },
                          { label: "Rel.", val: auraData.R ?? 0, color: "#22C55E" },
                          { label: "Com.", val: auraData.C ?? 0, color: "#D7BB7D" },
                        ].map(d => (
                          <div key={d.label} className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-7 shrink-0">{d.label}</span>
                            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.val}%`, background: d.color }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{d.val}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground">Aguardando avaliações</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Minhas Comunidades */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#D7BB7D]" />
                Minhas Comunidades
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => navigate("/comunidade")}
                data-testid="link-ver-comunidades"
              >
                Ver <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="border border-border/60">
                    <CardContent className="p-3 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : comunidades.length === 0 ? (
              <Card className="border border-dashed border-border/60">
                <CardContent className="p-5 text-center">
                  <Globe className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma comunidade vinculada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {comunidades.map(c => {
                  const nMembros = Array.isArray(c.membros) ? c.membros.length : 0;
                  const nBias = Array.isArray(c.bias) ? c.bias.length : 0;
                  const territory = [c.sigla_territorio, c.pais].filter(Boolean).join(" · ");
                  return (
                    <Card
                      key={c.id}
                      className="border border-border/60 hover:border-[#D7BB7D]/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/comunidade/${c.id}`)}
                      data-testid={`card-comunidade-${c.id}`}
                    >
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{c.nome || "Comunidade"}</p>
                          {c.sigla && (
                            <span className="text-[10px] font-mono text-[#D7BB7D] shrink-0">{c.sigla}</span>
                          )}
                        </div>
                        {territory && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{territory}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {nMembros} membros
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {nBias} BIAs
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

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
                  <p className="text-xs text-muted-foreground">Nenhuma OPA nas suas BIAs.</p>
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
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#D7BB7D]" />
          Resumo Financeiro Consolidado
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/60" data-testid="resumo-valor-origem">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Valor de Origem Total</span>
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {fmt(totals.valor_origem)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">soma de todas as BIAs</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60" data-testid="resumo-custo-final">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-muted-foreground">Custo Final Previsto</span>
                </div>
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {fmt(totals.custo_final_previsto)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">CPP consolidado</p>
              </CardContent>
            </Card>

            <Card
              className={`border ${totals.resultado_liquido >= 0 ? "border-emerald-500/30" : "border-red-500/30"}`}
              data-testid="resumo-resultado-liquido"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className={`w-4 h-4 ${totals.resultado_liquido >= 0 ? "text-emerald-400" : "text-red-400"}`} />
                  <span className="text-xs text-muted-foreground">Resultado Líquido</span>
                </div>
                <p className={`text-xl font-bold tabular-nums ${totals.resultado_liquido >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {fmt(totals.resultado_liquido)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">resultado consolidado</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
