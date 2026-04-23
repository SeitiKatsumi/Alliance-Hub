import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  ChevronsUpDown,
  Check,
  UserCircle,
  CreditCard,
} from "lucide-react";
import { PagamentoModal } from "@/components/PagamentoModal";

interface Membro {
  id: string;
  nome?: string;
  Nome_de_usuario?: string | null;
  foto?: string | null;
}

const DIRECTUS_URL = "https://app.builtalliances.com";

function membroNome(m: Membro): string {
  return m.nome || m.Nome_de_usuario || m.id;
}

function membroFoto(m: Membro): string | null {
  return m.foto ? `/api/assets/${m.foto}?width=40&height=40&fit=cover` : null;
}

function MemberSelect({
  value, onChange, membros, label
}: { value: string; onChange: (v: string) => void; membros: Membro[]; label: string }) {
  const [open, setOpen] = useState(false);
  const selected = membros.find(m => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left rounded-md border border-input bg-background px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors min-h-[30px]"
          data-testid={`member-select-${label.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {selected ? (
            <>
              {membroFoto(selected) ? (
                <img src={membroFoto(selected)!} className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-brand-gold">{membroNome(selected).charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="truncate text-foreground">{membroNome(selected)}</span>
            </>
          ) : (
            <>
              <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Selecionar...</span>
            </>
          )}
          <ChevronsUpDown className="w-3 h-3 ml-auto text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar membro..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>
              <div className="text-xs p-3 text-muted-foreground text-center">Nenhum membro encontrado.</div>
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(""); setOpen(false); }}
                  className="text-xs text-muted-foreground"
                >
                  <Check className="w-3 h-3 mr-2 opacity-0" />
                  — Remover seleção
                </CommandItem>
              )}
              {membros.map(m => (
                <CommandItem
                  key={m.id}
                  value={membroNome(m)}
                  onSelect={() => { onChange(m.id); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={`w-3 h-3 mr-2 ${m.id === value ? "opacity-100" : "opacity-0"}`} />
                  {membroFoto(m) ? (
                    <img src={membroFoto(m)!} className="w-5 h-5 rounded-full object-cover mr-2 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center mr-2 shrink-0">
                      <span className="text-[8px] font-bold text-brand-gold">{membroNome(m).charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="truncate">{membroNome(m)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca: string;
  autor_bia?: string | null;
  aliado_built?: string | null;
  diretor_alianca?: string | null;
  diretor_nucleo_tecnico?: string | null;
  diretor_execucao?: string | null;
  diretor_comercial?: string | null;
  diretor_capital?: string | null;
  valor_origem?: string | number;
  divisor_multiplicador?: string | number;
  perc_autor_opa?: string | number;
  perc_aliado_built?: string | number;
  perc_built?: string | number;
  perc_dir_tecnico?: string | number;
  perc_dir_alianca?: string | number;
  perc_dir_obras?: string | number;
  perc_dir_comercial?: string | number;
  perc_dir_capital?: string | number;
  cpp_autor_opa?: string | number;
  cpp_aliado_built?: string | number;
  cpp_built?: string | number;
  cpp_dir_tecnico?: string | number;
  cpp_dir_alianca?: string | number;
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

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  // Member selections per role
  const [membroAutorOpa, setMembroAutorOpa] = useState<string>("");
  const [membroAliadoBuilt, setMembroAliadoBuilt] = useState<string>("");
  const [membroDirTecnico, setMembroDirTecnico] = useState<string>("");
  const [membroDirNucleoTecnico, setMembroDirNucleoTecnico] = useState<string>("");
  const [membroDirObras, setMembroDirObras] = useState<string>("");
  const [membroDirComercial, setMembroDirComercial] = useState<string>("");
  const [membroDirCapital, setMembroDirCapital] = useState<string>("");

  const bias = useMemo(() => biasRaw || [], [biasRaw]);
  const selectedBia = useMemo(() => bias.find(b => b.id === selectedBiaId), [bias, selectedBiaId]);

  // Forma de pagamento
  const [biaValorOrigem, setBiaValorOrigem] = useState(0); // valor salvo no Directus (fallback)
  const [valorAVista, setValorAVista] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [numeroParcelas, setNumeroParcelas] = useState<string>("");
  const [vencimento, setVencimento] = useState<string>("");
  const [vencimentosParcelas, setVencimentosParcelas] = useState<string[]>([]);
  const [valoresParcelas, setValoresParcelas] = useState<number[]>([]);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);

  const numParcelasInt = parseInt(numeroParcelas) || 0;

  // valorOrigem é derivado da forma de pagamento
  const valorOrigem = useMemo(() => {
    if (formaPagamento === "parcelado") return valoresParcelas.reduce((s, v) => s + (v || 0), 0);
    if (formaPagamento === "a_vista") return valorAVista;
    return biaValorOrigem;
  }, [formaPagamento, valoresParcelas, valorAVista, biaValorOrigem]);

  const [percAutor, setPercAutor] = useState(0);
  const [percAliado, setPercAliado] = useState(0);
  const [percBuilt, setPercBuilt] = useState(0);
  const [percTecnico, setPercTecnico] = useState(0);
  const [percAlianca, setPercAlianca] = useState(0);
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
      setBiaValorOrigem(toNum(selectedBia.valor_origem));
      // Reset payment form when BIA changes — each BIA has its own forma de pagamento
      setFormaPagamento("");
      setNumeroParcelas("");
      setVencimento("");
      setVencimentosParcelas([]);
      setValoresParcelas([]);
      setValorAVista(0);
      setPercAutor(toNum(selectedBia.perc_autor_opa));
      setPercAliado(toNum(selectedBia.perc_aliado_built));
      setPercBuilt(Math.max(toNum(selectedBia.perc_built), 1));
      setPercTecnico(toNum(selectedBia.perc_dir_tecnico));
      setPercAlianca(Math.max(toNum(selectedBia.perc_dir_alianca), 1));
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
      // Load member selections
      setMembroAutorOpa(selectedBia.autor_bia || "");
      setMembroAliadoBuilt(selectedBia.aliado_built || "");
      setMembroDirTecnico(selectedBia.diretor_alianca || "");
      setMembroDirNucleoTecnico(selectedBia.diretor_nucleo_tecnico || "");
      setMembroDirObras(selectedBia.diretor_execucao || "");
      setMembroDirComercial(selectedBia.diretor_comercial || "");
      setMembroDirCapital(selectedBia.diretor_capital || "");
    }
  }, [selectedBia]);

  // Calculations
  const divisorMultiplicador = percAliado + percBuilt + percTecnico + percAlianca + percObras + percComercial + percCapital;
  const custoOrigemBia = valorOrigem + (valorOrigem * divisorMultiplicador / 100);
  const cppAliado = valorOrigem * percAliado / 100;
  const cppBuilt = valorOrigem * percBuilt / 100;
  const cppTecnico = valorOrigem * percTecnico / 100;
  const cppAlianca = valorOrigem * percAlianca / 100;
  const cppObras = valorOrigem * percObras / 100;
  const cppComercial = valorOrigem * percComercial / 100;
  const cppCapital = valorOrigem * percCapital / 100;
  const custoFinalPrevisto = cppAliado + cppBuilt + cppTecnico + cppAlianca + cppObras + cppComercial + cppCapital;

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
      const r = (v: number) => parseFloat(v.toFixed(2));
      const payload = {
        divisor_multiplicador: r(divisorMultiplicador),
        perc_aliado_built: r(percAliado),
        perc_built: r(percBuilt),
        perc_dir_tecnico: r(percTecnico),
        perc_dir_alianca: r(percAlianca),
        perc_dir_obras: r(percObras),
        perc_dir_comercial: r(percComercial),
        perc_dir_capital: r(percCapital),
        cpp_aliado_built: r(cppAliado),
        cpp_built: r(cppBuilt),
        cpp_dir_tecnico: r(cppTecnico),
        cpp_dir_alianca: r(cppAlianca),
        cpp_dir_obras: r(cppObras),
        cpp_dir_comercial: r(cppComercial),
        cpp_dir_capital: r(cppCapital),
        custo_origem_bia: r(custoOrigemBia),
        custo_final_previsto: r(custoFinalPrevisto),
        valor_geral_venda_vgv: r(vgv),
        valor_realizado_venda: r(valorRealizadoVenda),
        comissao_prevista_corretor: r(comissaoCorretor),
        ir_previsto: r(irPrevisto),
        inss_previsto: r(inssPrevisto),
        manutencao_pos_obra_prevista: r(manutencao),
        total_receita: r(totalReceita),
        resultado_liquido: r(resultadoLiquido),
        lucro_previsto: r(lucroPrevisto),
        total_aportes: r(totalAportes),
        inicio_aportes: inicioAportes || null,
      };
      await apiRequest("PATCH", `/api/bias/${selectedBiaId}`, {
        ...payload,
        valor_origem: r(valorOrigem),
        _vencimento_origem: formaPagamento === "parcelado" ? null : (vencimento || null),
        _forma_pagamento: formaPagamento || null,
        _numero_parcelas: formaPagamento === "parcelado" ? numParcelasInt : null,
        _vencimentos_parcelas: formaPagamento === "parcelado" ? vencimentosParcelas : [],
        _valores_parcelas: formaPagamento === "parcelado" ? valoresParcelas : [],
      });
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
    { label: "Aliado BUILT", icon: Users, value: percAliado, setter: setPercAliado, cpp: cppAliado, color: "text-blue-500", memberId: membroAliadoBuilt, memberSetter: setMembroAliadoBuilt },
    { label: "BUILT", icon: Building2, value: percBuilt, setter: setPercBuilt, cpp: cppBuilt, color: "text-brand-gold", memberId: null, memberSetter: null, min: 1 },
    { label: "Dir. de Aliança", icon: Crown, value: percAlianca, setter: setPercAlianca, cpp: cppAlianca, color: "text-indigo-500", memberId: membroDirTecnico, memberSetter: setMembroDirTecnico, min: 1 },
    { label: "Dir. Núcleo Técnico", icon: Shield, value: percTecnico, setter: setPercTecnico, cpp: cppTecnico, color: "text-purple-500", memberId: membroDirNucleoTecnico, memberSetter: setMembroDirNucleoTecnico },
    { label: "Dir. Núcleo de Obra", icon: Hammer, value: percObras, setter: setPercObras, cpp: cppObras, color: "text-orange-500", memberId: membroDirObras, memberSetter: setMembroDirObras },
    { label: "Dir. Núcleo Comercial", icon: Briefcase, value: percComercial, setter: setPercComercial, cpp: cppComercial, color: "text-green-500", memberId: membroDirComercial, memberSetter: setMembroDirComercial },
    { label: "Dir. Núcleo de Capital", icon: Wallet, value: percCapital, setter: setPercCapital, cpp: cppCapital, color: "text-red-500", memberId: membroDirCapital, memberSetter: setMembroDirCapital },
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
                <CardTitle className="text-sm font-medium">Forma de Pagamento do Ativo de Origem</CardTitle>
                <CreditCard className="w-4 h-4 text-brand-gold" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Pagamento button — sempre no topo */}
                  <button
                    type="button"
                    onClick={() => setPagamentoModalOpen(true)}
                    className="w-full rounded-lg border border-dashed border-brand-gold/40 bg-brand-gold/5 hover:bg-brand-gold/10 transition-colors p-3 text-left space-y-1"
                    data-testid="button-open-pagamento"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-1.5 text-brand-gold">
                        <CreditCard className="w-3.5 h-3.5" />
                        Lançar Forma de Pagamento do Ativo de Origem
                      </span>
                      {formaPagamento && <span className="text-[10px] text-muted-foreground">✎ editar</span>}
                    </div>
                    {formaPagamento ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>{formaPagamento === "a_vista" ? "À Vista" : `Parcelado em ${numeroParcelas}x`}</div>
                        {formaPagamento === "parcelado" && numParcelasInt > 0 && (
                          <div>{vencimentosParcelas.filter(v => v).length}/{numParcelasInt} datas · {valoresParcelas.filter(v => v > 0).length}/{numParcelasInt} valores</div>
                        )}
                        {formaPagamento === "a_vista" && vencimento && (
                          <div>Vence: {new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60">Clique para definir forma de pagamento e valores</p>
                    )}
                  </button>

                  {/* Valor de Origem — calculado pela forma de pagamento */}
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground mb-1">Valor de Origem</p>
                    <p className="text-2xl font-bold text-brand-gold tabular-nums" data-testid="text-valor-origem">
                      {valorOrigem.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formaPagamento === "parcelado" ? "Soma das parcelas" : formaPagamento === "a_vista" ? "Valor à vista" : "Valor salvo no projeto"}
                    </p>
                  </div>
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
                Fatores de Multiplicação
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

                        {/* Member selector */}
                        {field.memberSetter !== null && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Membro</Label>
                            <MemberSelect
                              value={field.memberId || ""}
                              onChange={field.memberSetter}
                              membros={membros}
                              label={field.label}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={(field as any).min ?? 0}
                              value={field.value || ""}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value) || 0;
                                const minVal = (field as any).min ?? 0;
                                field.setter(Math.max(raw, minVal));
                              }}
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

      <PagamentoModal
        open={pagamentoModalOpen}
        onClose={() => setPagamentoModalOpen(false)}
        initialFormaPagamento={formaPagamento}
        initialNumeroParcelas={numeroParcelas}
        initialVencimento={vencimento}
        initialVencimentosParcelas={vencimentosParcelas}
        initialValoresParcelas={valoresParcelas}
        initialValorAVista={valorAVista}
        onConfirm={(d) => {
          setFormaPagamento(d.formaPagamento);
          setNumeroParcelas(d.numeroParcelas);
          setVencimento(d.vencimento);
          setVencimentosParcelas(d.vencimentosParcelas);
          setValoresParcelas(d.valoresParcelas);
          setValorAVista(d.valorAVista);
        }}
      />
    </div>
  );
}
