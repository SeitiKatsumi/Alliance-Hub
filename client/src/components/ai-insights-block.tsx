import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  Target, 
  Lightbulb,
  DollarSign,
  Users,
  Building2,
  ChevronRight,
  RefreshCw,
  Zap,
  Award,
  BarChart3,
  Briefcase
} from "lucide-react";

interface InsightItem {
  icon: any;
  title: string;
  description: string;
  highlight?: string;
  type: "success" | "info" | "warning" | "gold";
}

interface AIInsightsBlockProps {
  type: "oportunidades" | "bias";
  data: any[];
  biasData?: any[];
  membrosCount?: number;
}

export function AIInsightsBlock({ type, data, biasData = [], membrosCount = 0 }: AIInsightsBlockProps) {
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const analyzeWithAI = useMutation({
    mutationFn: async () => {
      const context = type === "oportunidades" 
        ? `Analise estas ${data.length} oportunidades de aliança: ${JSON.stringify(data.slice(0, 5).map(o => ({
            nome: o.nome_oportunidade,
            tipo: o.tipo,
            valor: o.valor_origem_opa,
            nucleo: o.nucleo_alianca
          })))}. Dê insights estratégicos em português sobre qual oportunidade é mais atrativa, qual tem melhor ROI potencial, e uma dica de mercado.`
        : `Analise estas ${data.length} BIAs (Built Intelligence Alliances): ${JSON.stringify(data.map(b => ({
            nome: b.nome_bia,
            objetivo: b.objetivo_alianca,
            localizacao: b.localizacao
          })))}. Explique em português o potencial de cada aliança, riscos e oportunidades de participação.`;
      
      const res = await apiRequest("POST", "/api/ai/analyze", { 
        prompt: context,
        type 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setAiResponse(data.analysis);
    }
  });

  const generateSmartInsights = (): InsightItem[] => {
    if (type === "oportunidades") {
      const totalValor = data.reduce((acc, o) => acc + (parseFloat(o.valor_origem_opa) || 0), 0);
      const tipoCount = data.reduce((acc: Record<string, number>, o) => {
        acc[o.tipo] = (acc[o.tipo] || 0) + 1;
        return acc;
      }, {});
      
      const maiorOportunidade = data.reduce((max, o) => 
        (parseFloat(o.valor_origem_opa) || 0) > (parseFloat(max?.valor_origem_opa) || 0) ? o : max
      , data[0]);

      const menorOportunidade = data.reduce((min, o) => 
        (parseFloat(o.valor_origem_opa) || 0) < (parseFloat(min?.valor_origem_opa) || 0) ? o : min
      , data[0]);

      const opaCapital = data.filter(o => o.tipo === "OPA-CAP");
      const valorCapital = opaCapital.reduce((acc, o) => acc + (parseFloat(o.valor_origem_opa) || 0), 0);

      return [
        {
          icon: Target,
          title: "Melhor Entrada",
          description: menorOportunidade?.nome_oportunidade || "Nenhuma",
          highlight: `R$ ${((parseFloat(menorOportunidade?.valor_origem_opa) || 0) / 1000).toFixed(0)}K`,
          type: "success"
        },
        {
          icon: DollarSign,
          title: "Maior Oportunidade",
          description: maiorOportunidade?.nome_oportunidade || "Nenhuma",
          highlight: `R$ ${((parseFloat(maiorOportunidade?.valor_origem_opa) || 0) / 1000000).toFixed(1)}M`,
          type: "gold"
        },
        {
          icon: TrendingUp,
          title: "Oportunidades de Capital",
          description: `${opaCapital.length} captações disponíveis`,
          highlight: `R$ ${(valorCapital / 1000000).toFixed(1)}M`,
          type: "info"
        },
        {
          icon: Lightbulb,
          title: "Recomendação IA",
          description: tipoCount["OPA-TEC"] >= 3 
            ? "Alto volume técnico - ideal para especialistas" 
            : "Mercado diversificado - explore múltiplos núcleos",
          highlight: "Dica",
          type: "warning"
        }
      ];
    } else {
      const vendasBias = data.filter(b => b.objetivo_alianca === "venda");
      const rendaBias = data.filter(b => b.objetivo_alianca === "renda");
      
      return [
        {
          icon: Building2,
          title: "Alianças Ativas",
          description: `${data.length} projetos em andamento`,
          highlight: `${data.length} BIAs`,
          type: "success"
        },
        {
          icon: BarChart3,
          title: "Modelo Venda",
          description: `${vendasBias.length} projetos para comercialização`,
          highlight: vendasBias.length > 0 ? "Ativo" : "Nenhum",
          type: "gold"
        },
        {
          icon: TrendingUp,
          title: "Modelo Renda",
          description: `${rendaBias.length} projetos para renda passiva`,
          highlight: rendaBias.length > 0 ? "Ativo" : "Nenhum",
          type: "info"
        },
        {
          icon: Users,
          title: "Participantes",
          description: "Cadastros ativos nas alianças",
          highlight: `${membrosCount}+ membros`,
          type: "warning"
        }
      ];
    }
  };

  const insights = generateSmartInsights();
  const typeColors = {
    success: "bg-green-500/10 text-green-600 border-green-200",
    info: "bg-blue-500/10 text-blue-600 border-blue-200",
    warning: "bg-amber-500/10 text-amber-600 border-amber-200",
    gold: "bg-brand-gold/20 text-brand-gold border-brand-gold/30"
  };

  return (
    <Card className="relative overflow-hidden border-brand-gold/20 bg-gradient-to-br from-brand-navy/5 via-transparent to-brand-gold/5">
      <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/5 to-brand-gold/5 opacity-50" />
      <div className="absolute top-0 left-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-24 h-24 bg-brand-navy/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
      
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                Insights Inteligentes
              </h3>
              <p className="text-xs text-muted-foreground">
                {type === "oportunidades" 
                  ? "Análise personalizada das oportunidades" 
                  : "Visão estratégica das alianças"}
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => analyzeWithAI.mutate()}
            disabled={analyzeWithAI.isPending}
            className="border-brand-gold/30 hover:bg-brand-gold/10"
            data-testid="button-analyze-ai"
          >
            {analyzeWithAI.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2 text-brand-gold" />
            )}
            Análise Profunda
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${typeColors[insight.type]} hover-elevate cursor-pointer transition-all`}
                data-testid={`insight-card-${index}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <Icon className="w-5 h-5" />
                  {insight.highlight && (
                    <Badge variant="outline" className="text-xs font-medium">
                      {insight.highlight}
                    </Badge>
                  )}
                </div>
                <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                <p className="text-xs opacity-80 line-clamp-2">{insight.description}</p>
              </div>
            );
          })}
        </div>

        {aiResponse && (
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-brand-navy/10 to-brand-gold/10 border border-brand-gold/20">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-brand-gold" />
              <span className="font-medium text-sm">Análise da IA</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {isExpanded ? aiResponse : aiResponse.slice(0, 300) + (aiResponse.length > 300 ? "..." : "")}
            </p>
            {aiResponse.length > 300 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-brand-gold"
              >
                {isExpanded ? "Ver menos" : "Ver mais"}
                <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </Button>
            )}
          </div>
        )}

        {analyzeWithAI.isPending && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-gold" />
              <span className="text-sm text-muted-foreground">Analisando com IA...</span>
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {type === "oportunidades" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs bg-brand-navy/5">
              <Briefcase className="w-3 h-3 mr-1" />
              {data.length} oportunidades ativas
            </Badge>
            <Badge variant="outline" className="text-xs bg-brand-gold/5">
              <DollarSign className="w-3 h-3 mr-1" />
              R$ {(data.reduce((acc, o) => acc + (parseFloat(o.valor_origem_opa) || 0), 0) / 1000000).toFixed(1)}M em oportunidades
            </Badge>
            {biasData.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                {biasData.length} BIAs vinculadas
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
