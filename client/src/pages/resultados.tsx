import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, BarChart3, DollarSign,
  Percent, PiggyBank, Receipt, Landmark, ArrowUpCircle,
  ArrowDownCircle, Target, Layers
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

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

function RowItem({ label, value, sub, positive }: { label: string; value: number; sub?: string; positive?: boolean }) {
  const cls = positive !== undefined ? (positive ? "text-green-600" : "text-red-600") : colorClass(value);
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${cls}`}>{brl(value)}</span>
    </div>
  );
}

// ---- Main Page ----
export default function ResultadosPage() {
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: fluxoRaw = [], isLoading: loadingFluxo } = useQuery<FluxoItem[]>({
    queryKey: ["/api/fluxo-caixa"],
  });

  const bia = useMemo(
    () => (biasRaw as BiasProjeto[]).find((b) => b.id === selectedBiaId),
    [biasRaw, selectedBiaId]
  );

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

  // ---- Cálculos (da planilha) ----
  const vgv                 = n(bia?.valor_geral_venda_vgv);
  const valorRealizado      = n(bia?.valor_realizado_venda);
  const custoCPP            = n(bia?.custo_final_previsto);
  const custoOrigem         = n(bia?.custo_origem_bia);
  const valorOrigem         = n(bia?.valor_origem);

  // Estes campos são percentuais (%) sobre o valor realizado de venda
  const comissaoPct         = n(bia?.comissao_prevista_corretor);
  const irPct               = n(bia?.ir_previsto);
  const inssPct             = n(bia?.inss_previsto);
  const manutencaoPct       = n(bia?.manutencao_pos_obra_prevista);

  // Valores em BRL = (% / 100) × valor realizado
  const comissao    = (comissaoPct  / 100) * valorRealizado;
  const ir          = (irPct        / 100) * valorRealizado;
  const inss        = (inssPct      / 100) * valorRealizado;
  const manutencao  = (manutencaoPct / 100) * valorRealizado;

  // Total de deduções fiscais
  const totalDeducoes = comissao + ir + inss + manutencao;

  // Receita líquida = Valor Realizado - Deduções
  const receitaLiquida = valorRealizado - totalDeducoes;

  // Resultado = Receita Líquida - Custo Final CPP
  const resultadoLiquido = receitaLiquida - custoCPP;

  // Lucro % sobre o valor realizado
  const lucroPct = valorRealizado > 0 ? (resultadoLiquido / valorRealizado) * 100 : 0;

  // ROI = Resultado / Total Aportes (real, do fluxo de caixa)
  const roi = totalAportesPagos > 0 ? (resultadoLiquido / totalAportesPagos) * 100 : 0;

  // Múltiplo do capital = Valor Realizado / Total Aportes
  const multiplo = totalAportesPagos > 0 ? valorRealizado / totalAportesPagos : 0;

  // % VGV realizado
  const percVGV = vgv > 0 ? (valorRealizado / vgv) * 100 : 0;

  // Caixa líquido real = Aportes Recebidos - Saídas Pagas
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
            Resultados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Análise de retorno e performance por BIA</p>
        </div>

        <Select value={selectedBiaId} onValueChange={setSelectedBiaId}>
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
              value={brl(resultadoLiquido)}
              icon={resultadoLiquido >= 0 ? TrendingUp : TrendingDown}
              color={resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}
              border={resultadoLiquido >= 0 ? "border-green-500/30" : "border-red-500/30"}
              highlight
            />
            <MetricCard
              label="Lucro Previsto"
              value={pct(lucroPct)}
              sub="sobre valor realizado"
              icon={Percent}
              color={lucroPct >= 0 ? "text-brand-gold" : "text-red-600"}
              border="border-brand-gold/30"
              highlight
            />
            <MetricCard
              label="ROI"
              value={pct(roi)}
              sub="sobre aportes pagos"
              icon={Target}
              color={roi >= 0 ? "text-blue-600" : "text-red-600"}
              border="border-blue-500/30"
            />
            <MetricCard
              label="Múltiplo do Capital"
              value={`${multiplo.toFixed(2)}x`}
              sub="valor realizado / aportes"
              icon={Layers}
              color={multiplo >= 1 ? "text-green-600" : "text-red-600"}
              border="border-green-500/30"
            />
          </div>

          {/* Linha 2 — métricas secundárias */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total de Aportes"
              value={brl(totalAportesPagos)}
              sub="entradas pagas no caixa"
              icon={ArrowUpCircle}
              color="text-blue-600"
              border="border-blue-500/30"
            />
            <MetricCard
              label="Saídas Realizadas"
              value={brl(totalSaidasPagas)}
              sub="saídas pagas no caixa"
              icon={ArrowDownCircle}
              color="text-red-600"
              border="border-red-500/30"
            />
            <MetricCard
              label="Caixa Líquido Real"
              value={brl(caixaLiquidoReal)}
              sub="aportes − saídas pagas"
              icon={PiggyBank}
              color={caixaLiquidoReal >= 0 ? "text-green-600" : "text-red-600"}
              border={caixaLiquidoReal >= 0 ? "border-green-500/30" : "border-red-500/30"}
            />
            <MetricCard
              label="% VGV Realizado"
              value={pct(percVGV)}
              sub={`VGV: ${brl(vgv)}`}
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
                <RowItem label="Valor de Origem" value={valorOrigem} positive={false} />
                <RowItem label="Custo de Origem da BIA" sub="Origem + Divisor" value={custoOrigem} positive={false} />
                <RowItem label="CPP Total (Custo Final)" sub="Soma dos percentuais" value={custoCPP} positive={false} />
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Total Custos</span>
                  <span className="text-sm font-bold text-red-600 tabular-nums">{brl(custoCPP)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Receita */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" /> Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RowItem label="VGV (Valor Geral de Venda)" value={vgv} positive />
                <RowItem label="Valor Realizado de Venda" value={valorRealizado} positive />
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Realizado vs VGV</span>
                  <Badge variant={percVGV >= 100 ? "default" : "secondary"} className="text-xs">
                    {pct(percVGV, 1)} do VGV
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Deduções */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-500" /> Deduções e Impostos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RowItem label="Comissão Corretor" sub={`${comissaoPct.toFixed(2)}% sobre valor realizado`} value={comissao} positive={false} />
                <RowItem label="IR Previsto" sub={`${irPct.toFixed(2)}% sobre valor realizado`} value={ir} positive={false} />
                <RowItem label="INSS Previsto" sub={`${inssPct.toFixed(2)}% sobre valor realizado`} value={inss} positive={false} />
                <RowItem label="Manutenção Pós Obra" sub={`${manutencaoPct.toFixed(2)}% sobre valor realizado`} value={manutencao} positive={false} />
                <Separator className="my-2" />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Total Deduções</span>
                  <span className="text-sm font-bold text-red-600 tabular-nums">{brl(totalDeducoes)}</span>
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
                <RowItem label="(+) Valor Realizado de Venda" value={valorRealizado} positive />
                <RowItem label="(−) Custo Final CPP" value={-custoCPP} />
                <RowItem label="(−) Total de Deduções" value={-totalDeducoes} />
                <Separator className="my-3" />
                <div className="flex items-center justify-between py-2">
                  <span className="font-semibold">Resultado Líquido</span>
                  <span className={`text-xl font-bold tabular-nums ${colorClass(resultadoLiquido)}`}>
                    {brl(resultadoLiquido)}
                  </span>
                </div>
                <Separator className="my-1" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3">
                  <div className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Lucro %</p>
                    <p className={`text-lg font-bold ${colorClass(lucroPct)}`}>{pct(lucroPct, 1)}</p>
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
