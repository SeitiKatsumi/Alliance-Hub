import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FuturisticChart } from "@/components/futuristic-chart";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Briefcase, 
  Users, 
  UserPlus, 
  Star,
  MapPin,
  Target,
  TrendingUp
} from "lucide-react";

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca: string;
  observacoes: string;
  diretor_alianca?: string;
  diretor_execucao?: string;
  diretor_comercial?: string;
  diretor_capital?: string;
}

interface Membro {
  id: string;
  nome: string;
}

export default function BiasPage() {
  const { data: bias = [], isLoading } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const getMemberName = (id: string | undefined) => {
    if (!id) return "Não definido";
    const member = membros.find(m => m.id === id);
    return member?.nome || "Carregando...";
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const statsData = [
    { label: "Em Andamento", value: 2, color: "#001D34" },
    { label: "Planejamento", value: 1, color: "#D7BB7D" },
    { label: "Concluídos", value: 1, color: "#6A7984" },
  ];

  const progressData = [
    { label: "Jan", value: 1 },
    { label: "Fev", value: 2 },
    { label: "Mar", value: 2 },
    { label: "Abr", value: 3 },
    { label: "Mai", value: 4 },
    { label: "Jun", value: 4 },
  ];

  const participationData = [
    { label: "Diretores", value: 8, color: "#001D34" },
    { label: "Participantes", value: 12, color: "#D7BB7D" },
    { label: "Observadores", value: 5, color: "#6A7984" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-secondary" />
            BIAS - Projetos de Aliança
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe os projetos de aliança estratégica
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          {bias.length} Projetos Ativos
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card data-testid="chart-status">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-4 h-4 text-secondary" />
              Status dos Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={statsData} type="radial" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-evolucao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary" />
              Evolução de BIAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={progressData} type="line" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-participacao">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" />
              Participação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={participationData} type="bar" height={160} />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Todos os Projetos BIAS</h2>
        <div className="flex gap-2">
          <Button variant="default" data-testid="button-participar-bia">
            <Briefcase className="w-4 h-4 mr-2" />
            Participar da BIA
          </Button>
          <Button variant="outline" data-testid="button-convidar-bia">
            <UserPlus className="w-4 h-4 mr-2" />
            Convidar Membro
          </Button>
          <Button variant="secondary" data-testid="button-avaliar-bia">
            <Star className="w-4 h-4 mr-2" />
            Avaliar BIA
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bias.map((projeto) => (
            <Card 
              key={projeto.id} 
              className="hover-elevate cursor-pointer border-l-4 border-l-secondary"
              data-testid={`card-bia-${projeto.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{projeto.nome_bia}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {projeto.objetivo_alianca || "Sem descrição"}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <MapPin className="w-3 h-3 mr-1" />
                    Brasil
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Diretores
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {projeto.diretor_alianca && (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {getInitials(getMemberName(projeto.diretor_alianca))}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-muted-foreground">Aliança</p>
                            <p className="text-xs font-medium truncate max-w-24">
                              {getMemberName(projeto.diretor_alianca).split(" ")[0]}
                            </p>
                          </div>
                        </div>
                      )}
                      {projeto.diretor_execucao && (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                              {getInitials(getMemberName(projeto.diretor_execucao))}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-muted-foreground">Execução</p>
                            <p className="text-xs font-medium truncate max-w-24">
                              {getMemberName(projeto.diretor_execucao).split(" ")[0]}
                            </p>
                          </div>
                        </div>
                      )}
                      {projeto.diretor_comercial && (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-accent text-accent-foreground">
                              {getInitials(getMemberName(projeto.diretor_comercial))}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-muted-foreground">Comercial</p>
                            <p className="text-xs font-medium truncate max-w-24">
                              {getMemberName(projeto.diretor_comercial).split(" ")[0]}
                            </p>
                          </div>
                        </div>
                      )}
                      {projeto.diretor_capital && (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                              {getInitials(getMemberName(projeto.diretor_capital))}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs text-muted-foreground">Capital</p>
                            <p className="text-xs font-medium truncate max-w-24">
                              {getMemberName(projeto.diretor_capital).split(" ")[0]}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {projeto.observacoes && (
                    <p className="text-xs text-muted-foreground italic border-t pt-2">
                      {projeto.observacoes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
