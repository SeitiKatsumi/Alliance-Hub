import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  User,
  FileText,
  Tag,
  RefreshCw,
  BarChart3,
  Users
} from "lucide-react";

interface BiasProjeto {
  id: string;
  nome_bia: string;
  objetivo_alianca?: string;
}

interface Membro {
  id: string;
  nome?: string;
  nome_completo?: string;
  primeiro_nome?: string;
  sobrenome?: string;
}

interface FluxoCaixaItem {
  id: string;
  bia: string;
  tipo: "entrada" | "saida";
  valor: number | string;
  data: string;
  descricao: string;
  membro_responsavel: string | null;
  categoria: string;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function getMembroNome(membro: Membro): string {
  if (membro.nome) return membro.nome;
  if (membro.nome_completo) return membro.nome_completo;
  return [membro.primeiro_nome, membro.sobrenome].filter(Boolean).join(" ") || "Sem nome";
}

export default function FluxoCaixaPage() {
  const { toast } = useToast();
  const [selectedBiaId, setSelectedBiaId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formTipo, setFormTipo] = useState<"entrada" | "saida">("entrada");
  const [formValor, setFormValor] = useState<string>("");
  const [formData, setFormData] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formDescricao, setFormDescricao] = useState<string>("");
  const [formCategoria, setFormCategoria] = useState<string>("");
  const [formMembro, setFormMembro] = useState<string>("");

  const { data: bias = [], isLoading: loadingBias } = useQuery<BiasProjeto[]>({
    queryKey: ["/api/directus/bias_projetos"],
  });

  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const { data: allFluxo = [], isLoading: loadingFluxo } = useQuery<FluxoCaixaItem[]>({
    queryKey: ["/api/directus/fluxo_caixa"],
  });

