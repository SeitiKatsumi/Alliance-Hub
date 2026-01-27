import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuraScore } from "@/components/aura-score";
import { FuturisticChart } from "@/components/futuristic-chart";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Sparkles, 
  Users, 
  TrendingUp,
  Award,
  Zap,
  Target,
  BarChart3,
  Activity
} from "lucide-react";

interface Membro {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
}

export default function AuraPage() {
  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const { data: bias = [] } = useQuery<any[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const { data: oportunidades = [] } = useQuery<any[]>({
    queryKey: ["/api/directus/funil_de_conversao"],
  });

  const getAuraScore = (index: number) => 65 + ((index * 17) % 30);
  
  const membrosWithAura = membros.map((m, i) => ({
    ...m,
    aura: getAuraScore(i)
  })).sort((a, b) => b.aura - a.aura);

  const ecosystemAura = membrosWithAura.length > 0 
    ? Math.round(membrosWithAura.reduce((acc, m) => acc + m.aura, 0) / membrosWithAura.length)
    : 78;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const auraDistribution = [
    { label: "90-100", value: membrosWithAura.filter(m => m.aura >= 90).length || 1, color: "#D7BB7D" },
    { label: "80-89", value: membrosWithAura.filter(m => m.aura >= 80 && m.aura < 90).length || 2, color: "#001D34" },
    { label: "70-79", value: membrosWithAura.filter(m => m.aura >= 70 && m.aura < 80).length || 3, color: "#6A7984" },
    { label: "60-69", value: membrosWithAura.filter(m => m.aura >= 60 && m.aura < 70).length || 2, color: "#B8B4B4" },
  ];

  const auraEvolution = [
    { label: "Jan", value: 72 },
    { label: "Fev", value: 74 },
    { label: "Mar", value: 73 },
    { label: "Abr", value: 76 },
    { label: "Mai", value: 78 },
    { label: "Jun", value: ecosystemAura },
  ];

  const engagementData = [
    { label: "BIAS", value: bias.length || 4, color: "#001D34" },
    { label: "Oportunidades", value: oportunidades.length || 5, color: "#D7BB7D" },
    { label: "Conexões", value: membros.length * 3 || 12, color: "#6A7984" },
  ];

  const activityByRegion = [
    { label: "SP", value: membros.filter(m => m.estado === "SP").length || 2 },
    { label: "RJ", value: membros.filter(m => m.estado === "RJ").length || 1 },
    { label: "MG", value: membros.filter(m => m.estado === "MG").length || 1 },
    { label: "Outros", value: 2 },
  ];

  const healthMetrics = [
    { label: "Engajamento", value: 85, icon: Activity, color: "text-brand-gold" },
    { label: "Colaboração", value: 78, icon: Users, color: "text-brand-navy" },
    { label: "Crescimento", value: 92, icon: TrendingUp, color: "text-brand-gold" },
    { label: "Conversão", value: 67, icon: Target, color: "text-brand-gray" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-gold" />
            AURA Built - Ecossistema
          </h1>
          <p className="text-muted-foreground">
            Panorama geral da saúde e performance do ecossistema
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 bg-brand-gold/10 text-brand-gold border-brand-gold/30">
          <Zap className="w-3 h-3 mr-1" />
          Score Geral: {ecosystemAura}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {healthMetrics.map((metric, i) => (
          <Card key={i} className="hover-elevate" data-testid={`metric-${metric.label.toLowerCase()}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-muted ${metric.color}`}>
                <metric.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold">{metric.value}%</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-gold rounded-full transition-all"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:row-span-2 border-brand-gold/20" data-testid="card-aura-ecosystem">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-gold" />
              Aura do Ecossistema
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 py-4">
            <AuraScore score={ecosystemAura} size="lg" />
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold">{ecosystemAura} pontos</p>
              <p className="text-sm text-muted-foreground">
                Média de {membros.length} membros ativos
              </p>
            </div>
            <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t">
              <div className="text-center">
                <p className="text-lg font-bold text-brand-gold">+12%</p>
                <p className="text-xs text-muted-foreground">vs. mês anterior</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-brand-gold">{bias.length}</p>
                <p className="text-xs text-muted-foreground">BIAS ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-evolucao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary" />
              Evolução Aura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={auraEvolution} type="line" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-distribuicao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-secondary" />
              Distribuição por Faixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={auraDistribution} type="bar" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-engajamento">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-secondary" />
              Engajamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={engagementData} type="radial" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-regioes">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" />
              Membros por Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={activityByRegion} type="bar" height={160} />
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-ranking">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-gold" />
            Ranking de Aura - Top Membros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {membrosWithAura.slice(0, 8).map((membro, index) => (
              <div 
                key={membro.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate"
                data-testid={`ranking-member-${index}`}
              >
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-brand-navy text-white text-sm">
                      {getInitials(membro.nome)}
                    </AvatarFallback>
                  </Avatar>
                  {index < 3 && (
                    <span className={`absolute -top-1 -right-1 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      index === 0 ? 'bg-brand-gold text-brand-navy' :
                      index === 1 ? 'bg-brand-gray text-white' :
                      'bg-brand-navy text-white'
                    }`}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{membro.nome.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground">
                    {membro.cidade || "Brasil"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-brand-gold">{membro.aura}</p>
                  <p className="text-xs text-muted-foreground">aura</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
