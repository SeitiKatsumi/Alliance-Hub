import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuraScore } from "@/components/aura-score";
import { FuturisticChart } from "@/components/futuristic-chart";
import { AIAssistant } from "@/components/ai-assistant";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  Target,
  Wallet,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  MapPin,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PainelPage() {
  const { data: bias = [], isLoading: loadingBias } = useQuery<any[]>({ queryKey: ["/api/bias"] });
  const { data: oportunidades = [], isLoading: loadingOpas } = useQuery<any[]>({ queryKey: ["/api/oportunidades"] });
  const { data: fluxo = [], isLoading: loadingFluxo } = useQuery<any[]>({ queryKey: ["/api/fluxo-caixa"] });

  const biasStats = useMemo(() => {
    const totalValor = bias.reduce((sum: number, b: any) => sum + (parseFloat(b.valor_origem) || 0), 0);
    const porObjetivo = bias.reduce((acc: Record<string, number>, b: any) => {
      const obj = b.objetivo_alianca || "Outro";
      acc[obj] = (acc[obj] || 0) + 1;
      return acc;
    }, {});
    return { totalValor, porObjetivo, total: bias.length };
  }, [bias]);

  const opasStats = useMemo(() => {
    const totalValor = oportunidades.reduce((sum: number, o: any) => sum + (parseFloat(o.valor_origem_opa) || 0), 0);
    const porTipo: Record<string, { count: number; valor: number }> = {};
    oportunidades.forEach((o: any) => {
      const tipo = o.tipo || "Outro";
      if (!porTipo[tipo]) porTipo[tipo] = { count: 0, valor: 0 };
      porTipo[tipo].count++;
      porTipo[tipo].valor += parseFloat(o.valor_origem_opa) || 0;
    });
    return { totalValor, porTipo, total: oportunidades.length };
  }, [oportunidades]);

  const fluxoStats = useMemo(() => {
    const entradas = fluxo.filter((f: any) => f.tipo === "entrada");
    const saidas = fluxo.filter((f: any) => f.tipo === "saida");
    const totalEntradas = entradas.reduce((sum: number, f: any) => sum + (parseFloat(f.valor) || 0), 0);
    const totalSaidas = saidas.reduce((sum: number, f: any) => sum + (parseFloat(f.valor) || 0), 0);
    const saldo = totalEntradas - totalSaidas;

    const porBia: Record<string, { entradas: number; saidas: number; nome: string }> = {};
    fluxo.forEach((f: any) => {
      const biaId = f.bia;
      if (!biaId) return;
      if (!porBia[biaId]) {
        const biaObj = bias.find((b: any) => b.id === biaId);
        porBia[biaId] = { entradas: 0, saidas: 0, nome: biaObj?.nome_bia || biaId.slice(0, 8) };
      }
      const val = parseFloat(f.valor) || 0;
      if (f.tipo === "entrada") porBia[biaId].entradas += val;
      else porBia[biaId].saidas += val;
    });

    return { totalEntradas, totalSaidas, saldo, total: fluxo.length, porBia };
  }, [fluxo, bias]);

  const auraScore = 78;

  const opaChartData = useMemo(() => {
    const colors = ["#001D34", "#D7BB7D", "#6A7984", "#B5A275", "#34576E"];
    return Object.entries(opasStats.porTipo).map(([tipo, data], i) => ({
      label: tipo,
      value: data.count,
      color: colors[i % colors.length],
    }));
  }, [opasStats]);

  const fluxoChartData = useMemo(() => {
    return Object.values(fluxoStats.porBia).map((b) => ({
      label: b.nome.length > 15 ? b.nome.slice(0, 15) + "…" : b.nome,
      value: b.entradas - b.saidas,
    }));
  }, [fluxoStats]);

  const isLoading = loadingBias || loadingOpas || loadingFluxo;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">
            Meu Dashboard
          </h1>
          <p className="text-muted-foreground">Visão geral do ecossistema Built Alliances</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-brand-navy/20 bg-gradient-to-br from-brand-navy/5 via-transparent to-brand-gold/5 overflow-hidden relative" data-testid="card-bias-dashboard">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-navy/10 border border-brand-navy/20">
                <Briefcase className="w-5 h-5 text-brand-navy" />
              </div>
              <div className="flex-1">
                <span className="text-base">Minhas BIAs</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Projetos de aliança ativos</p>
              </div>
              <Link href="/bias">
                <Badge variant="outline" className="cursor-pointer hover:bg-brand-navy/10 transition-colors text-xs gap-1" data-testid="link-bias">
                  Ver todas <ExternalLink className="w-3 h-3" />
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-brand-navy/5 border border-brand-navy/10">
                    <p className="text-3xl font-bold text-brand-navy" data-testid="text-bias-count">{biasStats.total}</p>
                    <p className="text-xs text-muted-foreground">Projetos</p>
                  </div>
                  <div className="p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                    <p className="text-lg font-bold text-brand-navy" data-testid="text-bias-valor">
                      {biasStats.totalValor > 0 ? formatBRL(biasStats.totalValor) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Valor Total Origem</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {bias.slice(0, 4).map((b: any) => (
                    <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="w-1.5 h-8 rounded-full bg-brand-gold" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-bia-name-${b.id}`}>{b.nome_bia}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {b.localizacao && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" /> {b.localizacao}
                            </span>
                          )}
                          {b.objetivo_alianca && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{b.objetivo_alianca}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-brand-gold/20 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-navy/5 overflow-hidden relative" data-testid="card-opas-dashboard">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-navy/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                <Target className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="flex-1">
                <span className="text-base">Minhas OPAs</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Oportunidades de aliança</p>
              </div>
              <Link href="/opas">
                <Badge variant="outline" className="cursor-pointer hover:bg-brand-gold/10 transition-colors text-xs gap-1" data-testid="link-opas">
                  Ver todas <ExternalLink className="w-3 h-3" />
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                    <p className="text-3xl font-bold text-brand-navy" data-testid="text-opas-count">{opasStats.total}</p>
                    <p className="text-xs text-muted-foreground">Oportunidades</p>
                  </div>
                  <div className="p-3 rounded-xl bg-brand-navy/5 border border-brand-navy/10">
                    <p className="text-lg font-bold text-brand-navy" data-testid="text-opas-valor">
                      {formatBRL(opasStats.totalValor)}
                    </p>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                  </div>
                </div>
                {opaChartData.length > 0 && (
                  <FuturisticChart data={opaChartData} type="radial" height={130} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border border-brand-navy/20 bg-gradient-to-r from-brand-navy/5 via-transparent to-brand-gold/5 overflow-hidden relative" data-testid="card-fluxo-dashboard">
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-gold/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-navy/10 to-brand-gold/10 border border-brand-navy/20">
                <Wallet className="w-5 h-5 text-brand-navy" />
              </div>
              <div className="flex-1">
                <span className="text-base">Fluxo de Caixa</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Panorama financeiro das BIAs</p>
              </div>
              <Link href="/fluxo-caixa">
                <Badge variant="outline" className="cursor-pointer hover:bg-brand-navy/10 transition-colors text-xs gap-1" data-testid="link-fluxo">
                  Detalhar <ExternalLink className="w-3 h-3" />
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4 space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-muted-foreground">Entradas</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-700" data-testid="text-fluxo-entradas">{formatBRL(fluxoStats.totalEntradas)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownCircle className="w-4 h-4 text-red-600" />
                      <span className="text-xs text-muted-foreground">Saídas</span>
                    </div>
                    <p className="text-xl font-bold text-red-700" data-testid="text-fluxo-saidas">{formatBRL(fluxoStats.totalSaidas)}</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${fluxoStats.saldo >= 0 ? "bg-brand-gold/10 border-brand-gold/20" : "bg-red-500/10 border-red-500/20"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className={`w-4 h-4 ${fluxoStats.saldo >= 0 ? "text-brand-gold" : "text-red-600"}`} />
                      <span className="text-xs text-muted-foreground">Saldo</span>
                    </div>
                    <p className={`text-xl font-bold ${fluxoStats.saldo >= 0 ? "text-brand-navy" : "text-red-700"}`} data-testid="text-fluxo-saldo">
                      {formatBRL(fluxoStats.saldo)}
                    </p>
                  </div>
                </div>
                <div className="md:col-span-8">
                  {fluxoChartData.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Saldo por BIA</p>
                      <FuturisticChart data={fluxoChartData} type="bar" height={180} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Nenhum lançamento registrado
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-brand-gold/20 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-navy/5 overflow-hidden relative" data-testid="card-aura-dashboard">
          <div className="absolute top-0 left-0 w-24 h-24 bg-brand-gold/10 rounded-full -translate-y-1/2 -translate-x-1/2" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                <Sparkles className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="flex-1">
                <span className="text-base">Minha Aura</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Score de engajamento</p>
              </div>
              <Link href="/aura">
                <Badge variant="outline" className="cursor-pointer hover:bg-brand-gold/10 transition-colors text-xs gap-1" data-testid="link-aura">
                  Detalhes <ExternalLink className="w-3 h-3" />
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-4">
            <AuraScore score={auraScore} size="lg" />
            <div className="grid grid-cols-3 gap-4 w-full mt-2">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-brand-navy">{biasStats.total}</p>
                <p className="text-[10px] text-muted-foreground uppercase">BIAs</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-brand-navy">{opasStats.total}</p>
                <p className="text-[10px] text-muted-foreground uppercase">OPAs</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-brand-navy">{fluxoStats.total}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Lançamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div data-testid="card-ai-dashboard">
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}
