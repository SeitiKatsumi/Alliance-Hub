import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Clock,
  ArrowRight
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
  diretor_alianca?: string;
  diretor_obra?: string;
  diretor_comercial?: string;
  diretor_capital?: string;
  autor_bia?: string;
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

export default function BiasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBia, setSelectedBia] = useState<BiasProjeto | null>(null);

  const { data: bias = [], isLoading } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const { data: oportunidades = [] } = useQuery<TipoOportunidade[]>({
    queryKey: ["/api/directus/tipos_oportunidades"],
  });

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

  const nucleoConfig = {
    tecnico: { icon: Building2, color: "text-blue-600", bg: "bg-blue-500/10", label: "Núcleo Técnico" },
    obras: { icon: Hammer, color: "text-green-600", bg: "bg-green-500/10", label: "Núcleo de Obras" },
    comercial: { icon: Users, color: "text-purple-600", bg: "bg-purple-500/10", label: "Núcleo Comercial" },
    capital: { icon: Wallet, color: "text-orange-600", bg: "bg-orange-500/10", label: "Núcleo de Capital" },
  };

  const diretoriaConfig = [
    { key: "autor_bia", label: "Autor da BIA", icon: Crown, color: "bg-brand-gold text-brand-navy" },
    { key: "diretor_alianca", label: "Diretor de Aliança", icon: Shield, color: "bg-brand-navy text-white" },
    { key: "diretor_obra", label: "Diretor de Obra", icon: Hammer, color: "bg-green-600 text-white" },
    { key: "diretor_comercial", label: "Diretor Comercial", icon: TrendingUp, color: "bg-purple-600 text-white" },
    { key: "diretor_capital", label: "Diretor de Capital", icon: DollarSign, color: "bg-orange-600 text-white" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-gold" />
            BIAS - Alianças para Execução de Obras
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe as alianças estratégicas e seus participantes
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-base">
          {bias.length} Alianças Ativas
        </Badge>
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

      <Card className="border-brand-navy/20">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar alianças por nome ou objetivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-busca-bias"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBias.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma aliança encontrada</h3>
            <p className="text-muted-foreground">
              Tente ajustar os termos de busca
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredBias.map((projeto, biaIndex) => {
            const biaOportunidades = getOportunidadesForBia(projeto.id);
            const etapas = getEtapasForBia(biaIndex);
            const progressoGeral = Math.round(etapas.reduce((acc, e) => acc + e.percentual, 0) / etapas.length);

            return (
              <Card 
                key={projeto.id} 
                className="overflow-hidden border-2 hover:border-brand-gold/50 transition-colors"
                data-testid={`card-bia-${projeto.id}`}
              >
                <div className="h-2 w-full bg-gradient-to-r from-brand-navy via-brand-gold to-brand-navy" />
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-brand-gold" />
                        {projeto.nome_bia}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {projeto.objetivo_alianca || "Aliança estratégica para execução de obras"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        <MapPin className="w-3 h-3 mr-1" />
                        Brasil
                      </Badge>
                      <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/30">
                        {progressoGeral}% Concluído
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <Crown className="w-4 h-4 text-brand-gold" />
                      Diretoria da Aliança
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {diretoriaConfig.map((dir) => {
                        const memberId = projeto[dir.key as keyof BiasProjeto] as string | undefined;
                        const memberName = getMemberName(memberId);
                        const aura = getAuraScore(memberId);
                        const DirIcon = dir.icon;
                        
                        return (
                          <div key={dir.key} className="text-center">
                            <div className="relative inline-block mb-2">
                              <Avatar className="w-12 h-12 border-2 border-background shadow-lg">
                                <AvatarFallback className={dir.color}>
                                  {memberId ? getInitials(memberName) : <DirIcon className="w-5 h-5" />}
                                </AvatarFallback>
                              </Avatar>
                              {memberId && (
                                <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-brand-gold text-brand-navy rounded-full w-5 h-5 flex items-center justify-center shadow">
                                  {aura}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium truncate">{memberId ? memberName.split(" ")[0] : "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{dir.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

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
                          className={`p-3 rounded-lg border ${config.bg} hover-elevate cursor-pointer`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <NucleoIcon className={`w-4 h-4 ${config.color}`} />
                            <span className="text-sm font-medium">{config.label}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">{nucleoOportunidades.length}</span>
                            <span className="text-xs text-muted-foreground">oportunidades</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Andamento da Obra
                      </h4>
                      <span className="text-sm font-medium">{progressoGeral}%</span>
                    </div>
                    <div className="flex gap-1">
                      {etapas.map((etapa, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                          <div 
                            className={`w-full h-3 rounded transition-all ${
                              etapa.status === "concluida" ? "bg-brand-gold" :
                              etapa.status === "em_andamento" ? "bg-brand-gold/50" :
                              "bg-muted"
                            } group-hover:scale-y-125`}
                            title={`${etapa.nome}: ${etapa.percentual}%`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground pt-1">
                      {etapas.map((etapa, i) => (
                        <span key={i} className="flex-1 text-center truncate px-0.5">
                          {etapa.nome}
                        </span>
                      ))}
                    </div>
                  </div>

                  {biaOportunidades.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Oportunidades Abertas ({biaOportunidades.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {biaOportunidades.slice(0, 3).map((opa) => (
                          <div 
                            key={opa.id}
                            className="p-2 rounded border bg-background hover-elevate cursor-pointer flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
                            <span className="text-sm truncate flex-1">{opa.nome_oportunidade}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{opa.tipo}</Badge>
                          </div>
                        ))}
                        {biaOportunidades.length > 3 && (
                          <div className="p-2 rounded border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
                            +{biaOportunidades.length - 3} mais oportunidades
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button size="sm" variant="default" data-testid={`button-participar-bia-${projeto.id}`}>
                      <Briefcase className="w-3 h-3 mr-1" />
                      Participar desta Aliança
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-convidar-bia-${projeto.id}`}>
                      <UserPlus className="w-3 h-3 mr-1" />
                      Convidar Membro
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
                                <div key={opa.id} className="p-3 rounded border flex items-center justify-between">
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
            );
          })}
        </div>
      )}

      <Card className="bg-gradient-to-r from-brand-navy to-brand-navy/80 text-white border-0">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-brand-gold">{bias.length}</p>
              <p className="text-sm text-white/70">Alianças Ativas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-gold">{oportunidades.length}</p>
              <p className="text-sm text-white/70">Oportunidades</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-gold">{membros.length}</p>
              <p className="text-sm text-white/70">Membros</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-brand-gold">4</p>
              <p className="text-sm text-white/70">Núcleos de Aliança</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
