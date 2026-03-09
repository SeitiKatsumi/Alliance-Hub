import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AIAnalyzer } from "@/components/ai-analyzer";
import { FuturisticOverview } from "@/components/futuristic-overview";
import { AIInsightsBlock } from "@/components/ai-insights-block";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Search,
  Plus,
  DollarSign,
  Briefcase,
  Users,
  Building2,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  MapPin,
  Sparkles
} from "lucide-react";

interface TipoOportunidade {
  id: string;
  nome_oportunidade: string;
  tipo: string;
  bia?: string;
  valor_origem_opa?: number;
  objetivo_alianca?: string;
  nucleo_alianca?: string;
  pais?: string;
  descricao?: string;
  perfil_aliado?: string;
}

interface BiasProjeto {
  id: string;
  nome_bia: string;
}

interface Membro {
  id: string;
  nome: string;
  tipo_cadastro?: string;
}

export default function OportunidadesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNucleo, setFilterNucleo] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOportunidade, setNewOportunidade] = useState({
    nome_oportunidade: "",
    tipo: "OPA-TEC",
    bia: "",
    valor_origem_opa: "",
    objetivo_alianca: "",
    nucleo_alianca: "",
    descricao: "",
    pais: "Brasil"
  });
  const { toast } = useToast();

  const { data: oportunidades = [], isLoading } = useQuery<TipoOportunidade[]>({
    queryKey: ["/api/oportunidades"],
  });

  const { data: bias = [] } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/bias"],
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newOportunidade) => {
      return apiRequest("POST", "/api/oportunidades", {
        ...data,
        valor_origem_opa: data.valor_origem_opa ? parseFloat(data.valor_origem_opa) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oportunidades"] });
      setIsCreateOpen(false);
      setNewOportunidade({
        nome_oportunidade: "",
        tipo: "OPA-TEC",
        bia: "",
        valor_origem_opa: "",
        objetivo_alianca: "",
        nucleo_alianca: "",
        descricao: "",
        pais: "Brasil"
      });
      toast({
        title: "Oportunidade criada",
        description: "Sua oportunidade foi enviada para aprovação de um Aliado."
      });
    }
  });

  const getTipoInfo = (tipo: string) => {
    const tipos: Record<string, { label: string; color: string; icon: any; bg: string }> = {
      "OPA-TEC": { label: "Técnico", color: "text-blue-600", icon: Building2, bg: "bg-blue-600 text-white" },
      "OPA-OBR": { label: "Obras", color: "text-green-600", icon: Briefcase, bg: "bg-green-600 text-white" },
      "OPA-LID": { label: "Comercial", color: "text-purple-600", icon: Users, bg: "bg-purple-600 text-white" },
      "OPA-CAP": { label: "Capital", color: "text-orange-600", icon: Wallet, bg: "bg-orange-600 text-white" },
    };
    return tipos[tipo] || tipos["OPA-TEC"];
  };

  const getNucleoFromString = (nucleo?: string) => {
    if (!nucleo) return "Não definido";
    if (nucleo.includes("Tecnico") || nucleo.includes("Técnico")) return "tecnico";
    if (nucleo.includes("Obras")) return "obras";
    if (nucleo.includes("Comercial")) return "comercial";
    if (nucleo.includes("Capital")) return "capital";
    return "outros";
  };

  const getBiaName = (biaId?: string) => {
    if (!biaId) return "Sem BIA vinculada";
    const bia = bias.find(b => b.id === biaId);
    return bia?.nome_bia || "BIA não encontrada";
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "A definir";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredOportunidades = oportunidades.filter(opa => {
    const matchesSearch = opa.nome_oportunidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opa.objetivo_alianca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opa.nucleo_alianca?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNucleo = filterNucleo === "todos" || getNucleoFromString(opa.nucleo_alianca) === filterNucleo;
    const matchesTipo = filterTipo === "todos" || opa.tipo === filterTipo;
    
    return matchesSearch && matchesNucleo && matchesTipo;
  });

  const nucleoCounts = {
    tecnico: oportunidades.filter(o => getNucleoFromString(o.nucleo_alianca) === "tecnico").length,
    obras: oportunidades.filter(o => getNucleoFromString(o.nucleo_alianca) === "obras").length,
    comercial: oportunidades.filter(o => getNucleoFromString(o.nucleo_alianca) === "comercial").length,
    capital: oportunidades.filter(o => getNucleoFromString(o.nucleo_alianca) === "capital").length,
  };

  const totalValor = oportunidades.reduce((acc, o) => acc + (parseFloat(String(o.valor_origem_opa)) || 0), 0);

  const nucleoOptions = [
    { value: "Nucleo Tecnico - Celula de Projeto", label: "Técnico - Projeto" },
    { value: "Nucleo Tecnico - Celula Juridica", label: "Técnico - Jurídica" },
    { value: "Nucleo Tecnico - Celula de Governanca", label: "Técnico - Governança" },
    { value: "Nucleo de Obras - Celula de Execucao", label: "Obras - Execução" },
    { value: "Nucleo de Obras - Celula de Fornecimento", label: "Obras - Fornecimento" },
    { value: "Nucleo de Obras - Celula de Empresas Executoras", label: "Obras - Empresas Executoras" },
    { value: "Nucleo Comercial - Celula de Vendas", label: "Comercial - Vendas" },
    { value: "Nucleo Comercial - Celula de Marketing", label: "Comercial - Marketing" },
    { value: "Nucleo de Capital - Celula de Captacao", label: "Capital - Captação" },
    { value: "Nucleo de Capital - Celula Contabil", label: "Capital - Contábil" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-brand-gold" />
            Oportunidades de Aliança
          </h1>
          <p className="text-muted-foreground">
            Encontre oportunidades para participar das alianças e contribuir com seus talentos
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-nova-oportunidade" className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-gold" />
                Criar Nova Oportunidade
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Oportunidade *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Projeto de Arquitetura"
                  value={newOportunidade.nome_oportunidade}
                  onChange={(e) => setNewOportunidade({...newOportunidade, nome_oportunidade: e.target.value})}
                  data-testid="input-nome-oportunidade"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de OPA *</Label>
                  <Select
                    value={newOportunidade.tipo}
                    onValueChange={(v) => setNewOportunidade({...newOportunidade, tipo: v})}
                  >
                    <SelectTrigger data-testid="select-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPA-TEC">OPA-TEC (Técnico)</SelectItem>
                      <SelectItem value="OPA-OBR">OPA-OBR (Obras)</SelectItem>
                      <SelectItem value="OPA-LID">OPA-LID (Comercial)</SelectItem>
                      <SelectItem value="OPA-CAP">OPA-CAP (Capital)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor">Valor Estimado</Label>
                  <Input
                    id="valor"
                    type="number"
                    placeholder="R$ 0,00"
                    value={newOportunidade.valor_origem_opa}
                    onChange={(e) => setNewOportunidade({...newOportunidade, valor_origem_opa: e.target.value})}
                    data-testid="input-valor"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bia">Vincular à BIA *</Label>
                <Select
                  value={newOportunidade.bia}
                  onValueChange={(v) => setNewOportunidade({...newOportunidade, bia: v})}
                >
                  <SelectTrigger data-testid="select-bia">
                    <SelectValue placeholder="Selecione uma BIA existente ou crie uma nova" />
                  </SelectTrigger>
                  <SelectContent>
                    {bias.map((bia) => (
                      <SelectItem key={bia.id} value={bia.id}>{bia.nome_bia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Toda oportunidade deve estar vinculada a uma BIA (Aliança)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nucleo">Núcleo/Célula *</Label>
                <Select
                  value={newOportunidade.nucleo_alianca}
                  onValueChange={(v) => setNewOportunidade({...newOportunidade, nucleo_alianca: v})}
                >
                  <SelectTrigger data-testid="select-nucleo">
                    <SelectValue placeholder="Selecione o núcleo" />
                  </SelectTrigger>
                  <SelectContent>
                    {nucleoOptions.map((nucleo) => (
                      <SelectItem key={nucleo.value} value={nucleo.value}>{nucleo.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo da Aliança</Label>
                <Textarea
                  id="objetivo"
                  placeholder="Descreva o objetivo desta oportunidade..."
                  value={newOportunidade.objetivo_alianca}
                  onChange={(e) => setNewOportunidade({...newOportunidade, objetivo_alianca: e.target.value})}
                  className="resize-none"
                  data-testid="textarea-objetivo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição Detalhada</Label>
                <Textarea
                  id="descricao"
                  placeholder="Detalhes adicionais..."
                  value={newOportunidade.descricao}
                  onChange={(e) => setNewOportunidade({...newOportunidade, descricao: e.target.value})}
                  className="resize-none"
                  data-testid="textarea-descricao"
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Após criar, sua oportunidade será enviada para aprovação de um <strong>Aliado</strong>.
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createMutation.mutate(newOportunidade)}
                disabled={!newOportunidade.nome_oportunidade || !newOportunidade.bia || !newOportunidade.nucleo_alianca || createMutation.isPending}
                data-testid="button-criar-oportunidade"
              >
                {createMutation.isPending ? "Criando..." : "Criar e Enviar para Aprovação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <FuturisticOverview
        data={{
          total: oportunidades.length,
          totalValor: totalValor,
          nucleos: nucleoCounts,
          bias: bias.length,
        }}
        type="oportunidades"
      />

      <AIInsightsBlock 
        type="oportunidades" 
        data={oportunidades} 
        biasData={bias}
        membrosCount={0}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-2 border-brand-gold/30" data-testid="stat-total">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-brand-gold">{oportunidades.length}</p>
            <p className="text-sm text-muted-foreground">Total de Oportunidades</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="stat-tecnico">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <p className="text-2xl font-bold">{nucleoCounts.tecnico}</p>
            </div>
            <p className="text-sm text-muted-foreground">Técnico</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="stat-obras">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Briefcase className="w-5 h-5 text-green-600" />
              <p className="text-2xl font-bold">{nucleoCounts.obras}</p>
            </div>
            <p className="text-sm text-muted-foreground">Obras</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="stat-comercial">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <p className="text-2xl font-bold">{nucleoCounts.comercial}</p>
            </div>
            <p className="text-sm text-muted-foreground">Comercial</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="stat-capital">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Wallet className="w-5 h-5 text-orange-600" />
              <p className="text-2xl font-bold">{nucleoCounts.capital}</p>
            </div>
            <p className="text-sm text-muted-foreground">Capital</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-brand-navy/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar oportunidades por nome, objetivo ou núcleo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-busca-oportunidades"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterNucleo} onValueChange={setFilterNucleo}>
                <SelectTrigger className="w-40" data-testid="filter-nucleo">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Núcleo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Núcleos</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="obras">Obras</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="capital">Capital</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-40" data-testid="filter-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="OPA-TEC">OPA-TEC</SelectItem>
                  <SelectItem value="OPA-OBR">OPA-OBR</SelectItem>
                  <SelectItem value="OPA-LID">OPA-LID</SelectItem>
                  <SelectItem value="OPA-CAP">OPA-CAP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredOportunidades.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma oportunidade encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterNucleo !== "todos" || filterTipo !== "todos" 
                ? "Tente ajustar os filtros de busca"
                : "Seja o primeiro a criar uma oportunidade de aliança"}
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-criar-primeira">
              <Plus className="w-4 h-4 mr-2" />
              Criar Oportunidade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOportunidades.map((opa) => {
            const tipoInfo = getTipoInfo(opa.tipo);
            const TipoIcon = tipoInfo.icon;
            
            return (
              <Card 
                key={opa.id} 
                className="hover-elevate cursor-pointer overflow-hidden group"
                data-testid={`card-oportunidade-${opa.id}`}
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-brand-navy to-brand-gold" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-2 group-hover:text-brand-gold transition-colors">
                        {opa.nome_oportunidade}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {getBiaName(opa.bia)}
                      </p>
                    </div>
                    <Badge className={tipoInfo.bg}>
                      <TipoIcon className="w-3 h-3 mr-1" />
                      {tipoInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {opa.objetivo_alianca && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {opa.objetivo_alianca}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 font-medium">
                      <DollarSign className="w-4 h-4 text-brand-gold" />
                      <span>{formatCurrency(opa.valor_origem_opa)}</span>
                    </div>
                    {opa.pais && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{opa.pais}</span>
                      </div>
                    )}
                  </div>

                  {opa.nucleo_alianca && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      {opa.nucleo_alianca}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button size="sm" variant="default" className="flex-1" data-testid={`button-participar-${opa.id}`}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Quero Participar
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-detalhes-${opa.id}`}>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                    <AIAnalyzer 
                      type="oportunidade" 
                      id={opa.id} 
                      title={opa.nome_oportunidade}
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
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-white/10">
                <Sparkles className="w-6 h-6 text-brand-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Volume Total de Oportunidades</h3>
                <p className="text-white/70 text-sm">Valor acumulado de todas as oportunidades disponíveis</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-brand-gold">{formatCurrency(totalValor)}</p>
              <p className="text-white/70 text-sm">{oportunidades.length} oportunidades abertas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
