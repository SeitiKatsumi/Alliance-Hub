import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator,
  Save,
  RefreshCw,
  DollarSign,
  Percent,
  TrendingUp,
  Building2,
  Users,
  Crown,
  Shield,
  Hammer,
  Briefcase,
  Wallet,
  ArrowRight,
  BarChart3,
  Receipt,
  CalendarDays,
  Wrench,
  HandCoins,
} from "lucide-react";

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca: string;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_obras?: string | number;
  cpp_dir_comercial?: string | number;
  cpp_dir_capital?: string | number;
  custo_origem_bia?: string | number;
  custo_final_previsto?: string | number;
  valor_realizado_venda?: string | number;
  comissao_prevista_corretor?: string | number;
  ir_previsto?: string | number;
  resultado_liquido?: string | number;
  lucro_previsto?: string | number;
  inss_previsto?: string | number;
  manutencao_pos_obra_prevista?: string | number;
  valor_geral_venda_vgv?: string | number;
  total_receita?: string | number;
  inicio_aportes?: string | null;
  total_aportes?: string | number;
}

function toNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  return parseFloat(String(v)) || 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPerc(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatInputBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numToBRLStr(v: number): string {
  if (!v) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLCalc(formatted: string): number {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

function NumInput({
  label, value, onChange, testId, hint
}: { label: string; value: number; onChange: (v: number) => void; testId?: string; hint?: string }) {
  const [display, setDisplay] = useState(() => numToBRLStr(value));

  // Sync display when parent value changes (e.g. when BIA is selected)
  useEffect(() => { setDisplay(numToBRLStr(value)); }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => {
            const formatted = formatInputBRL(e.target.value);
            setDisplay(formatted);
            onChange(parseBRLCalc(formatted));
          }}
          className="pl-9 h-8 text-sm tabular-nums"
          placeholder="0,00"
          data-testid={testId}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function PercInput({
  label, value, onChange, testId, hint, baseValue
}: { label: string; value: number; onChange: (v: number) => void; testId?: string; hint?: string; baseValue?: number }) {
  const brlEquiv = baseValue && baseValue > 0 ? (value / 100) * baseValue : null;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={value || ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="pr-8 h-8 text-sm"
            placeholder="0,00"
            data-testid={testId}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        </div>
        {brlEquiv !== null && (
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums min-w-[90px] text-right">
            = {formatBRL(brlEquiv)}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export default function BiasCalculadoraPage() {
  const { toast } = useToast();
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const bias = useMemo(() => biasRaw || [], [biasRaw]);
  const selectedBia = useMemo(() => bias.find(b => b.id === selectedBiaId), [bias, selectedBiaId]);

  // CPP fields
  const [valorOrigem, setValorOrigem] = useState(0);
  const [percAutor, setPercAutor] = useState(0);
  const [percAliado, setPercAliado] = useState(0);
  const [percBuilt, setPercBuilt] = useState(0);
  const [percTecnico, setPercTecnico] = useState(0);
  const [percObras, setPercObras] = useState(0);
  const [percComercial, setPercComercial] = useState(0);
  const [percCapital, setPercCapital] = useState(0);

  // Receita & impostos
  const [vgv, setVgv] = useState(0);
  const [valorRealizadoVenda, setValorRealizadoVenda] = useState(0);
  const [comissaoCorretor, setComissaoCorretor] = useState(0);
  const [irPrevisto, setIrPrevisto] = useState(0);
  const [inssPrevisto, setInssPrevisto] = useState(0);
  const [manutencao, setManutencao] = useState(0);

  // Aportes
  const [totalAportes, setTotalAportes] = useState(0);
  const [inicioAportes, setInicioAportes] = useState<string>("");

  useEffect(() => {
    if (selectedBia) {
      setValorOrigem(toNum(selectedBia.valor_origem));
      setPercAutor(toNum(selectedBia.perc_autor_opa));
      setPercAliado(toNum(selectedBia.perc_aliado_built));
      setPercBuilt(toNum(selectedBia.perc_built));
      setPercTecnico(toNum(selectedBia.perc_dir_tecnico));
      setPercObras(toNum(selectedBia.perc_dir_obras));
      setPercComercial(toNum(selectedBia.perc_dir_comercial));
      setPercCapital(toNum(selectedBia.perc_dir_capital));
      setVgv(toNum(selectedBia.valor_geral_venda_vgv));
      setValorRealizadoVenda(toNum(selectedBia.valor_realizado_venda));
      setComissaoCorretor(toNum(selectedBia.comissao_prevista_corretor));
      setIrPrevisto(toNum(selectedBia.ir_previsto));
      setInssPrevisto(toNum(selectedBia.inss_previsto));
      setManutencao(toNum(selectedBia.manutencao_pos_obra_prevista));
      setTotalAportes(toNum(selectedBia.total_aportes));
      setInicioAportes(selectedBia.inicio_aportes || "");
    }
  }, [selectedBia]);

  // Calculations
  const divisorMultiplicador = percAutor + percAliado + percBuilt + percTecnico + percObras + percComercial + percCapital;
  const custoOrigemBia = valorOrigem + (valorOrigem * divisorMultiplicador / 100);
  const cppAutor = valorOrigem * percAutor / 100;
  const cppAliado = valorOrigem * percAliado / 100;
  const cppBuilt = valorOrigem * percBuilt / 100;
  const cppTecnico = valorOrigem * percTecnico / 100;
  const cppObras = valorOrigem * percObras / 100;
  const cppComercial = valorOrigem * percComercial / 100;
  const cppCapital = valorOrigem * percCapital / 100;
  const custoFinalPrevisto = cppAutor + cppAliado + cppBuilt + cppTecnico + cppObras + cppComercial + cppCapital;

  // Deduções são percentuais sobre o valor realizado de venda
  const comissaoValor    = (comissaoCorretor / 100) * valorRealizadoVenda;
  const irValor          = (irPrevisto       / 100) * valorRealizadoVenda;
  const inssValor        = (inssPrevisto     / 100) * valorRealizadoVenda;
  const manutencaoValor  = (manutencao       / 100) * valorRealizadoVenda;
  const totalDeducoes = comissaoValor + irValor + inssValor + manutencaoValor;
  const totalReceita = valorRealizadoVenda - totalDeducoes;
  const resultadoLiquido = totalReceita - custoFinalPrevisto;
  const lucroPrevisto = valorRealizadoVenda > 0 ? ((resultadoLiquido / valorRealizadoVenda) * 100) : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBiaId) throw new Error("Selecione uma BIA");
      const payload = {
        valor_origem: valorOrigem.toFixed(2),
        divisor_multiplicador: divisorMultiplicador.toFixed(2),
        perc_autor_opa: percAutor.toFixed(2),
        perc_aliado_built: percAliado.toFixed(2),
        perc_built: percBuilt.toFixed(2),
        perc_dir_tecnico: percTecnico.toFixed(2),
        perc_dir_obras: percObras.toFixed(2),
        perc_dir_comercial: percComercial.toFixed(2),
        perc_dir_capital: percCapital.toFixed(2),
        cpp_autor_opa: cppAutor.toFixed(2),
        cpp_aliado_built: cppAliado.toFixed(2),
        cpp_built: cppBuilt.toFixed(2),
        cpp_dir_tecnico: cppTecnico.toFixed(2),
        cpp_dir_obras: cppObras.toFixed(2),
        cpp_dir_comercial: cppComercial.toFixed(2),
        cpp_dir_capital: cppCapital.toFixed(2),
        custo_origem_bia: custoOrigemBia.toFixed(2),
        custo_final_previsto: custoFinalPrevisto.toFixed(2),
        valor_geral_venda_vgv: vgv.toFixed(2),
        valor_realizado_venda: valorRealizadoVenda.toFixed(2),
        comissao_prevista_corretor: comissaoCorretor.toFixed(2),
        ir_previsto: irPrevisto.toFixed(2),
        inss_previsto: inssPrevisto.toFixed(2),
        manutencao_pos_obra_prevista: manutencao.toFixed(2),
        total_receita: totalReceita.toFixed(2),
        resultado_liquido: resultadoLiquido.toFixed(2),
        lucro_previsto: lucroPrevisto.toFixed(2),
        total_aportes: totalAportes.toFixed(2),
        inicio_aportes: inicioAportes || null,
      };
      await apiRequest("PATCH", `/api/bias/${selectedBiaId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bias"] });
      toast({ title: "Salvo com sucesso", description: "Os cálculos foram salvos no Directus." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const percFields = [
    { label: "Autor da OPA", icon: Crown, value: percAutor, setter: setPercAutor, cpp: cppAutor, color: "text-amber-500" },
    { label: "Aliado Built", icon: Users, value: percAliado, setter: setPercAliado, cpp: cppAliado, color: "text-blue-500" },
    { label: "Built", icon: Building2, value: percBuilt, setter: setPercBuilt, cpp: cppBuilt, color: "text-brand-gold" },
    { label: "Dir. Núcleo Técnico", icon: Shield, value: percTecnico, setter: setPercTecnico, cpp: cppTecnico, color: "text-purple-500" },
    { label: "Dir. Núcleo de Obras", icon: Hammer, value: percObras, setter: setPercObras, cpp: cppObras, color: "text-orange-500" },
    { label: "Dir. Núcleo Comercial", icon: Briefcase, value: percComercial, setter: setPercComercial, cpp: cppComercial, color: "text-green-500" },
    { label: "Dir. Núcleo de Capital", icon: Wallet, value: percCapital, setter: setPercCapital, cpp: cppCapital, color: "text-red-500" },
  ];

  if (loadingBias) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
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
              <Calculator className="w-6 h-6" />
            </div>
            Calculadora DM
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedBiaId} onValueChange={setSelectedBiaId}>
            <SelectTrigger className="w-[280px]" data-testid="select-bia">
              <SelectValue placeholder="Selecione uma BIA..." />
            </SelectTrigger>
            <SelectContent>
              {bias.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.nome_bia}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedBiaId || saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Atualizar valores na BIA
          </Button>
        </div>
      </div>

      {!selectedBiaId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma BIA para iniciar</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Escolha um projeto de aliança no seletor acima para calcular a gestão financeira</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-brand-gold/30" data-testid="panel-valor-origem">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Valor de Origem</CardTitle>
                <DollarSign className="w-4 h-4 text-brand-gold" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorOrigem || ""}
                      onChange={(e) => setValorOrigem(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                      placeholder="0,00"
                      data-testid="input-valor-origem"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Valor base do projeto</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30" data-testid="panel-divisor">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Divisor Multiplicador</CardTitle>
                <Percent className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{formatPerc(divisorMultiplicador)}</p>
                <p className="text-xs text-muted-foreground mt-1">Soma de todos os percentuais</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/30" data-testid="panel-custo-origem">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Custo de Origem da BIA</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatBRL(custoOrigemBia)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBRL(valorOrigem)} + ({formatPerc(divisorMultiplicador)})
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Percentuais e CPPs */}
          <Card data-testid="panel-percentuais">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="w-5 h-5 text-brand-gold" />
                Percentuais e CPPs de Origem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {percFields.map((field, idx) => {
                  const Icon = field.icon;
                  return (
                    <Card key={idx} className="border-border/50" data-testid={`perc-card-${idx}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${field.color}`} />
                          <span className="text-sm font-medium truncate">{field.label}</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value || ""}
                              onChange={(e) => field.setter(parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                              placeholder="0,00"
                              data-testid={`input-perc-${idx}`}
                            />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowRight className="w-3 h-3" />
                            <span>CPP:</span>
                          </div>
                          <p className="text-sm font-semibold" data-testid={`text-cpp-${idx}`}>
                            {formatBRL(field.cpp)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Card className="border-brand-gold/30 bg-brand-gold/5" data-testid="panel-total-perc">
                  <CardContent className="p-4 flex flex-col justify-center h-full space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-brand-gold" />
                      <span className="text-sm font-medium">Totais</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Divisor:</span>
                        <Badge variant="outline">{formatPerc(divisorMultiplicador)}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">CPP Total:</span>
                        <Badge variant="outline">{formatBRL(custoFinalPrevisto)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Receita, Impostos e Resultado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Receita */}
            <Card data-testid="panel-receita">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-5 h-5 text-green-500" />
                  Receita
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NumInput
                  label="VGV — Valor Geral de Venda"
                  value={vgv}
                  onChange={setVgv}
                  testId="input-vgv"
                  hint="Valor total previsto de venda"
                />
                <NumInput
                  label="Valor Realizado de Venda"
                  value={valorRealizadoVenda}
                  onChange={setValorRealizadoVenda}
                  testId="input-valor-realizado"
                  hint="Valor efetivamente realizado"
                />
                <Separator />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-muted-foreground">Total de Receita</span>
                  <span className={`text-lg font-bold ${totalReceita >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-total-receita">
                    {formatBRL(totalReceita)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Valor realizado − deduções</p>
              </CardContent>
            </Card>

            {/* Deduções */}
            <Card data-testid="panel-deducoes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="w-5 h-5 text-red-500" />
                  Deduções e Impostos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PercInput
                  label="Comissão Prevista Corretor"
                  value={comissaoCorretor}
                  onChange={setComissaoCorretor}
                  testId="input-comissao"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="IR Previsto"
                  value={irPrevisto}
                  onChange={setIrPrevisto}
                  testId="input-ir"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="INSS Previsto"
                  value={inssPrevisto}
                  onChange={setInssPrevisto}
                  testId="input-inss"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <PercInput
                  label="Manutenção Pós Obra Prevista"
                  value={manutencao}
                  onChange={setManutencao}
                  testId="input-manutencao"
                  baseValue={valorRealizadoVenda}
                  hint="% sobre o valor realizado de venda"
                />
                <Separator />
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-muted-foreground">Total de Deduções</span>
                  <span className="text-lg font-bold text-red-600" data-testid="text-total-deducoes">
                    {formatBRL(totalDeducoes)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aportes */}
          <Card data-testid="panel-aportes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HandCoins className="w-5 h-5 text-blue-500" />
                Aportes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Início dos Aportes
                  </Label>
                  <Input
                    type="date"
                    value={inicioAportes}
                    onChange={(e) => setInicioAportes(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-inicio-aportes"
                  />
                </div>
                <NumInput
                  label="Total de Aportes"
                  value={totalAportes}
                  onChange={setTotalAportes}
                  testId="input-total-aportes"
                  hint="Total aportado pelos membros"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resultado Final */}
          <Card className="border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-transparent" data-testid="panel-resultado">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-brand-gold" />
                Resultado Final
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Custo Final Previsto</p>
                  <p className="text-lg font-bold text-orange-600" data-testid="text-custo-final">{formatBRL(custoFinalPrevisto)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Receita</p>
                  <p className={`text-lg font-bold ${totalReceita >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-receita-final">{formatBRL(totalReceita)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Resultado Líquido</p>
                  <p className={`text-lg font-bold ${resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-resultado">{formatBRL(resultadoLiquido)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lucro Previsto</p>
                  <p className={`text-lg font-bold ${lucroPrevisto >= 0 ? "text-brand-gold" : "text-red-600"}`} data-testid="text-lucro">{formatPerc(lucroPrevisto)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
