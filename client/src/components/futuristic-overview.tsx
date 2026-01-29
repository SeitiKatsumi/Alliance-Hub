import { useMemo } from "react";
import { TrendingUp, Activity, Zap, Target, Briefcase, DollarSign } from "lucide-react";

interface OverviewData {
  total: number;
  totalValor: number;
  nucleos: {
    tecnico: number;
    obras: number;
    comercial: number;
    capital: number;
  };
  bias?: number;
}

interface FuturisticOverviewProps {
  data: OverviewData;
  type: "oportunidades" | "bias";
}

export function FuturisticOverview({ data, type }: FuturisticOverviewProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return `R$ ${value}`;
  };

  const totalNucleos = data.nucleos.tecnico + data.nucleos.obras + data.nucleos.comercial + data.nucleos.capital;
  
  const nucleoPercentages = useMemo(() => {
    const total = totalNucleos || 1;
    return {
      tecnico: (data.nucleos.tecnico / total) * 100,
      obras: (data.nucleos.obras / total) * 100,
      comercial: (data.nucleos.comercial / total) * 100,
      capital: (data.nucleos.capital / total) * 100,
    };
  }, [data.nucleos, totalNucleos]);

  const nucleoConfig = [
    { key: "tecnico", label: "Técnico", color: "#3B82F6", percentage: nucleoPercentages.tecnico, count: data.nucleos.tecnico },
    { key: "obras", label: "Obras", color: "#22C55E", percentage: nucleoPercentages.obras, count: data.nucleos.obras },
    { key: "comercial", label: "Comercial", color: "#A855F7", percentage: nucleoPercentages.comercial, count: data.nucleos.comercial },
    { key: "capital", label: "Capital", color: "#F97316", percentage: nucleoPercentages.capital, count: data.nucleos.capital },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-brand-gold/30 bg-gradient-to-br from-brand-navy via-brand-navy/95 to-brand-navy/90 p-6" data-testid="futuristic-overview">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-brand-gold/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border border-brand-gold/5 rounded-full" />
        
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-brand-gold/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `pulse ${2 + Math.random() * 2}s infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-gold/20 border border-brand-gold/30">
              {type === "oportunidades" ? (
                <Target className="w-6 h-6 text-brand-gold" />
              ) : (
                <Briefcase className="w-6 h-6 text-brand-gold" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {type === "oportunidades" ? "Overview de Oportunidades" : "Overview das Alianças"}
              </h2>
              <p className="text-sm text-white/60">Visão geral em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">ATIVO</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="relative p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-brand-gold to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-brand-gold" />
              <span className="text-xs text-white/60 uppercase tracking-wider">Total</span>
            </div>
            <p className="text-3xl font-bold text-white">{data.total}</p>
            <p className="text-xs text-white/40 mt-1">
              {type === "oportunidades" ? "oportunidades ativas" : "alianças ativas"}
            </p>
          </div>

          <div className="relative p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-green-500 to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white/60 uppercase tracking-wider">Volume</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(data.totalValor)}</p>
            <p className="text-xs text-white/40 mt-1">valor total</p>
          </div>

          <div className="relative p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-white/60 uppercase tracking-wider">Núcleos</span>
            </div>
            <p className="text-3xl font-bold text-white">4</p>
            <p className="text-xs text-white/40 mt-1">áreas de atuação</p>
          </div>

          <div className="relative p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-orange-500 to-transparent" />
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-white/60 uppercase tracking-wider">
                {type === "oportunidades" ? "BIAs" : "Membros"}
              </span>
            </div>
            <p className="text-3xl font-bold text-white">{data.bias || 0}</p>
            <p className="text-xs text-white/40 mt-1">
              {type === "oportunidades" ? "alianças vinculadas" : "participantes"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/80">Distribuição por Núcleo</span>
            <span className="text-xs text-white/40">{totalNucleos} itens</span>
          </div>
          
          <div className="h-4 rounded-full overflow-hidden bg-white/10 flex">
            {nucleoConfig.map((nucleo, index) => (
              <div
                key={nucleo.key}
                className="h-full transition-all duration-1000 ease-out relative group"
                style={{
                  width: `${nucleo.percentage}%`,
                  backgroundColor: nucleo.color,
                  marginLeft: index > 0 ? "2px" : 0,
                }}
                title={`${nucleo.label}: ${nucleo.count}`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            {nucleoConfig.map((nucleo) => (
              <div key={nucleo.key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: nucleo.color }}
                />
                <span className="text-xs text-white/70">{nucleo.label}</span>
                <span className="text-xs font-bold text-white">{nucleo.count}</span>
                <span className="text-xs text-white/40">({nucleo.percentage.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-brand-navy flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: nucleoConfig[i].color }}
                  >
                    {nucleoConfig[i].label.charAt(0)}
                  </div>
                ))}
              </div>
              <span className="text-sm text-white/60">4 núcleos ativos</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-gold">{formatCurrency(data.totalValor)}</p>
              <p className="text-xs text-white/40">volume total de negócios</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