  const fluxoItems = useMemo(() => {
    if (!selectedBiaId) return [];
    return allFluxo
      .filter((item) => {
        const biaId = typeof item.bia === "object" && item.bia !== null ? (item.bia as any).id : item.bia;
        return biaId === selectedBiaId;
      })
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [allFluxo, selectedBiaId]);

  const totals = useMemo(() => {
    const entradas = fluxoItems
      .filter((i) => i.tipo === "entrada")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    const saidas = fluxoItems
      .filter((i) => i.tipo === "saida")
      .reduce((sum, i) => sum + (parseFloat(String(i.valor)) || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [fluxoItems]);

  const aportesPorMembro = useMemo(() => {
    const entradas = fluxoItems.filter((i) => i.tipo === "entrada" && i.membro_responsavel);
    const map: Record<string, number> = {};
    entradas.forEach((i) => {
      const mid = typeof i.membro_responsavel === "object" && i.membro_responsavel !== null
        ? (i.membro_responsavel as any).id
        : i.membro_responsavel;
      if (mid) {
        map[mid] = (map[mid] || 0) + (parseFloat(String(i.valor)) || 0);
      }
    });
    const totalAportesComMembro = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([membroId, valor]) => ({
        membroId,
        valor,
        percentual: totalAportesComMembro > 0 ? (valor / totalAportesComMembro) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [fluxoItems]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        bia: selectedBiaId,
        tipo: formTipo,
        valor: parseFloat(formValor) || 0,
        data: formData,
        descricao: formDescricao,
        categoria: formCategoria,
        membro_responsavel: formMembro || null,
      };
      await apiRequest("POST", "/api/directus/fluxo_caixa", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/directus/fluxo_caixa"] });
      toast({ title: "Lançamento criado com sucesso" });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar lançamento", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/directus/fluxo_caixa/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/directus/fluxo_caixa"] });
      toast({ title: "Lançamento excluído" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormTipo("entrada");
    setFormValor("");
    setFormData(new Date().toISOString().split("T")[0]);
    setFormDescricao("");
    setFormCategoria("");
    setFormMembro("");
  }

  function handleSubmit() {
    if (!formValor || parseFloat(formValor) <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (!formDescricao.trim()) {
      toast({ title: "Informe uma descrição", variant: "destructive" });
      return;
    }
    if (formTipo === "entrada" && !formMembro) {
      toast({ title: "Entradas precisam de um membro responsável", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  }

  const membroMap = useMemo(() => {
    const map: Record<string, string> = {};
    membros.forEach((m) => { map[m.id] = getMembroNome(m); });
    return map;
  }, [membros]);

  function getMembroId(membro: string | object | null): string | null {
    if (!membro) return null;
    if (typeof membro === "object") return (membro as any).id || null;
    return membro;
  }

  const selectedBia = bias.find((b) => b.id === selectedBiaId);

  if (loadingBias) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const categoriasEntrada = ["Aporte Inicial", "Aporte Adicional", "Investimento", "Financiamento", "Outro"];
  const categoriasSaida = ["Material", "Mão de Obra", "Equipamento", "Serviço Terceirizado", "Administrativo", "Impostos", "Outro"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
              <Wallet className="w-6 h-6" />
            </div>
            Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground mt-1">Gestão de entradas e saídas por BIA</p>
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

          {selectedBiaId && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-novo-lancamento" onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-brand-gold" />
                    Novo Lançamento
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={formTipo} onValueChange={(v) => setFormTipo(v as "entrada" | "saida")}>
                      <SelectTrigger data-testid="select-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">
                          <span className="flex items-center gap-2">
                            <ArrowUpCircle className="w-4 h-4 text-green-500" />
                            Entrada (Aporte)
                          </span>
                        </SelectItem>
                        <SelectItem value="saida">
                          <span className="flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-red-500" />
                            Saída (Custo)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formValor}
                      onChange={(e) => setFormValor(e.target.value)}
                      placeholder="0,00"
                      data-testid="input-valor"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={formData}
                      onChange={(e) => setFormData(e.target.value)}
                      data-testid="input-data"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={formDescricao}
                      onChange={(e) => setFormDescricao(e.target.value)}
                      placeholder="Descrição do lançamento"
                      data-testid="input-descricao"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formCategoria} onValueChange={setFormCategoria}>
                      <SelectTrigger data-testid="select-categoria">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(formTipo === "entrada" ? categoriasEntrada : categoriasSaida).map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Membro Responsável
                      {formTipo === "entrada" && <span className="text-red-500 text-xs">*obrigatório</span>}
                    </Label>
                    <Select value={formMembro} onValueChange={setFormMembro}>
                      <SelectTrigger data-testid="select-membro">
                        <SelectValue placeholder="Selecione um membro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {membros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{getMembroNome(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" data-testid="button-cancelar">Cancelar</Button>
                  </DialogClose>
                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending}
                    data-testid="button-salvar-lancamento"
                  >
                    {createMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!selectedBiaId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">Selecione uma BIA para iniciar</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Escolha um projeto de aliança no seletor acima para gerenciar o fluxo de caixa</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-500/30" data-testid="panel-total-aportes">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Total de Aportes</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-entradas">{formatBRL(totals.entradas)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fluxoItems.filter((i) => i.tipo === "entrada").length} entrada(s)
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-500/30" data-testid="panel-custo-obra">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Custo da Obra</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600" data-testid="text-total-saidas">{formatBRL(totals.saidas)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fluxoItems.filter((i) => i.tipo === "saida").length} saída(s)
                </p>
              </CardContent>
            </Card>

            <Card className={totals.saldo >= 0 ? "border-brand-gold/30" : "border-red-500/30"} data-testid="panel-saldo">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                <BarChart3 className={`w-4 h-4 ${totals.saldo >= 0 ? "text-brand-gold" : "text-red-500"}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${totals.saldo >= 0 ? "text-brand-gold" : "text-red-600"}`} data-testid="text-saldo">
                  {formatBRL(totals.saldo)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Entradas − Saídas</p>
              </CardContent>
            </Card>
          </div>

          {aportesPorMembro.length > 0 && (
            <Card data-testid="panel-participacao-aportes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-brand-gold" />
                  Mapa de Alocação Patrimonial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aportesPorMembro.map((item, idx) => (
                    <div key={item.membroId} className="space-y-1" data-testid={`aporte-membro-${item.membroId}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {membroMap[item.membroId] || "Membro desconhecido"}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatBRL(item.valor)}</span>
                          <Badge variant="outline" className="border-brand-gold/50 text-brand-gold bg-brand-gold/10 min-w-[60px] justify-center" data-testid={`text-perc-membro-${item.membroId}`}>
                            {item.percentual.toFixed(1)}%
                          </Badge>
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold/70 transition-all duration-500"
                          style={{ width: `${item.percentual}%` }}
                          data-testid={`bar-membro-${item.membroId}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="panel-lancamentos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-brand-gold" />
                Lançamentos — {selectedBia?.nome_bia}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFluxo ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : fluxoItems.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-muted-foreground">Nenhum lançamento registrado</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Clique em "Novo Lançamento" para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-lancamentos">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Descrição</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Responsável</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Valor</th>
                        <th className="py-3 px-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fluxoItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-lancamento-${item.id}`}>
                          <td className="py-3 px-2">
                            {item.tipo === "entrada" ? (
                              <Badge variant="outline" className="border-green-500/50 text-green-600 bg-green-500/10 gap-1">
                                <ArrowUpCircle className="w-3 h-3" />
                                Entrada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-500/50 text-red-600 bg-red-500/10 gap-1">
                                <ArrowDownCircle className="w-3 h-3" />
                                Saída
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(item.data)}
                            </span>
                          </td>
                          <td className="py-3 px-2">{item.descricao || "-"}</td>
                          <td className="py-3 px-2">
                            {item.categoria ? (
                              <Badge variant="secondary" className="gap-1">
                                <Tag className="w-3 h-3" />
                                {item.categoria}
                              </Badge>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            {item.membro_responsavel ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <User className="w-3 h-3" />
                                {membroMap[getMembroId(item.membro_responsavel) || ""] || "—"}
                              </span>
                            ) : "-"}
                          </td>
                          <td className={`py-3 px-2 text-right font-semibold ${item.tipo === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {item.tipo === "entrada" ? "+" : "-"}{formatBRL(parseFloat(String(item.valor)) || 0)}
                          </td>
                          <td className="py-3 px-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-500"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
