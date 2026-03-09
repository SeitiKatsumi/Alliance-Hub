import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AIAnalyzer } from "@/components/ai-analyzer";
import { FuturisticOverview } from "@/components/futuristic-overview";
import { AIInsightsBlock } from "@/components/ai-insights-block";
import {
  Briefcase,
  Users,
  UserPlus,
  Star,
  MapPin,
  Target,
  Search,
  Building2,
  Wallet,
  ChevronRight,
  Crown,
  Shield,
  Hammer,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  PieChart,
  BarChart3,
  Zap,
  Layers,
  CircleDot,
  Receipt,
} from "lucide-react";

interface EtapaBia {
  nome: string;
  status: "pendente" | "em_andamento" | "concluida";
  percentual: number;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca: string;
  observacoes: string;
  localizacao?: string;
  aliado_built?: string;
  diretor_alianca?: string;
  diretor_execucao?: string;
  diretor_comercial?: string;
  diretor_capital?: string;
  autor_bia?: string;
  valor_origem?: string | number | null;
  divisor_multiplicador?: string | number | null;
  perc_autor_opa?: string | number | null;
  perc_aliado_built?: string | number | null;
  perc_built?: string | number | null;
  perc_dir_tecnico?: string | number | null;
  perc_dir_obras?: string | number | null;
  perc_dir_comercial?: string | number | null;
  perc_dir_capital?: string | number | null;
  cpp_autor_opa?: string | number | null;
  cpp_aliado_built?: string | number | null;
  cpp_built?: string | number | null;
  cpp_dir_tecnico?: string | number | null;
  cpp_dir_obras?: string | number | null;
  cpp_dir_comercial?: string | number | null;
  cpp_dir_capital?: string | number | null;
  custo_origem_bia?: string | number | null;
  custo_final_previsto?: string | number | null;
  valor_realizado_venda?: string | number | null;
  comissao_prevista_corretor?: string | number | null;
  ir_previsto?: string | number | null;
  resultado_liquido?: string | number | null;
  lucro_previsto?: string | number | null;
  etapas_da_bia?: EtapaBia[];
}

interface Membro {
  id: string;
  nome: string;
}

interface TipoOportunidade {
  id: string;
  nome_oportunidade: string;
  bia?: string;
  tipo: string;
  nucleo_alianca?: string;
  valor_origem_opa?: string | number;
}

const toNum = (v: string | number | null | undefined): number => parseFloat(String(v || "0")) || 0;

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPerc = (v: number) => `${v.toFixed(1)}%`;

const etapasDefault: EtapaBia[] = [
  { nome: "Prospecção", status: "concluida", percentual: 100 },
  { nome: "Viabilidade", status: "concluida", percentual: 100 },
  { nome: "Projeto", status: "em_andamento", percentual: 60 },
  { nome: "Aprovações", status: "pendente", percentual: 0 },
  { nome: "Fundação", status: "pendente", percentual: 0 },
  { nome: "Estrutura", status: "pendente", percentual: 0 },
  { nome: "Vedação", status: "pendente", percentual: 0 },
  { nome: "Instalações", status: "pendente", percentual: 0 },
  { nome: "Acabamentos", status: "pendente", percentual: 0 },
  { nome: "Entrega", status: "pendente", percentual: 0 },
];

const getEtapasForBia = (index: number): EtapaBia[] => {
  const progressLevels = [
    [100, 100, 60, 0, 0, 0, 0, 0, 0, 0],
    [100, 100, 100, 100, 80, 30, 0, 0, 0, 0],
  ];
  const level = progressLevels[index % progressLevels.length];
  return etapasDefault.map((etapa, i) => ({
    ...etapa,
    percentual: level[i],
    status: level[i] === 100 ? "concluida" : level[i] > 0 ? "em_andamento" : "pendente"
  }));
};

