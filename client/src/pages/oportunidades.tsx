import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FuturisticChart } from "@/components/futuristic-chart";
import { 
  Target, 
  UserPlus, 
  Star,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowRight,
  Zap
} from "lucide-react";

interface Oportunidade {
  id: string;
  titulo: string;
  etapa: string;
  probabilidade: number;
  prioridade: string;
  valor_estimado?: number;
  data_prevista_fechamento?: string;
  proxima_acao?: string;
  ativo: boolean;
}

interface TipoOportunidade {
  id: string;
  nome_oportunidade: string;
  tipo: string;
  valor_origem_opa?: number;
  objetivo_alianca?: string;
  pais?: string;
}

export default function OportunidadesPage() {
  const { data: funilOportunidades = [], isLoading: isLoadingFunil } = useQuery<Oportunidade[]>({
    queryKey: ["/api/directus/funil_de_conversao"],
  });

  const { data: tiposOportunidades = [], isLoading: isLoadingTipos } = useQuery<TipoOportunidade[]>({
    queryKey: ["/api/directus/tipos_oportunidades"],
  });

  const isLoading = isLoadingFunil || isLoadingTipos;

  const getEtapaColor = (etapa: string) => {
    const colors: Record<string, string> = {
      contato_inicial: "#B8B4B4",
      qualificado: "#6A7984",
      proposta: "#D7BB7D",
      negociacao: "#001D34",
      fechado: "#22c55e",
    };
    return colors[etapa] || "#6A7984";
  };

  const getEtapaLabel = (etapa: string) => {
    const labels: Record<string, string> = {
      contato_inicial: "Contato Inicial",
      qualificado: "Qualificado",
      proposta: "Proposta",
      negociacao: "Negociação",
      fechado: "Fechado",
    };
    return labels[etapa] || etapa;
  };

  const getPrioridadeBadge = (prioridade: string) => {
    if (prioridade === "alta") return <Badge className="bg-red-500/10 text-red-600 border-red-200">Alta</Badge>;
    if (prioridade === "media") return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Média</Badge>;
    return <Badge variant="outline">Baixa</Badge>;
  };

  const getTipoBadge = (tipo: string) => {
    const colors: Record<string, string> = {
      "OPA-TEC": "bg-blue-500/10 text-blue-600 border-blue-200",
      "OPA-OBR": "bg-green-500/10 text-green-600 border-green-200",
      "OPA-LID": "bg-purple-500/10 text-purple-600 border-purple-200",
      "OPA-CAP": "bg-orange-500/10 text-orange-600 border-orange-200",
    };
    return <Badge className={colors[tipo] || ""}>{tipo}</Badge>;
  };

  const funilStats = [
    { label: "Contato", value: funilOportunidades.filter(o => o.etapa === "contato_inicial").length || 1, color: "#B8B4B4" },
    { label: "Qualificado", value: funilOportunidades.filter(o => o.etapa === "qualificado").length || 2, color: "#6A7984" },
    { label: "Proposta", value: funilOportunidades.filter(o => o.etapa === "proposta").length || 1, color: "#D7BB7D" },
    { label: "Negociação", value: funilOportunidades.filter(o => o.etapa === "negociacao").length || 1, color: "#001D34" },
  ];

  const valueData = [
    { label: "Jan", value: 500 },
    { label: "Fev", value: 850 },
    { label: "Mar", value: 1200 },
    { label: "Abr", value: 1800 },
    { label: "Mai", value: 2500 },
    { label: "Jun", value: 3200 },
  ];

  const tipoStats = [
    { label: "OPA-TEC", value: tiposOportunidades.filter(t => t.tipo === "OPA-TEC").length || 1, color: "#001D34" },
    { label: "OPA-OBR", value: tiposOportunidades.filter(t => t.tipo === "OPA-OBR").length || 1, color: "#D7BB7D" },
    { label: "OPA-LID", value: tiposOportunidades.filter(t => t.tipo === "OPA-LID").length || 1, color: "#6A7984" },
    { label: "OPA-CAP", value: tiposOportunidades.filter(t => t.tipo === "OPA-CAP").length || 1, color: "#B8B4B4" },
  ];

  const formatCurrency = (value?: number) => {
    if (!value) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-secondary" />
            Oportunidades de Aliança
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o funil de conversão e tipos de oportunidades
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            {funilOportunidades.length} no Funil
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            {tiposOportunidades.length} Tipos OPA
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card data-testid="chart-funil">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-secondary" />
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={funilStats} type="bar" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-valor">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary" />
              Valor Acumulado (K)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={valueData} type="line" height={160} />
          </CardContent>
        </Card>

        <Card data-testid="chart-tipos">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-4 h-4 text-secondary" />
              Tipos de OPA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuturisticChart data={tipoStats} type="radial" height={160} />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold text-foreground">Oportunidades de Participação</h2>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funilOportunidades.map((opa) => (
            <Card 
              key={opa.id} 
              className="hover-elevate cursor-pointer overflow-hidden"
              data-testid={`card-funil-${opa.id}`}
            >
              <div 
                className="h-1 w-full"
                style={{ backgroundColor: getEtapaColor(opa.etapa) }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">{opa.titulo}</CardTitle>
                  {getPrioridadeBadge(opa.prioridade)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge 
                    variant="outline" 
                    style={{ borderColor: getEtapaColor(opa.etapa), color: getEtapaColor(opa.etapa) }}
                  >
                    {getEtapaLabel(opa.etapa)}
                  </Badge>
                  <span className="text-sm font-medium">
                    {opa.probabilidade}% prob.
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatCurrency(opa.valor_estimado)}</span>
                  </div>
                  {opa.data_prevista_fechamento && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(opa.data_prevista_fechamento).toLocaleDateString("pt-BR")}</span>
                    </div>
                  )}
                </div>

                {opa.proxima_acao && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="w-3 h-3" />
                    <span className="truncate">{opa.proxima_acao}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <Button size="sm" variant="default" data-testid={`button-participar-opa-${opa.id}`}>
                    <Target className="w-3 h-3 mr-1" />
                    Participar
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-convidar-opa-${opa.id}`}>
                    <UserPlus className="w-3 h-3 mr-1" />
                    Convidar
                  </Button>
                  <Button size="sm" variant="secondary" data-testid={`button-avaliar-opa-${opa.id}`}>
                    <Star className="w-3 h-3 mr-1" />
                    Avaliar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <h2 className="text-lg font-semibold text-foreground">Tipos de Oportunidades (OPA)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiposOportunidades.map((tipo) => (
          <Card 
            key={tipo.id} 
            className="hover-elevate cursor-pointer"
            data-testid={`card-tipo-${tipo.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{tipo.nome_oportunidade}</CardTitle>
                {getTipoBadge(tipo.tipo)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tipo.objetivo_alianca && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tipo.objetivo_alianca}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  <span>{formatCurrency(tipo.valor_origem_opa)}</span>
                </div>
                {tipo.pais && (
                  <Badge variant="outline">{tipo.pais}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
