import { useEffect, useState, useMemo, useRef } from "react";
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
  ShieldCheck, Target, Briefcase, CalendarDays, BarChart3,
  AlertTriangle, Lock, Activity, BookOpen, Handshake, Settings,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useParams } from "wouter";

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
  foto?: string | { id?: string; filename_disk?: string } | null;
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
      const peso = count >= 4 ?2.0 : count >= 2 ?1.5 : 1.0;
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

function clampScore(value: number, max: number): number {
  if (!max) return 0;
  return Math.round(Math.min(value / max, 1) * 100);
}

function statusFromScore(value: number): { label: string; color: string } {
  if (value >= 80) return { label: "Forte", color: "#22C55E" };
  if (value >= 55) return { label: "Média", color: "#D7BB7D" };
  if (value > 0) return { label: "Em evolução", color: "#F59E0B" };
  return { label: "Aguardando", color: "#94A3B8" };
}

function faixaDescricao(score: number | null): string {
  if (score === null) return "Aguardando avaliações";
  if (score >= 90) return "Aura Suprema";
  if (score >= 70) return "Aura Forte";
  if (score >= 50) return "Aura Confiável";
  return "Aura em Evolução";
}

function fotoUrl(foto: MembroBusca["foto"]): string | null {
  if (!foto) return null;
  const fileId = typeof foto === "string" ?foto : foto.id || foto.filename_disk;
  if (!fileId) return null;
  if (fileId.startsWith("/api/assets/")) return fileId;
  if (fileId.startsWith("/assets/")) return fileId.replace(/^\/assets\//, "/api/assets/");
  if (fileId.startsWith("http")) return fileId;
  return `/api/assets/${fileId}?width=80&height=80&fit=cover`;
}

function AvatarImage({ foto, nome }: { foto: MembroBusca["foto"]; nome?: string }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ?fotoUrl(foto) : null;
  if (!src) return <>{getInitials(nome || "?")}</>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function getInitials(nome: string): string {
  return nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

export default function AuraPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { membroId: routeMembroId } = useParams<{ membroId?: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembro, setSelectedMembro] = useState<MembroBusca | null>(null);
  const [selectedPalavras, setSelectedPalavras] = useState<string[]>([]);
  const [palavraInput, setPalavraInput] = useState("");
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [evalMode, setEvalMode] = useState<"palavras" | "texto">("palavras");
  const [selectedNucleoLeitura, setSelectedNucleoLeitura] = useState("Técnico");
  const [textoIA, setTextoIA] = useState("");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = user?.membro_directus_id;
  const viewedMembroId = routeMembroId || myId;
  const isOwnAura = !routeMembroId || routeMembroId === myId;

  const { data: viewedMembro } = useQuery<MembroBusca | null>({
    queryKey: ["/api/membros", routeMembroId],
    queryFn: async () => {
      const res = await fetch(`/api/membros/${routeMembroId}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        nome: data.nome,
        cargo: data.cargo || data.responsavel_cargo || null,
        empresa: data.empresa || data.nome_fantasia || null,
        foto: data.foto_perfil || null,
      };
    },
    enabled: !!routeMembroId,
  });

  const { data: viewedAura } = useQuery<AuraResult>({
    queryKey: ["/api/aura/score", viewedMembroId],
    enabled: !!viewedMembroId,
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
  const evolucaoDados = useMemo(() => isOwnAura ? calcularEvolucao(minhasAvaliacoesRecebidas) : [], [isOwnAura, minhasAvaliacoesRecebidas]);

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

  useEffect(() => {
    if (!routeMembroId || routeMembroId === myId || !viewedMembro) return;
    setSelectedMembro(viewedMembro);
    setSelectedPalavras([]);
    setSearchQuery("");
    setTextoIA("");
    setArquivoNome(null);
    setEvalMode("palavras");
  }, [routeMembroId, myId, viewedMembro]);

  const memberSearchTerm = searchQuery.trim();
  const memberSearchActive = memberSearchTerm.length >= 2;
  const searchResults = memberSearchActive ?allMembros
    .filter(m => m.id !== myId)
    .filter(m => {
      const q = memberSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nome = (m.nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const empresa = (m.empresa || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nome.includes(q) || empresa.includes(q);
    })
    .slice(0, 12) : [];

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
      queryClient.invalidateQueries({ queryKey: ["/api/aura/score", selectedMembro?.id] });
      if (!routeMembroId) setSelectedMembro(null);
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
      setTextoIA(prev => prev ?prev + "\n\n" + data.texto : data.texto);
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

  const score = viewedAura?.score ?? null;
  const T = viewedAura?.T ?? 0;
  const R = viewedAura?.R ?? 0;
  const C = viewedAura?.C ?? 0;
  const n = viewedAura?.n ?? 0;
  const palavrasRecebidas = viewedAura?.palavras_recebidas ?? [];
  const viewedName = isOwnAura ? (user?.nome || user?.username || "Membro BUILT") : (viewedMembro?.nome || "Membro BUILT");
  const viewedEmail = isOwnAura ? user?.email : "";
  const viewedFoto = isOwnAura ? user?.foto_perfil : viewedMembro?.foto;
  const pontoMax = Math.max(n * 2, 1);
  const dimensoesAura = [
    {
      dim: "T" as const,
      label: "Técnica",
      peso: 40,
      pontuacao: clampScore(T, pontoMax),
      descricao: "Capacidade de entrega, método e eficiência técnica.",
    },
    {
      dim: "R" as const,
      label: "Relacional",
      peso: 25,
      pontuacao: clampScore(R, pontoMax),
      descricao: "Capacidade de gerar confiança, colaboração e conexão.",
    },
    {
      dim: "C" as const,
      label: "Comportamental",
      peso: 35,
      pontuacao: clampScore(C, pontoMax),
      descricao: "Maturidade ética, consistência institucional e atitude.",
    },
  ];
  const palavrasValidas = palavrasRecebidas.reduce((total, p) => total + p.count, 0);
  const topPalavra = palavrasRecebidas[0] ?? null;
  const convergencia = n >= 5 && palavrasRecebidas.some(p => p.count >= 2) ? "Alta" : n >= 3 ? "Média" : "Em formação";
  const fatorRelevancia = score === null ? 0 : Math.max(1, Math.min(1.2, 1 + ((T + R + C) / pontoMax) * 0.04));
  const dnaBuilt = [
    { label: "Mentalidade de Aliança", value: dimensoesAura[1].pontuacao },
    { label: "Reputação Vívida", value: score ?? 0 },
    { label: "Responsabilidade Compartilhada", value: dimensoesAura[2].pontuacao },
    { label: "Comprometimento com Excelência", value: dimensoesAura[0].pontuacao },
    { label: "Capacidade de Conexão Humana", value: dimensoesAura[1].pontuacao },
    { label: "Disciplina e Organização", value: dimensoesAura[0].pontuacao },
    { label: "Inteligência Colaborativa", value: Math.round((dimensoesAura[0].pontuacao + dimensoesAura[1].pontuacao) / 2) },
    { label: "Propósito Alinhado", value: dimensoesAura[2].pontuacao },
  ];
  const nucleoMaisForte = [...dimensoesAura].sort((a, b) => b.pontuacao - a.pontuacao)[0];
  const horizonteProjeto = score !== null && score >= 70 ? "Longo prazo" : score !== null && score >= 50 ? "Médio prazo" : "Curto prazo";
  const nivelResponsabilidade = score !== null && score >= 70 ? "Alta" : score !== null && score >= 50 ? "Média" : "Baixa";
  const compatibilidadeCultural = convergencia === "Alta" ? "Alta" : convergencia === "Média" ? "Média" : "Baixa";
  const leiturasPorNucleo: Record<string, string> = {
    "Técnico": "Sua Aura indica leitura para núcleos técnicos: organização, qualidade de entrega e sustentação de decisões com método.",
    "Obra": "Sua Aura aplicada ao núcleo de obra observa disciplina de execução, compromisso com prazos, consistência operacional e capacidade de resolver problemas no campo.",
    "Comercial": "Sua Aura aplicada ao núcleo comercial observa confiança relacional, clareza de comunicação, capacidade de conexão e reputação para gerar oportunidades.",
    "Capital": "Sua Aura aplicada ao núcleo de capital observa responsabilidade, transparência, governança, previsibilidade e cuidado com recursos compartilhados.",
    "Liderança": "Sua Aura aplicada à liderança observa maturidade institucional, capacidade de alinhar pessoas, compromisso com excelência e postura de aliança.",
  };
  const leituraNucleo = leiturasPorNucleo[selectedNucleoLeitura] ?? leiturasPorNucleo["Técnico"];
  const matrizAplicabilidade = [
    { icon: CalendarDays, label: "Horizonte de Projeto", value: horizonteProjeto, color: "#22C55E" },
    { icon: BarChart3, label: "Nível de Responsabilidade", value: nivelResponsabilidade, color: "#3B82F6" },
    { icon: Handshake, label: "Tipo de Aliança Recomendada", value: nucleoMaisForte.dim === "T" ? "Técnica e liderança" : nucleoMaisForte.dim === "R" ? "Relacionamento e comunidade" : "Governança e liderança", color: "#D7BB7D" },
    { icon: Users, label: "Compatibilidade Cultural", value: compatibilidadeCultural, color: "#22C55E" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
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

      {viewedMembroId && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4" data-testid="section-aura-dashboard">
          <Card className="border border-border/60 xl:col-span-4 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(0,29,52,0.04), rgba(215,187,125,0.04))" }}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-[#001D34]/10 text-[#D7BB7D] text-lg font-bold shrink-0">
                  {viewedFoto ?(
                    <img src={fotoUrl(viewedFoto) || ""} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(viewedName || "BU")
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#D7BB7D]">Perfil reputacional</p>
                  <h2 className="text-xl font-semibold text-foreground truncate">{viewedName}</h2>
                  <p className="text-sm text-muted-foreground">{viewedEmail || (isOwnAura ? "E-mail não informado" : "Aura do membro aliado")}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs" style={{ color: "#22C55E", borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.08)" }}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {user?.ativo ? "Membro validado" : "Em validação"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 p-4 bg-background/40">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Aura Percebida é como seus aliados percebem sua atuação para trabalhar em alianças.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-8" data-testid="card-indice-aura">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-[150px_1fr_260px] gap-5 items-center">
                <AuraScore score={score} size="lg" />
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Índice de Aura</p>
                    <h2 className="text-2xl font-semibold" style={{ color: getFaixaColor(score) }}>{faixaDescricao(score)}</h2>
                    <p className="text-sm text-muted-foreground">
                      {score === null ? "Aguardando base reputacional" : "Leitura consolidada da percepção da rede."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border/50 p-3">
                      <Users className="w-4 h-4 text-[#D7BB7D] mb-1" />
                      <strong className="text-foreground">{n}</strong>
                      <p className="text-xs text-muted-foreground">avaliadores</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <Tags className="w-4 h-4 text-[#D7BB7D] mb-1" />
                      <strong className="text-foreground">{palavrasValidas}</strong>
                      <p className="text-xs text-muted-foreground">palavras válidas</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Convergência reputacional: <span className="font-semibold text-[#D7BB7D]">{convergencia}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 p-4 bg-background/40">
                  <p className="text-sm font-semibold text-foreground mb-3">Faixas de Aura</p>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { color: "#D7BB7D", range: "90 - 100", label: "Aura Suprema" },
                      { color: "#3B82F6", range: "70 - 89", label: "Aura Forte" },
                      { color: "#22C55E", range: "50 - 69", label: "Aura Confiável" },
                      { color: "#EF4444", range: "0 - 49", label: "Aura em Evolução" },
                    ].map(item => (
                      <div key={item.label} className="grid grid-cols-[12px_58px_1fr] items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-xs text-muted-foreground">{item.range}</span>
                        <span className="text-sm text-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-[#D7BB7D]" />
                Dimensões da Aura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dimensoesAura.map(d => {
                const DimensionIcon = d.dim === "T" ? Settings : d.dim === "R" ? Users : ShieldCheck;
                return (
                <div key={d.dim} className="grid grid-cols-[40px_1fr_52px] gap-3 items-center">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ color: dimColor(d.dim), background: `${dimColor(d.dim)}14` }}
                  >
                    <DimensionIcon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: dimColor(d.dim) }}>{d.label}</p>
                        <p className="text-[11px] text-muted-foreground">{d.descricao}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{d.peso}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.pontuacao}%`, background: dimColor(d.dim) }} />
                    </div>
                  </div>
                  <strong className="text-lg text-right text-foreground">{d.pontuacao}</strong>
                </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tags className="w-4 h-4 text-[#D7BB7D]" />
                Principais Percepções Recebidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {palavrasRecebidas.length > 0 ?palavrasRecebidas.slice(0, 8).map(p => (
                  <span
                    key={p.canonico}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium"
                    style={{ color: dimColor(p.dimensao), borderColor: `${dimColor(p.dimensao)}45`, background: `${dimColor(p.dimensao)}10` }}
                  >
                    {p.canonico}
                  </span>
                )) : (
                  <p className="text-sm text-muted-foreground">As percepções aparecerão conforme a comunidade avaliar você.</p>
                )}
              </div>
              <div className="rounded-xl border border-border/50 p-4 bg-background/40 min-h-[140px]">
                {topPalavra ?(
                  <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: dimColor(topPalavra.dimensao) }}>{topPalavra.canonico}</p>
                    <p className="text-xs text-muted-foreground">Dimensão: <span className="text-foreground">{dimLabel(topPalavra.dimensao)}</span></p>
                    <p className="text-xs text-muted-foreground">Frequência: <span className="text-foreground">{topPalavra.count}</span> ocorrência{topPalavra.count !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Evidência contextual: citada em avaliações recebidas da rede BUILT.</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground">
                    Sem palavras recebidas ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D7BB7D]" />
                  Aderência ao DNA BUILT
                </CardTitle>
                <Badge variant="outline" className="text-[10px]" style={{ color: "#22C55E", borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}>
                  FR {fatorRelevancia.toFixed(2).replace(".", ",")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dnaBuilt.map(item => {
                const status = statusFromScore(item.value);
                return (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-xs border-b border-border/30 pb-2 last:border-b-0">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold shrink-0" style={{ color: status.color }}>{status.label}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#D7BB7D]" />
                Matriz de Aplicabilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {matrizAplicabilidade.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-border/50 p-3 bg-background/40">
                    <Icon className="w-4 h-4 mb-2" style={{ color: item.color }} />
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D7BB7D]" />
                Leitura Contextual por Núcleo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {["Técnico", "Obra", "Comercial", "Capital", "Liderança"].map((nucleo) => {
                  const active = selectedNucleoLeitura === nucleo;
                  return (
                  <button
                    key={nucleo}
                    type="button"
                    className="rounded-md px-3 py-1.5 text-xs border transition-colors hover:border-[#D7BB7D]/50 hover:text-[#D7BB7D]"
                    style={active ?{ background: "rgba(59,130,246,0.12)", color: "#3B82F6", borderColor: "rgba(59,130,246,0.35)" } : undefined}
                    onClick={() => setSelectedNucleoLeitura(nucleo)}
                    data-testid={`btn-leitura-nucleo-${nucleo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                  >
                    {nucleo}
                  </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{leituraNucleo}</p>
            </CardContent>
          </Card>

          <Card className="border border-border/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#D7BB7D]" />
                Histórico de Evolução da Aura
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evolucaoDados.length === 0 ?(
                <div className="h-44 flex items-center justify-center text-center text-xs text-muted-foreground">
                  A evolução aparecerá após as primeiras avaliações.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <AreaChart data={evolucaoDados} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val: number) => [`${val} pts`, "Aura"]} />
                    <Area type="monotone" dataKey="score" stroke={getFaixaColor(score)} strokeWidth={2} fill={`${getFaixaColor(score)}22`} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* Received evaluations list */}
      {isOwnAura && myId && minhasAvaliacoesRecebidas.length > 0 && (
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
              {routeMembroId && routeMembroId !== myId ? `Registrar Aura de ${viewedName}` : "Avaliar um Membro"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedMembro ?(
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
                {searchQuery.trim().length > 0 && (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {!memberSearchActive ?(
                      <p className="text-xs text-muted-foreground p-2">Digite pelo menos 2 letras para buscar.</p>
                    ) : loadingSearch ?(
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      ))
                    ) : searchResults.length === 0 ?(
                      <p className="text-xs text-muted-foreground p-2">Nenhum membro encontrado.</p>
                    ) : (
                      searchResults.map(m => (
                        <button
                          key={m.id}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                          onClick={() => { setSelectedMembro(m); setSearchQuery(""); setSelectedPalavras([]); }}
                          data-testid={`btn-selecionar-membro-${m.id}`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold bg-white/10 text-[#D7BB7D] shrink-0">
                            <AvatarImage foto={m.foto} nome={m.nome} />
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
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected member */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-[#D7BB7D] shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <AvatarImage foto={selectedMembro.foto} nome={selectedMembro.nome} />
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
                {minhaAvaliacaoDoSelecionado && minhaAvaliacaoDoSelecionado.palavras.length > 0 ?(
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
                      ?{ background: "rgba(215,187,125,0.18)", color: "#b8962e", borderRight: "1px solid rgba(215,187,125,0.2)" }
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
                      ?{ background: "rgba(215,187,125,0.18)", color: "#b8962e" }
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
                        {extrairArquivoMutation.isPending ?(
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5" />
                        )}
                        {extrairArquivoMutation.isPending ?"Lendo..." : "Anexar arquivo"}
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
                      {analisarMutation.isPending ?(
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
                  {avaliarMutation.isPending ?(
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
      {isOwnAura && myId && minhasAvaliacoesDadas.length > 0 && (
        <div className="space-y-3" data-testid="section-minhas-avaliacoes">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#D7BB7D]" />
            Avaliações que você deu ({minhasAvaliacoesDadas.length})
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
                      {av.avaliado_nome ?? `Membro ${av.avaliado_membro_id.slice(0, 8)}...`}
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
                  {av.created_at ?new Date(av.created_at).toLocaleDateString("pt-BR") : "—"}
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
            Como funciona a Percepção de Aura
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A Aura Percebida BUILT é o índice de validação reputacional da rede. Cada avaliação registra até 3 palavras baseadas em experiências reais; essas palavras são agrupadas por significado, frequência entre avaliadores distintos e aderência aos valores BUILT.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { dim: "T" as const, label: "Técnica", pct: 40, desc: "Qualidade da entrega, conhecimento técnico, método, consistência e execução." },
              { dim: "C" as const, label: "Comportamental", pct: 35, desc: "Ética, alinhamento cultural BUILT, protagonismo, maturidade e atitude proativa." },
              { dim: "R" as const, label: "Relacional", pct: 25, desc: "Clareza, confiança, comunicação, colaboração e formação de alianças." },
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
            <p>• Palavras citadas por 2-3 avaliadores distintos têm peso 1.5×; por 4 ou mais, peso 2.0×.</p>
            <p>• O cálculo aplica o <strong className="text-foreground">Fator de Relevância</strong>, que valoriza em até 20% as dimensões alinhadas ao DNA BUILT.</p>
            <p>• O mínimo ideal para leitura institucional é de <strong className="text-foreground">5 avaliadores distintos</strong>; avaliações são cumulativas e rastreáveis.</p>
            <p>• Cada par avaliador/avaliado registra uma avaliação única, sem alteração posterior.</p>
          </div>
        </CardContent>
      </Card>

      {myId && (
        <Card className="border border-border/60" data-testid="card-alertas-governanca">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { icon: ShieldCheck, title: "Sem alertas ativos", desc: "Membro em conformidade com as políticas BUILT.", color: "#22C55E" },
              { icon: AlertTriangle, title: n >= 5 ? "Base amostral adequada" : "Base amostral moderada", desc: n >= 5 ? "Volume mínimo ideal de avaliadores atingido." : "Recomendado ampliar o número de avaliadores.", color: "#D7BB7D" },
              { icon: Activity, title: `Convergência ${convergencia.toLowerCase()}`, desc: "Consistência das avaliações recebidas na rede.", color: "#3B82F6" },
              { icon: Lock, title: "Dados protegidos", desc: "As informações exibidas são de uso interno da BUILT.", color: "#94A3B8" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-xl border border-border/40 p-3 bg-background/40">
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: item.color }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: item.color }}>{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}



