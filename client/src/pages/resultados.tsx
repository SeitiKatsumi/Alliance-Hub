import { useState, useMemo, useEffect, useRef } from "react";
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
  ArrowDownCircle, Target, Layers, Save, Sparkles, Loader2
} from "lucide-react";

// ---- Types ----
interface BiasProjeto {
  id: string;
  nome_bia: string;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  custo_origem_bia?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_alianca?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
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
  ativo_area_m2?: string | number;
  ativo_endereco?: string | number;
  ativo_bairro?: string | number;
  ativo_cidade?: string | number;
  ativo_estado?: string | number;
  ativo_pais?: string | number;
  ativo_cep?: string | number;
  ativo_qualificacao?: string | number;
  localizacao?: string | number;
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

interface MarketM2Analysis {
  success?: boolean;
  classificacao?: "abaixo" | "media" | "acima" | "indeterminado";
  preco_m2_informado?: number;
  referencia_m2_min?: number;
  referencia_m2_max?: number;
  referencia_m2_media?: number;
  diferenca_percentual?: number;
  confianca?: "baixa" | "media" | "alta";
  resumo?: string;
  fatores?: string[];
  observacao?: string;
  fontes?: Array<{ titulo: string; url: string; trecho?: string }>;
  valor_total?: number;
  area_m2?: number;
}

// ---- Helpers ----
function n(v?: string | number | null): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function parseAreaM2(value?: string | number | null): number {
  if (typeof value === "number") return value;
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(normalized) || 0;
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

function formatMoneyPerM2(value: number, currency = "BRL"): string {
  return `${formatMoney(value, currency)}/m²`;
}

function pct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function colorClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

function classificationLabel(value?: string): string {
  if (value === "acima") return "Acima da média";
  if (value === "abaixo") return "Abaixo da média";
  if (value === "media") return "Na média";
  return "Indeterminado";
}

function classificationClass(value?: string): string {
  if (value === "acima") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "abaixo") return "border-blue-200 bg-blue-50 text-blue-700";
  if (value === "media") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

// ---- Sub-components ----
function MetricCard({
  label, value, sub, icon: Icon, color = "text-brand-gold", border = "border-brand-gold/30", highlight = false
}: {
  label: string; value: string; sub?: string;
  icon: any; color?: string; border?: string; highlight?: boolean;
}) {
  return (
    <Card className={`${border} ${highlight ?"bg-gradient-to-br from-brand-gold/5 to-transparent" : ""}`}>
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

function RowItem({ label, value, sub, positive, currency = "BRL", withBorder = true }: { label: string; value: number; sub?: string; positive?: boolean; currency?: string; withBorder?: boolean }) {
  const cls = positive !== undefined ?(positive ?"text-green-600" : "text-red-600") : colorClass(value);
  return (
    <div className={`flex items-start justify-between gap-4 py-2 ${withBorder ?"border-b border-border/40 last:border-0" : ""}`}>
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${cls}`}>{formatMoney(value, currency)}</span>
    </div>
  );
}

function MarketM2AnalysisCard({
  analysis,
  loading,
  disabled,
  onAnalyze,
  currentM2,
  currency = "BRL",
}: {
  analysis: MarketM2Analysis | null;
  loading: boolean;
  disabled: boolean;
  onAnalyze: () => void;
  currentM2: number;
  currency?: string;
}) {
  return (
    <Card className="border-blue-200/70 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-blue-600" />
              IA de preço por m²
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Compara a receita da BIA com uma referência estimada para a região.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            onClick={onAnalyze}
            disabled={loading || disabled}
            data-testid="button-analise-preco-m2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysis ? "Reanalisar" : loading ? "Analisando" : "Analisar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled ? (
          <p className="rounded-lg border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-muted-foreground">
            Informe o valor realizado de venda e a área do ativo para calcular o preço por m².
          </p>
        ) : !analysis ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white/70 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preço informado</p>
              <p className="text-lg font-bold text-blue-700">{formatMoneyPerM2(currentM2, currency)}</p>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              {loading
                ? "Analisando automaticamente se o valor está acima, abaixo ou na média da região."
                : "A análise roda automaticamente quando há receita, área e localização suficientes."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={classificationClass(analysis.classificacao)}>
                {classificationLabel(analysis.classificacao)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                Confiança {analysis.confianca || "baixa"}
              </Badge>
              {typeof analysis.diferenca_percentual === "number" && (
                <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">
                  {analysis.diferenca_percentual > 0 ? "+" : ""}{analysis.diferenca_percentual.toFixed(1)}% vs referência
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Informado</p>
                <p className="text-base font-bold text-blue-700">{formatMoneyPerM2(analysis.preco_m2_informado || currentM2, currency)}</p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Referência média</p>
                <p className="text-base font-bold text-foreground">
                  {analysis.referencia_m2_media ? formatMoneyPerM2(analysis.referencia_m2_media, currency) : "-"}
                </p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Faixa estimada</p>
                <p className="text-base font-bold text-foreground">
                  {analysis.referencia_m2_min && analysis.referencia_m2_max
                    ? `${formatMoney(analysis.referencia_m2_min, currency)} - ${formatMoneyPerM2(analysis.referencia_m2_max, currency)}`
                    : "-"}
                </p>
              </div>
            </div>

            {analysis.resumo && <p className="text-sm leading-relaxed text-foreground">{analysis.resumo}</p>}
            {!!analysis.fatores?.length && (
              <div className="flex flex-wrap gap-2">
                {analysis.fatores.slice(0, 5).map((fator, index) => (
                  <Badge key={`${fator}-${index}`} variant="secondary" className="bg-white text-slate-600">
                    {fator}
                  </Badge>
                ))}
              </div>
            )}
            {!!analysis.fontes?.length && (
              <div className="space-y-2 rounded-lg border border-blue-100 bg-white/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fontes consultadas</p>
                <div className="space-y-2">
                  {analysis.fontes.slice(0, 4).map((fonte, index) => (
                    <a
                      key={`${fonte.url}-${index}`}
                      href={fonte.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border border-border/60 p-2 text-xs hover:border-blue-200 hover:bg-blue-50/60"
                    >
                      <span className="block font-medium text-blue-700">{fonte.titulo || fonte.url}</span>
                      {fonte.trecho && <span className="mt-1 block text-muted-foreground">{fonte.trecho}</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {analysis.observacao || "Estimativa por IA para triagem interna; não substitui laudo de avaliação ou pesquisa formal de mercado."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CostRowItem({
  label,
  value,
  total,
  areaM2,
  currency = "BRL",
  emphasized = false,
  withBorder = true,
}: {
  label: string;
  value: number;
  total: number;
  areaM2: number;
  currency?: string;
  emphasized?: boolean;
  withBorder?: boolean;
}) {
  const percent = total > 0 ?(value / total) * 100 : 0;
  const perM2 = areaM2 > 0 ?value / areaM2 : 0;

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_minmax(116px,auto)] items-start gap-3 py-2 ${withBorder ?"border-b border-border/40 last:border-0" : ""}`}>
      <span className={`min-w-0 text-sm leading-snug ${emphasized ?"font-semibold" : ""}`}>{label}</span>
      <div className="min-w-0 space-y-0.5 text-right">
        <p className={`text-sm ${emphasized ?"font-bold" : "font-semibold"} text-red-600 tabular-nums`}>
          {formatMoney(value, currency)}
        </p>
        <p className={`text-xs ${emphasized ?"font-bold" : "font-semibold"} text-foreground tabular-nums`}>
        {areaM2 > 0 ?formatMoneyPerM2(perM2, currency).replace("/m²", "") : "-"}
        </p>
        <p className={`text-xs ${emphasized ?"font-bold" : "font-semibold"} text-foreground tabular-nums`}>
          {total > 0 ?pct(percent) : "-"}
        </p>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function ResultadosPage({
  initialBiaId = null,
  embedded = false,
}: {
  initialBiaId?: string | null;
  embedded?: boolean;
} = {}) {
  const [selectedBiaId, setSelectedBiaId] = useState<string>(initialBiaId || "");
  const { toast } = useToast();

  // Receita editÃ¡vel (string BRL formatada)
  const [vgvEdit, setVgvEdit] = useState("");
  const [valorRealizadoEdit, setValorRealizadoEdit] = useState("");
  const [marketAnalysis, setMarketAnalysis] = useState<MarketM2Analysis | null>(null);
  const marketAnalysisKeyRef = useRef("");

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

  useEffect(() => {
    if (initialBiaId && selectedBiaId !== initialBiaId) {
      setSelectedBiaId(initialBiaId);
    }
  }, [initialBiaId, selectedBiaId]);

  // Auto-select the last used BIA (or first in list)
  useEffect(() => {
    if (initialBiaId || embedded) return;
    if ((biasRaw as BiasProjeto[]).length > 0 && !selectedBiaId) {
      const lastUsed = localStorage.getItem("resultados-bia-id");
      const found = lastUsed ?(biasRaw as BiasProjeto[]).find((b) => b.id === lastUsed) : null;
      setSelectedBiaId(found ?lastUsed! : (biasRaw as BiasProjeto[])[0].id);
    }
  }, [biasRaw, selectedBiaId, initialBiaId, embedded]);

  const bia = useMemo(
    () => (biasRaw as BiasProjeto[]).find((b) => b.id === selectedBiaId),
    [biasRaw, selectedBiaId]
  );

  // Load editable values when BIA changes
  useEffect(() => {
    if (bia) {
      const vgvNum = n(bia.valor_geral_venda_vgv);
      const vrNum = n(bia.valor_realizado_venda);
      setVgvEdit(vgvNum > 0 ?formatInputBRL(String(Math.round(vgvNum * 100))) : "");
      setValorRealizadoEdit(vrNum > 0 ?formatInputBRL(String(Math.round(vrNum * 100))) : "");
      setComissaoRealPct(n(bia.comissao_realizada));
      setIrRealPct(n(bia.ir_realizado));
      setInssRealPct(n(bia.inss_realizado));
      setManutRealPct(n(bia.manutencao_realizada));
      setMarketAnalysis(null);
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

  const marketAnalysisMutation = useMutation({
    mutationFn: async () => {
      if (!bia) throw new Error("Selecione uma BIA");
      const response = await apiRequest("POST", "/api/ai/preco-m2", {
        origem: "BIA",
        nome: bia.nome_bia,
        tipo: bia.ativo_qualificacao || "BIA imobiliária",
        valor: parseBRLToNumber(valorRealizadoEdit),
        area_m2: parseAreaM2(bia.ativo_area_m2),
        moeda: bia.moeda || "BRL",
        localizacao: bia.localizacao,
        endereco: bia.ativo_endereco,
        bairro: bia.ativo_bairro,
        cidade: bia.ativo_cidade,
        estado: bia.ativo_estado,
        pais: bia.ativo_pais,
        cep: bia.ativo_cep,
      });
      return response.json() as Promise<MarketM2Analysis>;
    },
    onSuccess: setMarketAnalysis,
    onError: (e: any) => toast({ title: "Erro na análise", description: e.message, variant: "destructive" }),
  });

  // Soma de aportes pagos no fluxo de caixa desta BIA
  const totalAportesPagos = useMemo(() => {
    if (!selectedBiaId) return 0;
    return (fluxoRaw as FluxoItem[])
      .filter((i) => i.bia === selectedBiaId && i.tipo === "entrada" && i.status === "pago")
      .reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
  }, [fluxoRaw, selectedBiaId]);

  // Soma de saÃ­das pagas
  const totalSaidasPagas = useMemo(() => {
    if (!selectedBiaId) return 0;
    return (fluxoRaw as FluxoItem[])
      .filter((i) => i.bia === selectedBiaId && i.tipo === "saida" && i.status === "pago")
      .reduce((s, i) => s + (parseFloat(String(i.valor)) || 0), 0);
  }, [fluxoRaw, selectedBiaId]);

  // ---- CÃ¡lculos ----
  const vgv                 = parseBRLToNumber(vgvEdit);
  const valorRealizado      = parseBRLToNumber(valorRealizadoEdit);
  const valorOrigem         = n(bia?.valor_origem);
  const areaM2              = parseAreaM2(bia?.ativo_area_m2);
  const percentItems = [
    { value: bia?.perc_autor_opa, member: bia?.autor_bia },
    { value: bia?.perc_aliado_built, member: bia?.aliado_built },
    { value: bia?.perc_built, member: "__built__" },
    { value: bia?.perc_dir_alianca, member: bia?.diretor_alianca },
    { value: bia?.perc_dir_tecnico, member: bia?.diretor_nucleo_tecnico },
    { value: bia?.perc_dir_obras, member: bia?.diretor_execucao },
    { value: bia?.perc_dir_comercial, member: bia?.diretor_comercial },
    { value: bia?.perc_dir_capital, member: bia?.diretor_capital },
  ];
  const hasPercentFields = percentItems.some(({ value }) => value !== null && value !== undefined && String(value) !== "");
  const divisorMultiplicador = hasPercentFields
    ? percentItems.reduce((sum, item) => sum + (item.member ? n(item.value) : 0), 0)
    : n(bia?.divisor_multiplicador);
  const custoCPP = divisorMultiplicador > 0 ? valorOrigem * divisorMultiplicador / 100 : 0;
  const custoOrigem = valorOrigem + custoCPP;

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
  const custoTotal = totalSaidasPagas;
  const receitaPorM2 = areaM2 > 0 ?valorRealizado / areaM2 : 0;

  useEffect(() => {
    if (!bia || valorRealizado <= 0 || areaM2 <= 0) return;
    const locationKey = [
      bia.localizacao,
      bia.ativo_endereco,
      bia.ativo_bairro,
      bia.ativo_cidade,
      bia.ativo_estado,
      bia.ativo_pais,
      bia.ativo_cep,
    ].filter(Boolean).join("|");
    if (!locationKey.trim()) return;
    const key = `${bia.id}|${valorRealizado}|${areaM2}|${locationKey}|${bia.ativo_qualificacao || ""}`;
    if (marketAnalysisKeyRef.current === key || marketAnalysisMutation.isPending) return;
    marketAnalysisKeyRef.current = key;
    marketAnalysisMutation.mutate();
  }, [
    bia?.id,
    bia?.localizacao,
    bia?.ativo_endereco,
    bia?.ativo_bairro,
    bia?.ativo_cidade,
    bia?.ativo_estado,
    bia?.ativo_pais,
    bia?.ativo_cep,
    bia?.ativo_qualificacao,
    valorRealizado,
    areaM2,
    marketAnalysisMutation.isPending,
  ]);

  // Realizado (valores BRL â€” usa os estados editÃ¡veis)
  const comissaoReal    = (comissaoRealPct  / 100) * valorRealizado;
  const irReal          = (irRealPct        / 100) * valorRealizado;
  const inssReal        = (inssRealPct      / 100) * valorRealizado;
  const manutReal       = (manutRealPct     / 100) * valorRealizado;
  const totalDeducoesReal = comissaoReal + irReal + inssReal + manutReal;

  // Resultado usando deduÃ§Ãµes realizadas
  const receitaLiquida = valorRealizado - totalDeducoesReal;
  const resultadoLiquido = receitaLiquida - custoCPP;
  const lucroValor = resultadoLiquido - totalSaidasPagas;
  const roi = totalSaidasPagas > 0 ?((resultadoLiquido - totalSaidasPagas) / totalSaidasPagas) * 100 : 0;
  const multiplo = totalSaidasPagas > 0 ?resultadoLiquido / totalSaidasPagas : 0;
  const percVGV = vgv > 0 ?(valorRealizado / vgv) * 100 : 0;
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
    <div className={`${embedded ? "p-0 max-w-none" : "p-6 max-w-7xl mx-auto"} space-y-6`}>
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

        {!embedded && (
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
        )}
      </div>

      {!selectedBiaId ?(
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
              icon={resultadoLiquido >= 0 ?TrendingUp : TrendingDown}
              color={resultadoLiquido >= 0 ?"text-green-600" : "text-red-600"}
              border={resultadoLiquido >= 0 ?"border-green-500/30" : "border-red-500/30"}
              highlight
            />
            <MetricCard
              label="Lucro"
              value={formatMoney(lucroValor, bia?.moeda || "BRL")}
              icon={Percent}
              color={lucroValor >= 0 ?"text-brand-gold" : "text-red-600"}
              border="border-brand-gold/30"
              highlight
            />
            <MetricCard
              label="ROI"
              value={pct(roi)}
              icon={Target}
              color={roi >= 0 ?"text-blue-600" : "text-red-600"}
              border="border-blue-500/30"
            />
            <MetricCard
              label="Múltiplo do Capital"
              value={`${multiplo.toFixed(2)}x`}
              icon={Layers}
              color={multiplo >= 1 ?"text-green-600" : "text-red-600"}
              border="border-green-500/30"
            />
          </div>

          {/* Linha 2 â€” mÃ©tricas secundÃ¡rias */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total de Entradas"
              value={formatMoney(totalAportesPagos, bia?.moeda || "BRL")}
              sub="entradas pagas no caixa"
              icon={ArrowUpCircle}
              color="text-blue-600"
              border="border-blue-500/30"
            />
            <MetricCard
              label="Total de Saídas"
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
              color={caixaLiquidoReal >= 0 ?"text-green-600" : "text-red-600"}
              border={caixaLiquidoReal >= 0 ?"border-green-500/30" : "border-red-500/30"}
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
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-500" /> Custo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(116px,auto)] gap-3 border-b border-border/60 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Item</span>
                  <span className="text-right leading-tight">Valor<br />R$/m²<br />% custo</span>
                </div>
                <CostRowItem label="Valor de Origem" value={valorOrigem} total={custoTotal} areaM2={areaM2} currency={bia?.moeda || "BRL"} />
                <CostRowItem label="Divisor Multiplicador" value={custoCPP} total={custoTotal} areaM2={areaM2} currency={bia?.moeda || "BRL"} />
                <CostRowItem label="Custo de Origem da BIA" value={custoOrigem} total={custoTotal} areaM2={areaM2} currency={bia?.moeda || "BRL"} emphasized />
                <CostRowItem label="Custo Total" value={custoTotal} total={custoTotal} areaM2={areaM2} currency={bia?.moeda || "BRL"} emphasized withBorder={false} />
              </CardContent>
            </Card>

            {/* Receita */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" /> Receita
                  </CardTitle>
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-200 disabled:text-white"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-receita"
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
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
                  <Badge variant={percVGV >= 100 ?"default" : "secondary"} className="text-xs">
                    {pct(percVGV, 1)} do VGV
                  </Badge>
                </div>
                <div className="mt-auto border-t border-border/40 pt-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="min-w-0 text-xs text-muted-foreground">Receita R$/m²</span>
                    <span className="shrink-0 text-right text-sm font-bold text-green-600 tabular-nums">
                      {areaM2 > 0 ?formatMoneyPerM2(receitaPorM2, bia?.moeda || "BRL") : "-"}
                    </span>
                  </div>
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
                    className="h-7 gap-1 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-blue-200 disabled:text-white"
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

          <MarketM2AnalysisCard
            analysis={marketAnalysis}
            loading={marketAnalysisMutation.isPending}
            disabled={!bia || valorRealizado <= 0 || areaM2 <= 0}
            onAnalyze={() => marketAnalysisMutation.mutate()}
            currentM2={receitaPorM2}
            currency={bia?.moeda || "BRL"}
          />

          {/* Resumo final */}
          <Card className="hidden">
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
                    <p className={`text-lg font-bold ${multiplo >= 1 ?"text-green-600" : "text-red-600"}`}>{multiplo.toFixed(2)}x</p>
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
      {/* Linha previsto â€” igual ao layout original */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{prevPct.toFixed(2)}% previsto</p>
        </div>
        <span className="text-sm font-semibold text-red-600 tabular-nums shrink-0 ml-2">{fmt(prevVal)}</span>
      </div>

      {/* Linha realizado â€” input embaixo */}
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
