import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AuraScore, getFaixaColor } from "@/components/aura-score";
import {
  Sparkles, Search, X, CheckCircle2, Loader2, ChevronRight,
  TrendingUp, Users, Zap, Bot, Tags, Paperclip, FileText,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface AuraResult {
  score: number | null;
  T: number | null;
  R: number | null;
  C: number | null;
  n: number;
  faixa: string | null;
  palavras_recebidas: Array<{ palavra: string; canonico: string; dimensao: "T" | "R" | "C"; count: number }>;
}

interface MembroBusca {
  id: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  foto?: string | null;
}

interface MinhaAvaliacao {
  id: number;
  avaliador_membro_id: string;
  avaliado_membro_id: string;
  avaliado_nome?: string | null;
  avaliador_nome?: string | null;
  palavras: string[];
  created_at: string;
}

interface MinhasAvaliacoesResponse {
  recebidas: MinhaAvaliacao[];
  dadas: MinhaAvaliacao[];
}

interface AvaliacaoExistente {
  id: number;
  avaliador_membro_id: string;
  avaliado_membro_id: string;
  palavras: string[];
  created_at: string;
}

const DIM_MAP: Record<string, "T" | "R" | "C"> = {
  "Integridade": "C", "Responsabilidade": "T", "Excelência": "T", "Protagonismo": "C",
  "Aliança": "R", "Empatia": "R", "Inovação": "T", "Coragem": "C", "Persistência": "C",
  "Lealdade": "R", "Confiança": "R", "Colaboração": "R", "Visão": "T", "Comunicação": "R",
  "Liderança": "C", "Disciplina": "T", "Humildade": "C", "Justiça": "C", "Autenticidade": "C",
  "Comprometimento": "C", "Criatividade": "T", "Eficácia": "T", "Generosidade": "R",
  "Resiliência": "C", "Foco": "T", "Equilíbrio": "C", "Iniciativa": "C", "Adaptabilidade": "T",
  "Entusiasmo": "C", "Autonomia": "T", "Sabedoria": "C", "Transparência": "C", "Eficiência": "T",
  "Organização": "T", "Aprendizado": "T", "Cuidado": "T", "Paixão": "C", "Altruísmo": "R",
  "Gratidão": "C", "Pontualidade": "T", "Conexão": "R", "Valentia": "C", "Estabilidade": "T",
  "Companheirismo": "R", "Honra": "C", "Sensatez": "C", "Evolução": "C",
  "Entendimento": "R", "Inspiração": "C", "Valorização": "R",
};

interface EvolucaoPonto { label: string; score: number; n: number; }

function calcularEvolucao(avaliacoes: MinhaAvaliacao[]): EvolucaoPonto[] {
  const sorted = [...avaliacoes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const canonAvaliadores = new Map<string, { dim: "T" | "R" | "C"; avaliadores: Set<string> }>();
  const result: EvolucaoPonto[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const av = sorted[i];
    const seen = new Set<string>();
    for (const palavra of av.palavras) {
      const dim = DIM_MAP[palavra];
      if (!dim || seen.has(palavra)) continue;
      seen.add(palavra);
      if (!canonAvaliadores.has(palavra)) {
        canonAvaliadores.set(palavra, { dim, avaliadores: new Set() });
      }
      canonAvaliadores.get(palavra)!.avaliadores.add(av.avaliador_membro_id);
    }
    const n = i + 1;
    const pontoMax = n * 2;
    let T = 0, R = 0, C = 0;
    for (const [, { dim, avaliadores }] of canonAvaliadores) {
      const count = avaliadores.size;
      const peso = count >= 4 ? 2.0 : count >= 2 ? 1.5 : 1.0;
      if (dim === "T") T += peso;
      else if (dim === "R") R += peso;
      else C += peso;
    }
    const score = Math.round(Math.min(T / pontoMax, 1) * 40 + Math.min(R / pontoMax, 1) * 25 + Math.min(C / pontoMax, 1) * 35);
    const date = new Date(av.created_at);
    const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    result.push({ label, score, n });
  }
  return result;
}

function dimColor(d: "T" | "R" | "C"): string {
  if (d === "T") return "#3B82F6";
  if (d === "R") return "#22C55E";
  return "#D7BB7D";
}

function dimLabel(d: "T" | "R" | "C"): string {
  if (d === "T") return "Técnica";
  if (d === "R") return "Relacional";
  return "Comportamental";
}

function fotoUrl(foto: string | null | undefined): string | null {
  if (!foto) return null;
  if (foto.startsWith("http")) return foto;
  const base = (import.meta.env.VITE_DIRECTUS_URL as string) || "";
  return `${base}/assets/${foto}?width=80&height=80&fit=cover`;
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

export default function AuraPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembro, setSelectedMembro] = useState<MembroBusca | null>(null);
  const [selectedPalavras, setSelectedPalavras] = useState<string[]>([]);
  const [palavraInput, setPalavraInput] = useState("");
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [evalMode, setEvalMode] = useState<"palavras" | "texto">("palavras");
  const [textoIA, setTextoIA] = useState("");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = user?.membro_directus_id;

  const { data: myAura, isLoading: loadingMyAura } = useQuery<AuraResult>({
    queryKey: ["/api/aura/score", myId],
    enabled: !!myId,
  });

  const { data: lexico = [] } = useQuery<string[]>({
    queryKey: ["/api/aura/lexico"],
  });

  const { data: minhasAvaliacoesData } = useQuery<MinhasAvaliacoesResponse>({
    queryKey: ["/api/aura/minhas-avaliacoes"],
    enabled: !!myId,
  });
  const minhasAvaliacoesDadas: MinhaAvaliacao[] = minhasAvaliacoesData?.dadas ?? [];
  const minhasAvaliacoesRecebidas: MinhaAvaliacao[] = minhasAvaliacoesData?.recebidas ?? [];
  const evolucaoDados = useMemo(() => calcularEvolucao(minhasAvaliacoesRecebidas), [minhasAvaliacoesRecebidas]);

  const { data: allMembros = [], isLoading: loadingSearch } = useQuery<MembroBusca[]>({
    queryKey: ["/api/aura/membros/busca"],
    queryFn: async () => {
      const res = await fetch("/api/aura/membros/busca", { credentials: "include" });
      if (!res.ok) return [];
      const data: MembroBusca[] = await res.json();
      return data;
    },
    enabled: !!myId,
    staleTime: 5 * 60 * 1000,
  });

  const searchResults = allMembros
    .filter(m => m.id !== myId)
    .filter(m => {
      if (!searchQuery || searchQuery.length < 2) return true;
      const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nome = (m.nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const empresa = (m.empresa || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nome.includes(q) || empresa.includes(q);
    })
    .slice(0, 12);

  const { data: minhaAvaliacaoDoSelecionado } = useQuery<AvaliacaoExistente | null>({
    queryKey: ["/api/aura/avaliacao", selectedMembro?.id],
    enabled: !!selectedMembro?.id,
  });

  const avaliarMutation = useMutation({
    mutationFn: async ({ avaliadoId, palavras }: { avaliadoId: string; palavras: string[] }) => {
      return apiRequest("POST", "/api/aura/avaliar", { avaliado_membro_id: avaliadoId, palavras });
    },
    onSuccess: () => {
      toast({ title: "Avaliação enviada!", description: "Obrigado por contribuir com a Aura da comunidade." });
      queryClient.invalidateQueries({ queryKey: ["/api/aura/minhas-avaliacoes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aura/avaliacao", selectedMembro?.id] });
      setSelectedMembro(null);
      setSelectedPalavras([]);
      setSearchQuery("");
      setTextoIA("");
      setArquivoNome(null);
      setEvalMode("palavras");
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Não foi possível enviar a avaliação.", variant: "destructive" });
    },
  });

  const extrairArquivoMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/aura/extrair-arquivo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao processar arquivo." }));
        throw new Error(err.error || "Erro ao processar arquivo.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: (data) => {
      setTextoIA(prev => prev ? prev + "\n\n" + data.texto : data.texto);
      toast({ title: "Arquivo processado!", description: "O texto foi extraído e adicionado ao campo abaixo." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro no arquivo", description: err.message, variant: "destructive" });
    },
  });

  const analisarMutation = useMutation({
    mutationFn: async ({ texto, membro_nome }: { texto: string; membro_nome: string }) => {
      const res = await apiRequest("POST", "/api/aura/analisar-texto", { texto, membro_nome });
      return res.json() as Promise<{ palavras: string[] }>;
    },
    onSuccess: (data) => {
      if (data.palavras.length === 0) {
        toast({ title: "Nenhuma palavra identificada", description: "Tente descrever mais detalhadamente as características do membro.", variant: "destructive" });
        return;
      }
      setSelectedPalavras(data.palavras);
      setEvalMode("palavras");
      toast({ title: "IA identificou as palavras!", description: `Sugestão: ${data.palavras.join(", ")}. Você pode ajustar antes de enviar.` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro na análise", description: err.message || "Não foi possível analisar o texto.", variant: "destructive" });
    },
  });

  const sugestoesFiltradas = useMemo(() => {
    if (!palavraInput || palavraInput.length < 1) return [];
    const norm = palavraInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lexico.filter(p => {
      const pn = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return pn.includes(norm) && !selectedPalavras.includes(p);
    }).slice(0, 8);
  }, [palavraInput, lexico, selectedPalavras]);

  function togglePalavra(p: string) {
    setSelectedPalavras(prev => {
      if (prev.includes(p)) return prev.filter(x => x !== p);
      if (prev.length >= 3) {
        toast({ title: "Máximo de 3 palavras", description: "Remova uma para adicionar outra.", variant: "destructive" });
        return prev;
      }
      return [...prev, p];
    });
    setPalavraInput("");
    setShowSugestoes(false);
  }

  const score = myAura?.score ?? null;
  const T = myAura?.T ?? 0;
  const R = myAura?.R ?? 0;
  const C = myAura?.C ?? 0;
  const n = myAura?.n ?? 0;
  const palavrasRecebidas = myAura?.palavras_recebidas ?? [];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D7BB7D]" />
          Aura Percebida
        </h1>
        <p className="text-sm text-muted-foreground">
          Reputação construída pela percepção da comunidade sobre você.
        </p>
      </div>

      {/* My Score */}
      {myId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Score ring */}
          <Card className="border border-border/60 md:col-span-1" data-testid="card-meu-score">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              {loadingMyAura ? (
                <div className="space-y-3 flex flex-col items-center">
                  <Skeleton className="w-32 h-32 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <>
                  <AuraScore score={score} size="lg" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {score !== null
                        ? `Baseado em ${n} avaliação${n !== 1 ? "ões" : ""}`
                        : n > 0
                          ? `${n}/3 avaliações recebidas`
                          : "Nenhuma avaliação ainda"
                      }
                    </p>
                    {score === null && n < 3 && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Score visível após 3 avaliações
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Evolution chart */}
          <Card className="border border-border/60 md:col-span-2" data-testid="card-evolucao">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#D7BB7D]" />
                  Evolução da Aura
                </CardTitle>
                {evolucaoDados.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {evolucaoDados.length} avaliação{evolucaoDados.length !== 1 ? "ões" : ""}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingMyAura ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : evolucaoDados.length === 0 ? (
                <div className="h-32 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/50 text-center">
                    Nenhuma avaliação recebida ainda.<br />O gráfico aparece conforme você recebe avaliações.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {evolucaoDados.length < 3 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      Score ativo após 3 avaliações · {3 - evolucaoDados.length} restante{3 - evolucaoDados.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={evolucaoDados} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="auraGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D7BB7D" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#D7BB7D" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickCount={5}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0d2035",
                          border: "1px solid rgba(215,187,125,0.2)",
                          borderRadius: 8,
                          fontSize: 11,
                          color: "#e2e8f0",
                        }}
                        formatter={(val: number) => [`${val} pts`, "Score"]}
                        labelFormatter={(label: string, payload: any[]) => {
                          const n = payload?.[0]?.payload?.n;
                          return `${label}${n !== undefined ? ` · avaliação #${n}` : ""}`;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#D7BB7D"
                        strokeWidth={2}
                        fill="url(#auraGrad)"
                        dot={{ fill: "#D7BB7D", r: 3, strokeWidth: 0 }}
                        activeDot={{ fill: "#D7BB7D", r: 4, stroke: "rgba(215,187,125,0.3)", strokeWidth: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Keywords received */}
      {myId && palavrasRecebidas.length > 0 && (
        <div className="space-y-3" data-testid="section-palavras-recebidas">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#D7BB7D]" />
            Palavras que a comunidade usa para te descrever
          </h2>
          <div className="flex flex-wrap gap-2">
            {palavrasRecebidas.map(p => (
              <div
                key={p.canonico}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border"
                style={{
                  background: `${dimColor(p.dimensao)}12`,
                  borderColor: `${dimColor(p.dimensao)}40`,
                  color: dimColor(p.dimensao),
                }}
                data-testid={`badge-palavra-${p.canonico}`}
              >
                <span>{p.canonico}</span>
                {p.count > 1 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: `${dimColor(p.dimensao)}25` }}
                  >
                    ×{p.count}
                  </span>
                )}
                <span className="text-[9px] opacity-50 ml-0.5">{dimLabel(p.dimensao)[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Received evaluations list */}
      {myId && minhasAvaliacoesRecebidas.length > 0 && (
        <div className="space-y-3" data-testid="section-avaliacoes-recebidas">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-[#D7BB7D]" />
            Avaliações Recebidas ({minhasAvaliacoesRecebidas.length})
          </h2>
          <div className="space-y-2">
            {minhasAvaliacoesRecebidas.map((av, i) => (
              <div
                key={av.id}
                className="p-3 rounded-lg border border-border/60 space-y-2"
                style={{ background: "rgba(255,255,255,0.01)" }}
                data-testid={`item-recebida-${av.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: "rgba(215,187,125,0.12)", color: "#D7BB7D" }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-xs font-medium text-foreground truncate">
                      {av.avaliador_nome ?? "Membro da comunidade"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {new Date(av.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {av.palavras.map(p => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="text-[11px] h-5 px-2 font-medium"
                      style={{ borderColor: "rgba(215,187,125,0.35)", color: "#D7BB7D", background: "rgba(215,187,125,0.06)" }}
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluate a member */}
      {myId && (
        <Card className="border border-border/60" data-testid="card-avaliar">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D7BB7D]" />
              Avaliar um Membro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedMembro ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Buscar membro pelo nome..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    data-testid="input-buscar-membro"
                  />
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {loadingSearch ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      ))
                    ) : searchResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">{searchQuery.length >= 2 ? "Nenhum membro encontrado." : "Carregando membros..."}</p>
                    ) : (
                      searchResults.map(m => (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                          onClick={() => { setSelectedMembro(m); setSearchQuery(""); setSelectedPalavras([]); }}
                          data-testid={`btn-selecionar-membro-${m.id}`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold bg-white/10 text-[#D7BB7D] shrink-0">
                            {fotoUrl(m.foto) ? (
                              <img src={fotoUrl(m.foto)!} alt={m.nome || ""} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(m.nome || "?")
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{m.nome || "—"}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{[m.cargo, m.empresa].filter(Boolean).join(" · ")}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected member */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-[#D7BB7D] shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                    {fotoUrl(selectedMembro.foto) ? (
                      <img src={fotoUrl(selectedMembro.foto)!} alt={selectedMembro.nome || ""} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(selectedMembro.nome || "?")
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedMembro.nome || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[selectedMembro.cargo, selectedMembro.empresa].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    onClick={() => { setSelectedMembro(null); setSelectedPalavras([]); setSearchQuery(""); setTextoIA(""); setArquivoNome(null); setEvalMode("palavras"); }}
                    data-testid="btn-limpar-membro"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Already evaluated — locked state */}
                {minhaAvaliacaoDoSelecionado && minhaAvaliacaoDoSelecionado.palavras.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg border text-xs" style={{ borderColor: "rgba(215,187,125,0.25)", background: "rgba(215,187,125,0.06)", color: "rgba(215,187,125,0.85)" }}>
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="space-y-1.5">
                        <p className="font-semibold">Avaliação enviada</p>
                        <p className="opacity-75">Cada membro pode ser avaliado apenas uma vez. Sua avaliação não pode ser alterada.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {minhaAvaliacaoDoSelecionado.palavras.map(p => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-xs h-6 px-2.5 font-medium"
                          style={{ borderColor: "rgba(215,187,125,0.4)", color: "#D7BB7D", background: "rgba(215,187,125,0.08)" }}
                          data-testid={`badge-ja-avaliado-${p}`}
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                <>

                {/* Mode toggle */}
                <div className="flex rounded-lg border border-[#D7BB7D]/30 overflow-hidden text-xs" style={{ background: "rgba(0,29,52,0.06)" }}>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 transition-all font-semibold"
                    style={evalMode === "palavras"
                      ? { background: "rgba(215,187,125,0.18)", color: "#b8962e", borderRight: "1px solid rgba(215,187,125,0.2)" }
                      : { color: "#64748b", borderRight: "1px solid rgba(0,0,0,0.08)" }}
                    onClick={() => setEvalMode("palavras")}
                    data-testid="btn-modo-palavras"
                  >
                    <Tags className="w-3.5 h-3.5" />
                    Escolher palavras
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 transition-all font-semibold"
                    style={evalMode === "texto"
                      ? { background: "rgba(215,187,125,0.18)", color: "#b8962e" }
                      : { color: "#64748b" }}
                    onClick={() => setEvalMode("texto")}
                    data-testid="btn-modo-texto"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Analisar com IA
                  </button>
                </div>

                {/* AI text mode */}
                {evalMode === "texto" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Descreva as características de <strong className="text-foreground">{selectedMembro.nome}</strong> e a IA escolherá as palavras mais adequadas
                      </label>
                      <button
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border/50 text-muted-foreground hover:border-[#D7BB7D]/50 hover:text-[#D7BB7D] transition-colors shrink-0 ml-3"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={extrairArquivoMutation.isPending}
                        data-testid="btn-anexar-arquivo"
                        title="Anexar PDF ou TXT"
                      >
                        {extrairArquivoMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5" />
                        )}
                        {extrairArquivoMutation.isPending ? "Lendo..." : "Anexar arquivo"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
                        className="hidden"
                        data-testid="input-arquivo"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setArquivoNome(file.name);
                            extrairArquivoMutation.mutate(file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>

                    {arquivoNome && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/40 text-xs text-muted-foreground" style={{ background: "rgba(215,187,125,0.05)" }}>
                        <FileText className="w-3.5 h-3.5 text-[#D7BB7D] shrink-0" />
                        <span className="truncate flex-1">{arquivoNome}</span>
                        <button onClick={() => { setArquivoNome(null); setTextoIA(""); }} className="hover:text-foreground transition-colors shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <Textarea
                      placeholder={`Ex: ${selectedMembro.nome?.split(" ")[0] || "Este membro"} demonstra grande liderança e sempre entrega os projetos com excelência. É muito proativo e inspira a equipe...`}
                      value={textoIA}
                      onChange={e => setTextoIA(e.target.value)}
                      rows={4}
                      className="resize-none text-sm"
                      data-testid="textarea-descricao-ia"
                    />
                    <Button
                      className="w-full gap-2"
                      style={{ background: "#D7BB7D", color: "#001D34" }}
                      disabled={textoIA.trim().length < 10 || analisarMutation.isPending}
                      onClick={() => analisarMutation.mutate({ texto: textoIA, membro_nome: selectedMembro.nome || "" })}
                      data-testid="btn-analisar-ia"
                    >
                      {analisarMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> Analisar com IA</>
                      )}
                    </Button>
                    {textoIA.trim().length > 0 && textoIA.trim().length < 10 && (
                      <p className="text-[11px] text-muted-foreground">Escreva pelo menos 10 caracteres para analisar.</p>
                    )}
                  </div>
                )}

                {/* Word selection (manual mode) */}
                {evalMode === "palavras" && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Escolha até 3 palavras que descrevem este membro
                  </label>

                  {selectedPalavras.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedPalavras.map(p => (
                        <button
                          key={p}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all hover:opacity-80"
                          style={{ background: "rgba(215,187,125,0.12)", borderColor: "rgba(215,187,125,0.4)", color: "#D7BB7D" }}
                          onClick={() => togglePalavra(p)}
                          data-testid={`chip-palavra-${p}`}
                        >
                          {p}
                          <X className="w-3 h-3 opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedPalavras.length < 3 && (
                    <div className="relative">
                      <Input
                        placeholder="Digitar para buscar palavra..."
                        value={palavraInput}
                        onChange={e => { setPalavraInput(e.target.value); setShowSugestoes(true); }}
                        onFocus={() => setShowSugestoes(true)}
                        onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                        data-testid="input-palavra"
                        className="pr-9"
                      />
                      {palavraInput && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setPalavraInput("")}>
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      {showSugestoes && sugestoesFiltradas.length > 0 && (
                        <div
                          className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-border/60 overflow-hidden shadow-xl"
                          style={{ background: "#0d2035" }}
                        >
                          {sugestoesFiltradas.map(s => (
                            <button
                              key={s}
                              className="w-full text-left px-3 py-2.5 text-sm text-slate-100 hover:bg-white/10 transition-colors"
                              onMouseDown={() => togglePalavra(s)}
                              data-testid={`sugestao-${s}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick word suggestions */}
                  {!palavraInput && selectedPalavras.length < 3 && (
                    <div className="flex flex-wrap gap-1.5">
                      {lexico.filter(p => !selectedPalavras.includes(p)).slice(0, 16).map(p => (
                        <button
                          key={p}
                          className="rounded-full px-2.5 py-1 text-[11px] border border-border/40 text-muted-foreground hover:border-[#D7BB7D]/40 hover:text-[#D7BB7D] transition-colors"
                          onClick={() => togglePalavra(p)}
                          data-testid={`sugestao-rapida-${p}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <Button
                  className="w-full"
                  style={{ background: "#D7BB7D", color: "#001D34" }}
                  disabled={selectedPalavras.length === 0 || avaliarMutation.isPending}
                  onClick={() => avaliarMutation.mutate({ avaliadoId: selectedMembro.id, palavras: selectedPalavras })}
                  data-testid="btn-enviar-avaliacao"
                >
                  {avaliarMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Enviar Avaliação ({selectedPalavras.length}/3)</>
                  )}
                </Button>
                </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My evaluations given */}
      {myId && minhasAvaliacoesDadas.length > 0 && (
        <div className="space-y-3" data-testid="section-minhas-avaliacoes">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D7BB7D]" />
            Avaliações que Você Deu ({minhasAvaliacoesDadas.length})
          </h2>
          <div className="space-y-2">
            {minhasAvaliacoesDadas.map(av => (
              <div
                key={av.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/60"
                style={{ background: "rgba(255,255,255,0.01)" }}
                data-testid={`item-avaliacao-${av.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground/60 truncate mb-1">
                    {av.avaliado_nome ?? `Membro ${av.avaliado_membro_id.slice(0, 8)}…`}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {av.palavras.map(p => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="text-[10px] h-4 px-1.5"
                        style={{ borderColor: "rgba(215,187,125,0.3)", color: "rgba(215,187,125,0.7)" }}
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {av.created_at ? new Date(av.created_at).toLocaleDateString("pt-BR") : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      <Card className="border border-border/40 bg-transparent" data-testid="card-explicacao">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D7BB7D]" />
            Como funciona a Aura?
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A Aura Percebida é uma reputação construída pela percepção da comunidade. Cada membro pode escolher até 3 palavras para descrever outro membro. O score é calculado com base em três dimensões:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { dim: "T" as const, label: "Técnica", pct: 40, desc: "Competências técnicas, execução, organização, visão estratégica." },
              { dim: "C" as const, label: "Comportamental", pct: 35, desc: "Integridade, liderança, coragem, protagonismo, equilíbrio emocional." },
              { dim: "R" as const, label: "Relacional", pct: 25, desc: "Colaboração, empatia, confiança, comunicação, aliança." },
            ].map(d => (
              <div key={d.dim} className="rounded-lg p-3 border border-border/40 space-y-1.5" style={{ background: `${dimColor(d.dim)}08` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: dimColor(d.dim) }}>{d.label}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5" style={{ borderColor: `${dimColor(d.dim)}40`, color: dimColor(d.dim) }}>
                    {d.pct}%
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <p>• Score visível publicamente apenas após <strong className="text-foreground">mínimo de 3 avaliações</strong>.</p>
            <p>• Palavras avaliadas por 2-3 membros têm peso 1.5×; por 4 ou mais, peso 2.0×.</p>
            <p>• Você pode atualizar sua avaliação de um membro a qualquer momento.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
