import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuraScore } from "@/components/aura-score";
import { FuturisticChart } from "@/components/futuristic-chart";
import { AIAssistant } from "@/components/ai-assistant";
import { Users, Target, Briefcase, TrendingUp, Star, History, UserCheck } from "lucide-react";

interface CadastroGeral {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cidade: string;
  estado: string;
  responsavel_cargo: string;
}

export default function Dashboard() {
  const { data: membros = [] } = useQuery<CadastroGeral[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const { data: bias = [] } = useQuery<any[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const { data: oportunidades = [] } = useQuery<any[]>({
    queryKey: ["/api/directus/funil_de_conversao"],
  });

  const currentUser = membros[0];
  const auraScore = 78;

  const statsData = [
    { label: "Jan", value: 45 },
    { label: "Fev", value: 62 },
    { label: "Mar", value: 58 },
    { label: "Abr", value: 75 },
    { label: "Mai", value: 82 },
    { label: "Jun", value: 78 },
  ];

  const distributionData = [
    { label: "BIAS", value: bias.length || 4, color: "#001D34" },
    { label: "Oportunidades", value: oportunidades.length || 5, color: "#D7BB7D" },
    { label: "Membros", value: membros.length || 4, color: "#6A7984" },
  ];

  const activityData = [
    { label: "Seg", value: 12 },
    { label: "Ter", value: 19 },
    { label: "Qua", value: 15 },
    { label: "Qui", value: 25 },
    { label: "Sex", value: 22 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vindo, {currentUser?.nome?.split(" ")[0] || "Membro"}
          </h1>
          <p className="text-muted-foreground">
            Seu painel de gestão Built Alliances
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          <Star className="w-3 h-3 mr-1" />
          Founding Member
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-secondary/30" data-testid="card-aura">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Score Aura
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <AuraScore score={auraScore} size="lg" />
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="default" data-testid="button-avaliar-membro">
                <UserCheck className="w-4 h-4 mr-1" />
                Avaliar Membro
              </Button>
              <Button size="sm" variant="outline" data-testid="button-analisar-aura">
                <TrendingUp className="w-4 h-4 mr-1" />
                Analisar Aura
              </Button>
              <Button size="sm" variant="outline" data-testid="button-historico">
                <History className="w-4 h-4 mr-1" />
                Ver Histórico
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-evolucao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Evolução do Score</CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={statsData} type="line" height={140} />
          </CardContent>
        </Card>

        <Card data-testid="card-distribuicao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição</CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={distributionData} type="radial" height={140} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" data-testid="stat-membros">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{membros.length || 4}</p>
              <p className="text-sm text-muted-foreground">Membros Ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="stat-bias">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-secondary/20">
              <Briefcase className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{bias.length || 4}</p>
              <p className="text-sm text-muted-foreground">Projetos BIAS</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="stat-oportunidades">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/20">
              <Target className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{oportunidades.length || 5}</p>
              <p className="text-sm text-muted-foreground">Oportunidades</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="stat-aura">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{auraScore}</p>
              <p className="text-sm text-muted-foreground">Score Médio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-andamento-bias">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand-gold" />
            Andamento das BIAS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(bias.length > 0 ? bias.slice(0, 4) : [
              { id: "1", nome_bia: "BIA Infraestrutura Inteligente" },
              { id: "2", nome_bia: "BIA Tecnologia Verde" },
              { id: "3", nome_bia: "BIA Transformação Digital" },
            ]).map((bia: any, index: number) => {
              const progressLevels = [26, 53, 77, 15];
              const progress = progressLevels[index % progressLevels.length];
              return (
                <div key={bia.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate max-w-xs">{bia.nome_bia}</p>
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        progress >= 70 ? "bg-brand-gold" : 
                        progress >= 40 ? "bg-brand-navy" : 
                        "bg-brand-gray"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIAssistant />
        
        <Card data-testid="card-atividade">
          <CardHeader>
            <CardTitle>Atividade Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={activityData} type="bar" height={180} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