function InvestmentDivisionPanel({ projeto, fluxoTotais }: { projeto: BiasProjeto; fluxoTotais?: { entradas: number; saidas: number } }) {
  const valorOrigem = toNum(projeto.valor_origem);
  const anyPerc = toNum(projeto.perc_autor_opa) + toNum(projeto.perc_aliado_built) + toNum(projeto.perc_built) + toNum(projeto.perc_dir_tecnico) + toNum(projeto.perc_dir_obras) + toNum(projeto.perc_dir_comercial) + toNum(projeto.perc_dir_capital);
  const hasFinancials = valorOrigem > 0 || anyPerc > 0;

  const slices = useMemo(() => {
    if (!hasFinancials) return [];
    return [
      { label: "Autor OPA", perc: toNum(projeto.perc_autor_opa), cpp: toNum(projeto.cpp_autor_opa), color: "#D7BB7D" },
      { label: "Aliado Built", perc: toNum(projeto.perc_aliado_built), cpp: toNum(projeto.cpp_aliado_built), color: "#3B82F6" },
      { label: "Built", perc: toNum(projeto.perc_built), cpp: toNum(projeto.cpp_built), color: "#001D34" },
      { label: "Dir. Técnico", perc: toNum(projeto.perc_dir_tecnico), cpp: toNum(projeto.cpp_dir_tecnico), color: "#6366F1" },
      { label: "Dir. Obras", perc: toNum(projeto.perc_dir_obras), cpp: toNum(projeto.cpp_dir_obras), color: "#22C55E" },
      { label: "Dir. Comercial", perc: toNum(projeto.perc_dir_comercial), cpp: toNum(projeto.cpp_dir_comercial), color: "#A855F7" },
      { label: "Dir. Capital", perc: toNum(projeto.perc_dir_capital), cpp: toNum(projeto.cpp_dir_capital), color: "#F97316" },
    ];
  }, [projeto, hasFinancials]);

  const divisor = toNum(projeto.divisor_multiplicador) || anyPerc || 1;
  const custoOrigem = toNum(projeto.custo_origem_bia);
  const custoFinal = toNum(projeto.custo_final_previsto);
  const valorVenda = toNum(projeto.valor_realizado_venda);
  const resultado = toNum(projeto.resultado_liquido);
  const lucro = toNum(projeto.lucro_previsto);

  if (!hasFinancials) {
    return (
      <div className="relative rounded-lg border border-dashed border-white/20 bg-white/5 p-4 text-center" data-testid="panel-investimento-vazio">
        <PieChart className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-sm text-white/40">Gestão financeira não configurada</p>
        <p className="text-xs text-white/25 mt-1">Use a Calculadora DM para definir a divisão</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-brand-gold/20 bg-gradient-to-br from-brand-navy/80 via-brand-navy/60 to-brand-navy/40 p-4 space-y-4" data-testid="panel-investimento">
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-gold/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-brand-gold flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Divisão de Investimentos
          </h4>
          <Badge variant="outline" className="text-[10px] border-brand-gold/30 text-brand-gold bg-brand-gold/10">
            Divisor: {formatPerc(divisor)}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-brand-gold" />
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Valor Origem</span>
            </div>
            <p className="text-sm font-bold text-white">{formatBRL(valorOrigem)}</p>
          </div>
          <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Custo Origem</span>
            </div>
            <p className="text-sm font-bold text-white">{formatBRL(custoOrigem)}</p>
          </div>
          <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Receipt className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-white/50 uppercase tracking-wider">CPP Total</span>
            </div>
            <p className="text-sm font-bold text-white">{formatBRL(custoFinal)}</p>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="h-5 rounded-md overflow-hidden bg-white/10 flex">
            {slices.filter(s => s.perc > 0).map((slice, i) => (
              <div
                key={i}
                className="h-full relative group transition-all duration-700 ease-out"
                style={{
                  width: `${(slice.perc / divisor) * 100}%`,
                  backgroundColor: slice.color,
                  marginLeft: i > 0 ? "1px" : 0,
                }}
                title={`${slice.label}: ${formatPerc(slice.perc)} = ${formatBRL(slice.cpp)}`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-x-4 gap-y-1">
            {slices.filter(s => s.perc > 0).map((slice, i) => (
              <div key={i} className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: slice.color, boxShadow: `0 0 6px ${slice.color}40` }}
                />
                <span className="text-[10px] text-white/60 truncate">{slice.label}</span>
                <span className="text-[10px] font-bold text-white ml-auto shrink-0">{formatPerc(slice.perc)}</span>
              </div>
            ))}
          </div>
        </div>

        {valorVenda > 0 && (
          <>
            <Separator className="bg-white/10" />
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">Venda</span>
                </div>
                <p className="text-sm font-bold text-white">{formatBRL(valorVenda)}</p>
              </div>
              <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">Resultado</span>
                </div>
                <p className={`text-sm font-bold ${resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatBRL(resultado)}
                </p>
              </div>
              <div className="p-2.5 rounded-md border" style={{ borderColor: lucro >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)", background: lucro >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3 h-3" style={{ color: lucro >= 0 ? "#10B981" : "#EF4444" }} />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">Lucro</span>
                </div>
                <p className={`text-lg font-black ${lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatPerc(lucro)}
                </p>
              </div>
            </div>
          </>
        )}

        {fluxoTotais && (fluxoTotais.entradas > 0 || fluxoTotais.saidas > 0) && (
          <>
            <Separator className="bg-white/10" />
            <div className="pt-3">
              <h5 className="text-[10px] text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wallet className="w-3 h-3 text-brand-gold" />
                Fluxo de Caixa
              </h5>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-2.5 rounded-md bg-white/5 border border-green-500/20" data-testid="fluxo-total-aportes">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">Total Aportes</span>
                  </div>
                  <p className="text-sm font-bold text-green-400">{formatBRL(fluxoTotais.entradas)}</p>
                </div>
                <div className="p-2.5 rounded-md bg-white/5 border border-red-500/20" data-testid="fluxo-custo-obra">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">Custo da Obra</span>
                  </div>
                  <p className="text-sm font-bold text-red-400">{formatBRL(fluxoTotais.saidas)}</p>
                </div>
                <div className="p-2.5 rounded-md border" style={{ borderColor: (fluxoTotais.entradas - fluxoTotais.saidas) >= 0 ? "rgba(212,187,125,0.3)" : "rgba(239,68,68,0.3)", background: (fluxoTotais.entradas - fluxoTotais.saidas) >= 0 ? "rgba(212,187,125,0.1)" : "rgba(239,68,68,0.1)" }} data-testid="fluxo-saldo">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wallet className="w-3 h-3" style={{ color: (fluxoTotais.entradas - fluxoTotais.saidas) >= 0 ? "#D7BB7D" : "#EF4444" }} />
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">Saldo</span>
                  </div>
                  <p className={`text-sm font-bold ${(fluxoTotais.entradas - fluxoTotais.saidas) >= 0 ? "text-brand-gold" : "text-red-400"}`}>
                    {formatBRL(fluxoTotais.entradas - fluxoTotais.saidas)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BiasPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: bias = [], isLoading } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const { data: oportunidades = [] } = useQuery<TipoOportunidade[]>({
    queryKey: ["/api/oportunidades"],
  });

  const { data: fluxoCaixa = [] } = useQuery<{ id: string; bia: string; tipo: string; valor: string | number }[]>({
    queryKey: ["/api/fluxo-caixa"],
  });

  const fluxoTotaisPorBia = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number }> = {};
    fluxoCaixa.forEach((item) => {
      const biaId = typeof item.bia === "object" && item.bia !== null ? (item.bia as any).id : item.bia;
      if (!biaId) return;
      if (!map[biaId]) map[biaId] = { entradas: 0, saidas: 0 };
      const val = parseFloat(String(item.valor)) || 0;
      if (item.tipo === "entrada") map[biaId].entradas += val;
      else if (item.tipo === "saida") map[biaId].saidas += val;
    });
    return map;
  }, [fluxoCaixa]);

  const getMemberName = (id: string | undefined) => {
    if (!id) return "Não definido";
    const member = membros.find(m => m.id === id);
    return member?.nome || "Carregando...";
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const getAuraScore = (id: string | undefined) => {
    if (!id) return 0;
    const scores: Record<string, number> = {};
    membros.forEach((m, i) => {
      scores[m.id] = 65 + ((i * 17) % 30);
    });
    return scores[id] || 75;
  };

  const getOportunidadesForBia = (biaId: string) => {
    return oportunidades.filter(o => o.bia === biaId);
  };

  const filteredBias = bias.filter(b =>
    b.nome_bia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.objetivo_alianca?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInvestido = useMemo(() => {
    return bias.reduce((acc, b) => acc + toNum(b.valor_origem), 0);
  }, [bias]);

  const totalResultado = useMemo(() => {
    return bias.reduce((acc, b) => acc + toNum(b.resultado_liquido), 0);
  }, [bias]);

  const nucleoConfig = {
    tecnico: { icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "shadow-blue-500/20", label: "Núcleo Técnico" },
    obras: { icon: Hammer, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", glow: "shadow-green-500/20", label: "Núcleo de Obras" },
    comercial: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", glow: "shadow-purple-500/20", label: "Núcleo Comercial" },
    capital: { icon: Wallet, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", glow: "shadow-orange-500/20", label: "Núcleo de Capital" },
  };

  const diretoriaConfig = [
    { key: "autor_bia", label: "Autor da BIA", icon: Crown, color: "bg-brand-gold text-brand-navy" },
    { key: "aliado_built", label: "Aliado Built", icon: Shield, color: "bg-blue-600 text-white" },
    { key: "diretor_alianca", label: "Dir. Aliança", icon: Shield, color: "bg-brand-navy text-white" },
    { key: "diretor_execucao", label: "Dir. Obra", icon: Hammer, color: "bg-green-600 text-white" },
    { key: "diretor_comercial", label: "Dir. Comercial", icon: TrendingUp, color: "bg-purple-600 text-white" },
    { key: "diretor_capital", label: "Dir. Capital", icon: DollarSign, color: "bg-orange-600 text-white" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-brand-gold/20 bg-gradient-to-r from-brand-navy via-brand-navy/95 to-brand-navy p-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-brand-gold/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-brand-gold/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `pulse ${2 + Math.random() * 3}s infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-gold/20 border border-brand-gold/30">
                <Briefcase className="w-6 h-6 text-brand-gold" />
              </div>
              BIAS - Alianças para Execução de Obras
            </h1>
            <p className="text-white/50 mt-1 ml-14">
              Gerencie e acompanhe as alianças estratégicas e seus participantes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-brand-gold/30 text-brand-gold bg-brand-gold/10 px-3 py-1 text-base">
              {bias.length} Alianças
            </Badge>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-400">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      <FuturisticOverview
        data={{
          total: bias.length,
          totalValor: oportunidades.reduce((acc, o) => acc + (parseFloat(String(o.valor_origem_opa)) || 0), 0),
          nucleos: {
            tecnico: oportunidades.filter(o => o.nucleo_alianca?.toLowerCase().includes("tecnico")).length,
            obras: oportunidades.filter(o => o.nucleo_alianca?.toLowerCase().includes("obra")).length,
            comercial: oportunidades.filter(o => o.nucleo_alianca?.toLowerCase().includes("comercial")).length,
            capital: oportunidades.filter(o => o.nucleo_alianca?.toLowerCase().includes("capital")).length,
          },
          bias: membros.length,
        }}
        type="bias"
      />

      <AIInsightsBlock
        type="bias"
        data={bias}
        membrosCount={membros.length}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          placeholder="Buscar alianças por nome ou objetivo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-brand-gold/20 focus:border-brand-gold/40"
          data-testid="input-busca-bias"
        />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse border-brand-gold/10">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBias.length === 0 ? (
        <Card className="border-dashed border-brand-gold/20">
          <CardContent className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma aliança encontrada</h3>
            <p className="text-muted-foreground">Tente ajustar os termos de busca</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredBias.map((projeto, biaIndex) => {
            const biaOportunidades = getOportunidadesForBia(projeto.id);
            const etapas = getEtapasForBia(biaIndex);
            const progressoGeral = Math.round(etapas.reduce((acc, e) => acc + e.percentual, 0) / etapas.length);

            return (
              <div
                key={projeto.id}
                className="relative group"
                data-testid={`card-bia-${projeto.id}`}
              >
                <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-brand-gold/30 via-transparent to-brand-gold/30 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                <Card className="relative overflow-visible border-brand-gold/20 bg-card">
                  <div className="h-1 w-full bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-brand-navy text-brand-gold border border-brand-gold/20 shrink-0" style={{ boxShadow: "0 0 15px rgba(215,187,125,0.15)" }}>
                          <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{projeto.nome_bia}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {projeto.objetivo_alianca || "Aliança estratégica para execução de obras"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {projeto.localizacao && (
                          <Badge variant="outline" className="shrink-0">
                            <MapPin className="w-3 h-3 mr-1" />
                            {projeto.localizacao}
                          </Badge>
                        )}
                        <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/30">
                          {progressoGeral}% Concluído
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-brand-gold" />
                        Diretoria da Aliança
                      </h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {diretoriaConfig.map((dir) => {
                          const memberId = projeto[dir.key as keyof BiasProjeto] as string | undefined;
                          const memberName = getMemberName(memberId);
                          const isUUID = memberId && memberId.includes("-");
                          const aura = getAuraScore(memberId);
                          const DirIcon = dir.icon;

                          return (
                            <div key={dir.key} className="text-center">
                              <div className="relative inline-block mb-1.5">
                                <Avatar className="w-10 h-10 border-2 border-background shadow-lg">
                                  <AvatarFallback className={dir.color}>
                                    {isUUID ? getInitials(memberName) : <DirIcon className="w-4 h-4" />}
                                  </AvatarFallback>
                                </Avatar>
                                {isUUID && (
                                  <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-brand-gold text-brand-navy rounded-full w-4 h-4 flex items-center justify-center shadow">
                                    {aura}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium truncate">
                                {isUUID ? memberName.split(" ")[0] : (memberId || "—")}
                              </p>
                              <p className="text-[9px] text-muted-foreground">{dir.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <InvestmentDivisionPanel projeto={projeto} fluxoTotais={fluxoTotaisPorBia[projeto.id]} />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(nucleoConfig).map(([key, config]) => {
                        const NucleoIcon = config.icon;
                        const nucleoOportunidades = biaOportunidades.filter(o => {
                          const nucleo = o.nucleo_alianca?.toLowerCase() || "";
                          if (key === "tecnico") return nucleo.includes("tecnico") || nucleo.includes("técnico");
                          if (key === "obras") return nucleo.includes("obras");
                          if (key === "comercial") return nucleo.includes("comercial");
                          if (key === "capital") return nucleo.includes("capital");
                          return false;
                        });

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border ${config.bg} ${config.border} hover-elevate cursor-pointer transition-all`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <NucleoIcon className={`w-4 h-4 ${config.color}`} />
                              <span className="text-xs font-medium">{config.label}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-2xl font-bold">{nucleoOportunidades.length}</span>
                              <span className="text-[10px] text-muted-foreground">OPAs</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <CircleDot className="w-3 h-3" />
                          Andamento da Obra
                        </h4>
                        <span className="text-sm font-bold text-brand-gold">{progressoGeral}%</span>
                      </div>
                      <div className="flex gap-0.5 rounded-md overflow-hidden">
                        {etapas.map((etapa, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center group/etapa">
                            <div
                              className={`w-full h-2.5 transition-all ${
                                etapa.status === "concluida" ? "bg-brand-gold" :
                                etapa.status === "em_andamento" ? "bg-brand-gold/40" :
                                "bg-muted"
                              }`}
                              title={`${etapa.nome}: ${etapa.percentual}%`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[8px] text-muted-foreground pt-0.5">
                        {etapas.map((etapa, i) => (
                          <span key={i} className="flex-1 text-center truncate px-0.5">
                            {etapa.nome}
                          </span>
                        ))}
                      </div>
                    </div>

                    {biaOportunidades.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Target className="w-3 h-3 text-brand-gold" />
                          Oportunidades Abertas ({biaOportunidades.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {biaOportunidades.slice(0, 3).map((opa) => (
                            <div
                              key={opa.id}
                              className="p-2.5 rounded-md border bg-background hover-elevate cursor-pointer flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
                              <span className="text-sm truncate flex-1">{opa.nome_oportunidade}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{opa.tipo}</Badge>
                            </div>
                          ))}
                          {biaOportunidades.length > 3 && (
                            <div className="p-2.5 rounded-md border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
                              +{biaOportunidades.length - 3} mais
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      <Button size="sm" variant="default" data-testid={`button-participar-bia-${projeto.id}`}>
                        <Briefcase className="w-3 h-3 mr-1" />
                        Participar
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`button-convidar-bia-${projeto.id}`}>
                        <UserPlus className="w-3 h-3 mr-1" />
                        Convidar
                      </Button>
                      <Button size="sm" variant="secondary" data-testid={`button-avaliar-bia-${projeto.id}`}>
                        <Star className="w-3 h-3 mr-1" />
                        Avaliar
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" data-testid={`button-ver-mais-bia-${projeto.id}`}>
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Ver Detalhes
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Briefcase className="w-5 h-5 text-brand-gold" />
                              {projeto.nome_bia}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <h4 className="font-medium mb-2">Objetivo da Aliança</h4>
                              <p className="text-sm text-muted-foreground">
                                {projeto.objetivo_alianca || "Aliança estratégica para execução de obras de alto padrão."}
                              </p>
                            </div>
                            {projeto.observacoes && (
                              <div>
                                <h4 className="font-medium mb-2">Observações</h4>
                                <p className="text-sm text-muted-foreground">{projeto.observacoes}</p>
                              </div>
                            )}
                            <div>
                              <h4 className="font-medium mb-2">Oportunidades Disponíveis</h4>
                              <div className="space-y-2">
                                {biaOportunidades.map((opa) => (
                                  <div key={opa.id} className="p-3 rounded-md border flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-medium text-sm">{opa.nome_oportunidade}</p>
                                      <p className="text-xs text-muted-foreground">{opa.nucleo_alianca}</p>
                                    </div>
                                    <Badge>{opa.tipo}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <AIAnalyzer
                        type="bia"
                        id={projeto.id}
                        title={projeto.nome_bia}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-brand-gold/30 bg-gradient-to-br from-brand-navy via-brand-navy/95 to-brand-navy/90 p-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-brand-gold/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-brand-gold/30 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animation: `pulse ${2 + Math.random() * 2}s infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
          <div>
            <p className="text-3xl font-black text-brand-gold">{bias.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Alianças</p>
          </div>
          <div>
            <p className="text-3xl font-black text-brand-gold">{oportunidades.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Oportunidades</p>
          </div>
          <div>
            <p className="text-3xl font-black text-brand-gold">{membros.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Membros</p>
          </div>
          <div>
            <p className="text-3xl font-black text-white">{totalInvestido > 0 ? formatBRL(totalInvestido) : "—"}</p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Investido</p>
          </div>
          <div>
            <p className={`text-3xl font-black ${totalResultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalResultado !== 0 ? formatBRL(totalResultado) : "—"}
            </p>
            <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Resultado</p>
          </div>
        </div>
      </div>
    </div>
  );
}
