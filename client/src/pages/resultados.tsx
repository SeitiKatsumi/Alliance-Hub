import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign,
  Percent, PiggyBank, Receipt, Landmark, ArrowUpCircle,
  ArrowDownCircle, Target, Layers, Save
} from "lucide-react";

// ---- Types ----
interface BiasProjeto {
  id: string;
  nome_bia: string;
  valor_origem?: string | number;
  custo_final_previsto?: string | number;
  custo_origem_bia?: string | number;
  valor_geral_venda_vgv?: string | number;
  valor_realizado_venda?: string | number;
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  total_receita?: string | number;
  total_aportes?: string | number;
  comissao_realizada?: string | number;
  ir_realizado?: string | number;
  inss_realizado?: string | number;
  manutencao_realizada?: string | number;
  moeda?: string | null;
}

interface FluxoItem {
  id: string;
  bia: string;
  tipo: "entrada" | "saida";
  valor: string | number;
  status?: string;
}

// ---- Helpers ----
function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLToNumber(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
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

function pct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function colorClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

// ---- Sub-components ----
function MetricCard({
  label, value, sub, icon: Icon, color = "text-brand-gold", border = "border-brand-gold/30", highlight = false
}: {
  label: string; value: string; sub?: string;
  icon: any; color?: string; border?: string; highlight?: boolean;
}) {
  return (
    <Card className={`${border} ${highlight ? "bg-gradient-to-br from-brand-gold/5 to-transparent" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`w-4 h-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function RowItem({ label, value, sub, positive, currency = "BRL" }: { label: string; value: number; sub?: string; positive?: boolean; currency?: string }) {
  const cls = positive !== undefined ? (positive ? "text-green-600" : "text-red-600") : colorClass(value);
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${cls}`}>{formatMoney(value, currency)}</span>
    </div>
  );
}

// ---- Main Page ----
export default function ResultadosPage() {
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");
  const { toast } = useToast();

  // Receita editável (string BRL formatada)
  const [vgvEdit, setVgvEdit] = useState("");
  const [valorRealizadoEdit, setValorRealizadoEdit] = useState("");

  // Realized percentage states
  const [comissaoRealPct, setComissaoRealPct] = useState(0);
  const [irRealPct, setIrRealPct] = useState(0);
  const [inssRealPct, setInssRealPct] = useState(0);
  const [manutRealPct, setManutRealPct] = useState(0);

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: fluxoRaw = [], isLoading: loadingFluxo } = useQuery<FluxoItem[]>({
    queryKey: ["/api/fluxo-caixa"],
  });

  // Auto-select the last used BIA (or first in list)
  useEffect(() => {
    if ((biasRaw as BiasProjeto[]).length > 0 && !selectedBiaId) {
      const lastUsed = localStorage.getItem("resultados-bia-id");
      const found = lastUsed ? (biasRaw as BiasProjeto[]).find((b) => b.id === lastUsed) : null;
      setSelectedBiaId(found ? lastUsed! : (biasRaw as BiasProjeto[])[0].id);
    }
  }, [biasRaw, selectedBiaId]);

  const bia = useMemo(
    () => (biasRaw as BiasProjeto[]).find((b) => b.id === selectedBiaId),
    [biasRaw, selectedBiaId]
  );

  // Load editable values when BIA changes
  useEffect(() => {
    if (bia) {
      const vgvNum = n(bia.valor_geral_venda_vgv);
      const vrNum = n(bia.valor_realizado_venda);
      setVgvEdit(vgvNum > 0 ? formatInputBRL(String(Math.round(vgvNum * 100))) : "");
      setValorRealizadoEdit(vrNum > 0 ? formatInputBRL(String(Math.round(vrNum * 100))) : "");
      setComissaoRealPct(n(bia.comissao_realizada));
      setIrRealPct(n(bia.ir_realizado));
      setInssRealPct(n(bia.inss_realizado));
      setManutRealPct(n(bia.manutencao_realizada));
    }
  }, [bia?.id]);

  function handleBiaChange(id: string) {
    setSelectedBiaId(id);
    localStorage.setItem("resultados-bia-id", id);
  }

  // Save realized deductions to Directus
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBiaId) throw new Error("Selecione uma BIA");
      await apiRequest("PATCH", `/api/bias/${selectedBiaId}`, {
        valor_geral_venda_vgv: parseBRLToNumber(vgvEdit),
        valor_realizado_venda: parseBRLToNumber(valorRealizadoEdit),
        comissao_realizada: comissaoRealPct,
        ir_realizado: irRealPct,
        inss_realizado: inssRealPct,
        manutencao_realizada: manutRealPct,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      toast({ title: "Salvo", description: "Valores realizados atualizados." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Soma de aportes pagos no fluxo de caixa desta BIA
  const totalAportesPagos = useMemo(() => {
    if (!selectedBiaId) return 0;
    return (fluxoRaw as FluxoItem[])
      .filter((i) => i.bia === selectedBiaId && i.tipo === "entrada" && i.status === "pago")
      .reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
  }, [fluxoRaw, selectedBiaId]);

  // Soma de saídas pagas
  const totalSaidasPagas = useMemo(() => {
    if (!selectedBiaId) return 0;
    return (fluxoRaw as FluxoItem[])
      .filter((i) => i.bia === selectedBiaId && i.tipo === "saida" && i.status === "pago")
      .reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
  }, [fluxoRaw, selectedBiaId]);

  // ---- Cálculos ----
  const vgv                 = parseBRLToNumber(vgvEdit);
  const valorRealizado      = parseBRLToNumber(valorRealizadoEdit);
  const custoCPP            = n(bia?.custo_final_previsto);
  const custoOrigem         = n(bia?.custo_origem_bia);
  const valorOrigem         = n(bia?.valor_origem);

  // Previsto (%)
  const comissaoPct         = n(bia?.comissao_prevista_corretor);
  const irPct               = n(bia?.ir_previsto);
  const inssPct             = n(bia?.inss_previsto);
  const manutencaoPct       = n(bia?.manutencao_pos_obra_prevista);

  // Previsto (valores BRL)
  const comissaoPrev    = (comissaoPct  / 100) * valorRealizado;
  const irPrev          = (irPct        / 100) * valorRealizado;
  const inssPrev        = (inssPct      / 100) * valorRealizado;
  const manutPrev       = (manutencaoPct / 100) * valorRealizado;
  const totalDeducoesPrev = comissaoPrev + irPrev + inssPrev + manutPrev;

  // Realizado (valores BRL — usa os estados editáveis)
  const comissaoReal    = (comissaoRealPct  / 100) * valorRealizado;
  const irReal          = (irRealPct        / 100) * valorRealizado;
  const inssReal        = (inssRealPct      / 100) * valorRealizado;
  const manutReal       = (manutRealPct     / 100) * valorRealizado;
  const totalDeducoesReal = comissaoReal + irReal + inssReal + manutReal;

  // Resultado usando deduções realizadas
  const receitaLiquida = valorRealizado - totalDeducoesReal;
  const resultadoLiquido = receitaLiquida - custoCPP;
  const lucroValor = resultadoLiquido - totalSaidasPagas;
  const roi = totalSaidasPagas > 0 ? ((resultadoLiquido - totalSaidasPagas) / totalSaidasPagas) * 100 : 0;
  const multiplo = totalSaidasPagas > 0 ? resultadoLiquido / totalSaidasPagas : 0;
  const percVGV = vgv > 0 ? (valorRealizado / vgv) * 100 : 0;
  const caixaLiquidoReal = totalAportesPagos - totalSaidasPagas;

  const loading = loadingBias || loadingFluxo;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <BarChart3 className="w-6 h-6" />
            </div>
            Análises
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Análise de retorno e performance por BIA</p>
        </div>

        <Select value={selectedBiaId} onValueChange={handleBiaChange}>
          <SelectTrigger className="w-[300px]" data-testid="select-bia">
            <SelectValue placeholder="Selecione uma BIA..." />
          </SelectTrigger>
          <SelectContent>
            {(biasRaw as BiasProjeto[]).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedBiaId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma BIA para ver os resultados</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Análise completa de retorno sobre o investimento</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Resultado Líquido"
              value={formatMoney(resultadoLiquido, bia?.moeda || "BRL")}
              icon={resultadoLiquido >= 0 ? TrendingUp : TrendingDown}
              color={resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}
              border={resultadoLiquido >= 0 ? "border-green-500/30" : "border-red-500/30"}
              highlight
            />
            <MetricCard
              label="Lucro"
              value={formatMoney(lucroValor, bia?.moeda || "BRL")}
              icon={Percent}
              color={lucroValor >= 0 ? "text-brand-gold" : "text-red-600"}
              border="border-brand-gold/30"
              highlight
            />
            <MetricCard
              label="ROI"
              value={pct(roi)}
              icon={Target}
              color={roi >= 0 ? "text-blue-600" : "text-red-600"}
              border="border-blue-500/30"
            />
            <MetricCard
              label="Múltiplo do Capital"
              value={`${multiplo.toFixed(2)}x`}
              icon={Layers}
              color={multiplo >= 1 ? "text-green-600" : "text-red-600"}
              border="border-green-500/30"
            />
          </div>

          {/* Linha 2 — métricas secundárias */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total de Aportes"
              value={formatMoney(totalAportesPagos, bia?.moeda || "BRL")}
              sub="entradas pagas no caixa"
              icon={ArrowUpCircle}
              color="text-blue-600"
              border="border-blue-500/30"
            />
            <MetricCard
              label="Saídas Realizadas"
              value={formatMoney(totalSaidasPagas, bia?.moeda || "BRL")}
              sub="saídas pagas no caixa"
              icon={ArrowDownCircle}
              color="text-red-600"
              border="border-red-500/30"
            />
            <MetricCard
              label="Caixa Líquido Real"
              value={formatMoney(caixaLiquidoReal, bia?.moeda || "BRL")}
              sub="aportes − saídas pagas"
              icon={PiggyBank}
              color={caixaLiquidoReal >= 0 ? "text-green-600" : "text-red-600"}
              border={caixaLiquidoReal >= 0 ? "border-green-500/30" : "border-red-500/30"}
            />
            <MetricCard
              label="% VGV Realizado"
              value={pct(percVGV)}
              sub={`VGV: ${formatMoney(vgv, bia?.moeda || "BRL")}`}
              icon={DollarSign}
              color="text-purple-600"
              border="border-purple-500/30"
            />
          </div>

          {/* Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Investimento */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-500" /> Investimento (Custos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RowItem label="Valor de Origem" value={valorOrigem} positive={false} currency={bia?.moeda || "BRL"} />
                <RowItem label="Custo de Origem da BIA" sub="Origem + Divisor" value={custoOrigem} positive={false} currency={bia?.moeda || "BRL"} />
                <RowItem label="CPP Total (Custo Final)" sub="Soma dos percentuais" value={custoCPP} positive={false} currency={bia?.moeda || "BRL"} />
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Total Custos</span>
                  <span className="text-sm font-bold text-red-600 tabular-nums">{formatMoney(custoCPP, bia?.moeda || "BRL")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Receita */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" /> Receita
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-receita"
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* VGV */}
                <div className="py-2 border-b border-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">VGV (Valor Geral de Venda)</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={vgvEdit}
                      onChange={(e) => setVgvEdit(formatInputBRL(e.target.value))}
                      className="h-8 text-sm pl-8 text-green-600 font-semibold border-green-500/30 focus-visible:ring-green-500/30"
                      placeholder="0,00"
                      data-testid="input-vgv"
                    />
                  </div>
                </div>

                {/* Valor Realizado */}
                <div className="py-2 border-b border-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">Valor Realizado de Venda</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={valorRealizadoEdit}
                      onChange={(e) => setValorRealizadoEdit(formatInputBRL(e.target.value))}
                      className="h-8 text-sm pl-8 text-green-600 font-semibold border-green-500/30 focus-visible:ring-green-500/30"
                      placeholder="0,00"
                      data-testid="input-valor-realizado"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm font-semibold">Realizado vs VGV</span>
                  <Badge variant={percVGV >= 100 ? "default" : "secondary"} className="text-xs">
                    {pct(percVGV, 1)} do VGV
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Deduções — Previsto vs Realizado */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-orange-500" /> Deduções e Impostos
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-realizados"
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DeducaoRow
                  label="Comissão Corretor"
                  prevPct={comissaoPct}
                  prevVal={comissaoPrev}
                  realPct={comissaoRealPct}
                  onChangeReal={setComissaoRealPct}
                  realVal={comissaoReal}
                />
                <DeducaoRow
                  label="IR"
                  prevPct={irPct}
                  prevVal={irPrev}
                  realPct={irRealPct}
                  onChangeReal={setIrRealPct}
                  realVal={irReal}
                />
                <DeducaoRow
                  label="INSS"
                  prevPct={inssPct}
                  prevVal={inssPrev}
                  realPct={inssRealPct}
                  onChangeReal={setInssRealPct}
                  realVal={inssReal}
                />
                <DeducaoRow
                  label="Manutenção Pós Obra"
                  prevPct={manutencaoPct}
                  prevVal={manutPrev}
                  realPct={manutRealPct}
                  onChangeReal={setManutRealPct}
                  realVal={manutReal}
                />
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Total Deduções</span>
                  <span className="text-sm font-bold text-red-600 tabular-nums">{formatMoney(totalDeducoesReal, bia?.moeda || "BRL")}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo final */}
          <Card className="border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5 text-brand-gold" /> Resumo do Investimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <RowItem label="(+) Valor Realizado de Venda" value={valorRealizado} positive currency={bia?.moeda || "BRL"} />
                <RowItem label="(−) Custo Final CPP" value={-custoCPP} currency={bia?.moeda || "BRL"} />
                <RowItem label="(−) Total de Deduções (Realizado)" value={-totalDeducoesReal} currency={bia?.moeda || "BRL"} />
                <Separator className="my-3" />
                <div className="flex items-center justify-between py-2">
                  <span className="font-semibold">Resultado Líquido</span>
                  <span className={`text-xl font-bold tabular-nums ${colorClass(resultadoLiquido)}`}>
                    {formatMoney(resultadoLiquido, bia?.moeda || "BRL")}
                  </span>
                </div>
                <Separator className="my-1" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Lucro</p>
                    <p className={`text-lg font-bold ${colorClass(lucroValor)}`}>{formatMoney(lucroValor, bia?.moeda || "BRL")}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">ROI</p>
                    <p className={`text-lg font-bold ${colorClass(roi)}`}>{pct(roi, 1)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Múltiplo</p>
                    <p className={`text-lg font-bold ${multiplo >= 1 ? "text-green-600" : "text-red-600"}`}>{multiplo.toFixed(2)}x</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">% VGV</p>
                    <p className="text-lg font-bold text-purple-600">{pct(percVGV, 1)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---- DeducaoRow sub-component ----
function DeducaoRow({
  label, prevPct, prevVal, realPct, onChangeReal, realVal
}: {
  label: string;
  prevPct: number;
  prevVal: number;
  realPct: number;
  onChangeReal: (v: number) => void;
  realVal: number;
}) {
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  return (
    <div className="py-2 border-b border-border/40 last:border-0 space-y-1.5">
      {/* Linha previsto — igual ao layout original */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{prevPct.toFixed(2)}% previsto</p>
        </div>
        <span className="text-sm font-semibold text-red-600 tabular-nums shrink-0 ml-2">{fmt(prevVal)}</span>
      </div>

      {/* Linha realizado — input embaixo */}
      <div className="flex items-center justify-between gap-2 pl-2 border-l-2 border-orange-400/40">
        <div className="flex items-center gap-1.5 flex-1">
          <div className="relative w-24">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={realPct || ""}
              onChange={(e) => onChangeReal(parseFloat(e.target.value) || 0)}
              className="h-7 text-xs pr-6 border-orange-400/40 focus-visible:ring-orange-400/30"
              placeholder="0.00"
              data-testid={`input-real-${label.toLowerCase().replace(/\s/g, "-")}`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
          </div>
          <span className="text-[10px] text-muted-foreground">realizado</span>
        </div>
        <span className="text-xs font-semibold text-orange-600 tabular-nums shrink-0">{fmt(realVal)}</span>
      </div>
    </div>
  );
}
