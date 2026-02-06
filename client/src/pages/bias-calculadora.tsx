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
  BarChart3
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

export default function BiasCalculadoraPage() {
  const { toast } = useToast();
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");

  const { data: biasRaw = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const bias = useMemo(() => biasRaw || [], [biasRaw]);
  const selectedBia = useMemo(() => bias.find(b => b.id === selectedBiaId), [bias, selectedBiaId]);

  const [valorOrigem, setValorOrigem] = useState(0);
  const [percAutor, setPercAutor] = useState(0);
  const [percAliado, setPercAliado] = useState(0);
  const [percBuilt, setPercBuilt] = useState(0);
  const [percTecnico, setPercTecnico] = useState(0);
  const [percObras, setPercObras] = useState(0);
  const [percComercial, setPercComercial] = useState(0);
  const [percCapital, setPercCapital] = useState(0);
  const [valorRealizadoVenda, setValorRealizadoVenda] = useState(0);
  const [comissaoCorretor, setComissaoCorretor] = useState(0);
  const [irPrevisto, setIrPrevisto] = useState(0);

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
      setValorRealizadoVenda(toNum(selectedBia.valor_realizado_venda));
      setComissaoCorretor(toNum(selectedBia.comissao_prevista_corretor));
      setIrPrevisto(toNum(selectedBia.ir_previsto));
    }
  }, [selectedBia]);

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
  const resultadoLiquido = valorRealizadoVenda - custoFinalPrevisto - comissaoCorretor - irPrevisto;
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
        valor_realizado_venda: valorRealizadoVenda.toFixed(2),
        resultado_liquido: resultadoLiquido.toFixed(2),
        lucro_previsto: lucroPrevisto.toFixed(2),
        comissao_prevista_corretor: comissaoCorretor.toFixed(2),
        ir_previsto: irPrevisto.toFixed(2),
      };
      await apiRequest("PATCH", `/api/directus/bias_projetos/${selectedBiaId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/directus/bias_projetos"] });
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Calculator className="w-6 h-6" />
            </div>
            Calculadora DM
          </h1>
          <p className="text-muted-foreground mt-1">Gestão financeira das alianças</p>
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
            Salvar no Directus
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

        </>
      )}
    </div>
  );
}
