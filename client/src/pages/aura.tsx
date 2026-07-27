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
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AuraScore, getFaixaColor } from "@/components/aura-score";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles, Search, X, CheckCircle2, Loader2, ChevronRight,
  TrendingUp, Users, Zap, Bot, Tags, Paperclip, FileText,
  ShieldCheck, Target, Briefcase, CalendarDays, BarChart3,
  AlertTriangle, Lock, BookOpen, Handshake, Settings,
  Info,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useLocation, useParams } from "wouter";
import { canRegisterAuraForMember, getAuraLinkedMemberIds, isBuiltMemberForAura, isVitrineOnlyUser } from "@/lib/aura-access";
import { EnvironmentAccessDialog, environmentAccessFor } from "@/components/environment-access";

interface AuraResult {
  score: number | null;
  T: number | null;
  R: number | null;
  C: number | null;
  aura_plena?: number;
  aura_observada?: number | null;
  aura_publicavel?: number | null;
  cobertura_dimensional?: number;
  teto_cobertura?: number | null;
  teto_confianca?: number;
  teto_curadoria?: number | null;
  motivos_trava?: string[];
  n: number;
  faixa: string | null;
  FR_T?: number;
  FR_R?: number;
  FR_C?: number;
  confianca?: string;
  confianca_descricao?: string;
  total_palavras?: number;
  scores_reputacionais?: Record<"T" | "R" | "C", number>;
  scores_ajustados?: Record<"T" | "R" | "C", number>;
  pontos_positivos?: Record<"T" | "R" | "C", number>;
  penalidades_negativas?: Record<"T" | "R" | "C", number>;
  amplitude_reputacional?: Record<"T" | "R" | "C", number>;
  convergencia_reputacional?: Record<"T" | "R" | "C", number>;
  dimensoes_com_evidencia?: Array<"T" | "R" | "C">;
  dimensoes_sem_evidencia?: Array<"T" | "R" | "C">;
  elegivel_aura_suprema?: boolean;
  correspondencia_valores?: Record<"T" | "R" | "C", number>;
  redutor_reputacional?: number;
  pontos_atencao_reputacional?: Array<{
    palavra: string;
    canonico: string;
    dimensao: "T" | "R" | "C";
    count: number;
    gravidade: "leve" | "moderada" | "grave" | "critica";
    valor_afetado: string;
    impacto: number;
    status: "considerado_no_calculo" | "em_curadoria_reputacional";
    recomendacao: string;
  }>;
  palavras_recebidas: Array<{
    palavra: string;
    canonico: string;
    dimensao: "T" | "R" | "C";
    count: number;
    polaridade?: "positiva" | "negativa";
    gravidade?: "leve" | "moderada" | "grave" | "critica";
  }>;
}

type NucleoAplicabilidade = "Comercial" | "Liderança" | "Técnico" | "Obra" | "Capital";

interface ConvergenciaNucleo {
  nucleo: NucleoAplicabilidade;
  score: number;
  nivel: "Alta" | "Média/Alta" | "Baixa/Média" | "Baixa";
  palavras: string[];
  justificativa: string;
}

interface MembroBusca {
  id: string;
  nome: string;
  cargo: string;
  empresa: string;
  foto: string | { id: string; filename_disk: string } | null;
}

interface MinhaAvaliacao {
  id: number;
  avaliador_membro_id: string;
  avaliado_membro_id: string;
  avaliado_nome: string | null;
  avaliador_nome: string | null;
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

function normalizeAuraWord(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeAuraSuggestionKey(value: string): string {
  return normalizeAuraWord(value)
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/(acao|coes|amento|amentos|idade|idades|ancia|encias|encia|ado|ada|idos|idas|ido|ida|avel|ivel|ante|ente|ivo|iva|oso|osa|or|ora|al|ico|ica|ao|a|o|s)$/, "");
}

function keywordMatchesWord(keyword: string, word: string): boolean {
  return word === keyword || word.includes(keyword) || keyword.includes(word);
}

function nivelConvergencia(value: number): ConvergenciaNucleo["nivel"] {
  if (value >= 7) return "Alta";
  if (value >= 4.5) return "Média/Alta";
  if (value >= 2) return "Baixa/Média";
  return "Baixa";
}

function buildJustificativaNucleo(nucleo: NucleoAplicabilidade, palavras: string[]): string {
  const evidencias = palavras.slice(0, 6).join(", ");
  if (!evidencias) {
    return `Ainda há baixa evidência reputacional específica para aplicabilidade em ${nucleo}.`;
  }
  const foco = NUCLEOS_APLICABILIDADE.find((item) => item.nucleo === nucleo)?.foco || "aplicabilidade prática";
  return `${evidencias} indicam aderência a ${foco}.`;
}

function getAplicacaoRecomendada(principal?: ConvergenciaNucleo, secundaria?: ConvergenciaNucleo): string {
  if (!principal || principal.score <= 0) {
    return "Aguardar novas avaliações antes de recomendar uma aplicabilidade predominante por núcleo.";
  }

  if (principal.nucleo === "Comercial") {
    return secundaria?.nucleo === "Liderança"
      ? "Indicado para relacionamento, articulação comercial e ativação de alianças. Evitar responsabilidade crítica isolada até nova validação técnico-operacional."
      : "Indicado para aproximação, relacionamento com membros, articulação de oportunidades e suporte à formação de alianças.";
  }
  if (principal.nucleo === "Liderança") {
    return "Indicado para mobilização de aliados, condução relacional e apoio à governança, preferencialmente com validação formal do papel exercido.";
  }
  if (principal.nucleo === "Técnico") {
    return "Indicado para análise, planejamento, método e suporte técnico, observando a validação prática em entregas reais.";
  }
  if (principal.nucleo === "Obra") {
    return "Indicado para acompanhamento de execução, controle operacional e resolução prática, conforme evidências reais de campo.";
  }
  return "Indicado para apoio em confiança, previsibilidade e governança econômico-financeira, com validação jurídica e formal quando houver impacto patrimonial.";
}

const PALAVRAS_OFICIAIS_AURA_V3: Record<"T" | "R" | "C", string[]> = {
  T: [
    "Eficiente", "Detalhista", "Organizado", "Preciso", "Especialista", "Resolutivo",
    "Inteligente", "Inovador", "Analítico", "Planejado", "Técnico", "Seguro",
    "Produtivo", "Disciplinado", "Sustentável", "Estratégico", "Competente",
    "Estruturado", "Pontual", "Eficaz",
  ],
  R: [
    "Confiável", "Comunicativo", "Transparente", "Empático", "Cordial", "Prestativo",
    "Colaborativo", "Educado", "Participativo", "Inspirador", "Amigável", "Justo",
    "Leal", "Facilitador", "Atencioso", "Acessível", "Acolhedor", "Agregador",
    "Aliado", "Parceiro", "Acreditável", "Credibilidade",
  ],
  C: [
    "Proativo", "Ético", "Alinhado", "Determinado", "Resiliente", "Engajado",
    "Corajoso", "Evolutivo", "Maduro", "Visionário", "Consistente", "Exemplar",
    "Fiel", "Pioneiro", "Solidário", "Líder", "Motivador", "Responsável",
    "Aberto", "Liderança",
  ],
};

const NUCLEOS_APLICABILIDADE: Array<{
  nucleo: NucleoAplicabilidade;
  foco: string;
  keywords: string[];
}> = [
  {
    nucleo: "Comercial",
    foco: "relacionamento, confiança, articulação e geração de oportunidades",
    keywords: [
      "acessivel", "acreditavel", "aliado", "credibilidade", "acolhedor", "agregador", "aberto",
      "comunicativo", "comunicacao", "articulado", "articulador", "influente", "relacional",
      "relacionamento", "conexao", "parceiro", "facilitador", "prestativo", "confiavel",
      "transparente", "empatico", "cordial", "colaborativo", "integrador", "convincente",
      "eloquente", "rede",
    ],
  },
  {
    nucleo: "Liderança",
    foco: "mobilização, influência, responsabilidade e condução de alianças",
    keywords: [
      "lider", "lideranca", "motivador", "responsavel", "protagonismo", "protagonista", "visao",
      "visionario", "mobilizador", "inspirador", "orientador", "guia", "mentor", "coordenador",
      "equilibrado", "decidido", "decisao", "influente", "exemplar", "proativo", "engajado",
      "firme", "maduro", "autonomo", "responsabilidade",
    ],
  },
  {
    nucleo: "Técnico",
    foco: "método, organização, análise, planejamento e domínio técnico",
    keywords: [
      "metodo", "metodico", "precisao", "preciso", "organizado", "organizacao", "analise",
      "analitico", "tecnico", "especialista", "planejado", "planejamento", "estruturado",
      "logico", "competente", "eficiente", "detalhista", "resolutivo", "inteligente",
      "disciplina", "disciplinado", "sistematico", "qualificado", "perito",
    ],
  },
  {
    nucleo: "Obra",
    foco: "execução, prazo, controle, segurança e solução prática em campo",
    keywords: [
      "execucao", "executor", "executa", "prazo", "prazos", "controle", "seguranca", "produtivo",
      "produtividade", "pratico", "operacional", "campo", "qualidade", "eficaz", "eficiencia",
      "rapido", "agil", "agilidade", "entrega", "entrega resultados", "funcional", "resolutivo",
      "faz acontecer", "foco", "cumpre prazos",
    ],
  },
  {
    nucleo: "Capital",
    foco: "previsibilidade, análise, responsabilidade financeira e prestação de contas",
    keywords: [
      "previsivel", "previsibilidade", "confianca", "confiavel", "credibilidade", "analise",
      "analitico", "responsabilidade", "responsavel", "financeiro", "prestacao", "presta contas",
      "accountability", "prudente", "racional", "seguro", "estavel", "estabilidade", "consistente",
      "transparente", "planejado", "ponderado", "disciplina", "organizado",
    ],
  },
];

for (const [dimensao, palavras] of Object.entries(PALAVRAS_OFICIAIS_AURA_V3) as Array<["T" | "R" | "C", string[]]>) {
  for (const palavra of palavras) {
    DIM_MAP[palavra] = dimensao;
  }
}

const DIM_NORMALIZED_MAP = new Map<string, "T" | "R" | "C">(
  Object.entries(DIM_MAP).map(([palavra, dimensao]) => [normalizeAuraWord(palavra), dimensao])
);

interface EvolucaoPonto { label: string; score: number; n: number; }

function tetoConfiancaAura(n: number): number {
  if (n >= 5) return 100;
  if (n >= 2) return 89;
  return 69;
}

function tetoCoberturaAura(cobertura: number): number | null {
  if (cobertura >= 100) return 100;
  if (cobertura >= 75) return 89;
  if (cobertura >= 60) return 79;
  if (cobertura >= 40) return 69;
  return null;
}

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
      const palavraKey = normalizeAuraWord(palavra);
      const dim = DIM_MAP[palavra] ?? DIM_NORMALIZED_MAP.get(palavraKey);
      if (!dim || seen.has(palavraKey)) continue;
      seen.add(palavraKey);
      if (!canonAvaliadores.has(palavraKey)) {
        canonAvaliadores.set(palavraKey, { dim, avaliadores: new Set() });
      }
      canonAvaliadores.get(palavraKey)!.avaliadores.add(av.avaliador_membro_id);
    }
    const n = new Set(sorted.slice(0, i + 1).map(item => item.avaliador_membro_id).filter(Boolean)).size || i + 1;
    const pontos = { T: 0, R: 0, C: 0 };
    const canonicos = { T: 0, R: 0, C: 0 };
    for (const { dim, avaliadores } of Array.from(canonAvaliadores.values())) {
      const count = avaliadores.size;
      const peso = count >= 4 ?2.0 : count >= 2 ?1.5 : 1.0;
      pontos[dim] += peso;
      canonicos[dim] += 1;
    }
    const dimScore = (dim: "T" | "R" | "C") => canonicos[dim] ? 100 : 0;
    const convergenciaDim = (dim: "T" | "R" | "C") =>
      canonicos[dim] ? Math.min((pontos[dim] / (canonicos[dim] * 2)) * 100, 100) : 0;
    const pesos = { T: 0.4, R: 0.25, C: 0.35 };
    const dims: Array<"T" | "R" | "C"> = ["T", "R", "C"];
    const dimsComEvidencia = dims.filter(dim => canonicos[dim] > 0);
    const cobertura = Math.round(dimsComEvidencia.reduce((sum, dim) => sum + pesos[dim], 0) * 100);
    const coberturaDecimal = cobertura / 100;
    const auraObservada = coberturaDecimal > 0
      ? Math.round(dimsComEvidencia.reduce((sum, dim) => sum + dimScore(dim) * pesos[dim], 0) / coberturaDecimal)
      : 0;
    const tetoCobertura = tetoCoberturaAura(cobertura);
    const tetoConfianca = tetoConfiancaAura(n);
    let score = tetoCobertura === null ? 0 : Math.min(auraObservada, tetoCobertura, tetoConfianca);
    const dimensoesConvergentes = dims.filter((dim) => convergenciaDim(dim) >= 60).length;
    if (score >= 90 && (cobertura < 100 || n < 5 || dims.some(dim => dimScore(dim) < 70) || dimensoesConvergentes < 2)) score = 89;
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

function fixMojibakeText(value: string): string {
  if (!/[ÃÂ]|[\u0080-\u009F]/.test(value)) return value.normalize("NFC");
  try {
    return decodeURIComponent(escape(value)).normalize("NFC");
  } catch {
    return value.normalize("NFC");
  }
}

function fixMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return fixMojibakeText(value) as T;
  if (Array.isArray(value)) return value.map(item => fixMojibakeDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, fixMojibakeDeep(item)])
    ) as T;
  }
  return value;
}

function fotoUrl(foto: MembroBusca["foto"]): string | null {
  if (!foto) return null;
  const fileId = typeof foto === "string" ? foto : foto.id || foto.filename_disk;
  if (!fileId) return null;
  if (fileId.startsWith("/api/assets/")) return fileId;
  if (fileId.startsWith("/assets/")) return fileId.replace(/^\/assets\//, "/api/assets/");
  if (fileId.startsWith("http")) return fileId;
  return `/api/assets/${fileId}?width=80&height=80&fit=cover`;
}

function AvatarImage({ foto, nome }: { foto: MembroBusca["foto"]; nome: string }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? fotoUrl(foto) : null;
  if (!src) return <>{getInitials(nome || "")}</>;
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
  return nome.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "";
}

export default function AuraPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { membroId: routeMembroId } = useParams<{ membroId: string }>();
  const [location, setLocation] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [selectedMembro, setSelectedMembro] = useState<MembroBusca | null>(null);
  const [selectedPalavras, setSelectedPalavras] = useState<string[]>([]);
  const [palavraInput, setPalavraInput] = useState("");
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [evalMode, setEvalMode] = useState<"palavras" | "texto">("palavras");
  const [showAvaliacoesDadas, setShowAvaliacoesDadas] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [blockedAccess, setBlockedAccess] = useState<ReturnType<typeof environmentAccessFor> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = user?.membro_directus_id;
  const viewedMembroId = routeMembroId || myId;
  const isOwnAura = !routeMembroId || routeMembroId === myId;
  const canConsultAura = isBuiltMemberForAura(user);
  const isVitrineOnly = isVitrineOnlyUser(user);
  const authResolved = !authLoading;
  const canViewRequestedAura = !!viewedMembroId && authResolved && (isOwnAura || (!isVitrineOnly && canConsultAura));

  useEffect(() => {
    const locationQuery = location.includes("?") ? location.split("?")[1] : "";
    const browserQuery = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const shouldOpenLookup =
      new URLSearchParams(locationQuery).get("registrar") === "1" ||
      new URLSearchParams(browserQuery).get("registrar") === "1";
    if (shouldOpenLookup) {
      if (canConsultAura) {
        setLookupOpen(true);
      } else if (authResolved && user) {
        setBlockedAccess(environmentAccessFor(user, "alliances"));
      }
    }
  }, [location, canConsultAura, authResolved, user]);

  function handleConsultAndRegisterAura() {
    if (canConsultAura) {
      setLookupOpen(true);
      return;
    }
    setBlockedAccess(environmentAccessFor(user, "alliances"));
  }

  useEffect(() => {
    if (isVitrineOnly && routeMembroId && routeMembroId !== myId) {
      setLocation("/aura");
    }
  }, [isVitrineOnly, routeMembroId, myId, setLocation]);

  const { data: viewedMembro } = useQuery<MembroBusca | null>({
    queryKey: ["/api/membros", routeMembroId],
    queryFn: async () => {
      const res = await fetch(`/api/membros/${routeMembroId}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = fixMojibakeDeep(await res.json());
      return {
        id: data.id,
        nome: data.nome,
        cargo: data.cargo || data.responsavel_cargo || null,
        empresa: data.empresa || data.nome_fantasia || null,
        foto: data.foto_perfil || null,
      };
    },
    enabled: !!routeMembroId && canViewRequestedAura,
  });

  const { data: viewedAura } = useQuery<AuraResult>({
    queryKey: ["/api/aura/score", viewedMembroId],
    queryFn: async () => fixMojibakeDeep(await fetch(`/api/aura/score/${viewedMembroId}`, { credentials: "include" }).then(res => res.json())),
    enabled: canViewRequestedAura,
  });

  const { data: lexico = [] } = useQuery<string[]>({
    queryKey: ["/api/aura/lexico"],
    queryFn: async () => fixMojibakeDeep(await fetch("/api/aura/lexico", { credentials: "include" }).then(res => res.json())),
  });

  const { data: minhasAvaliacoesData } = useQuery<MinhasAvaliacoesResponse>({
    queryKey: ["/api/aura/minhas-avaliacoes"],
    queryFn: async () => fixMojibakeDeep(await fetch("/api/aura/minhas-avaliacoes", { credentials: "include" }).then(res => res.json())),
    enabled: !!myId,
  });
  const minhasAvaliacoesDadas: MinhaAvaliacao[] = minhasAvaliacoesData?.dadas ?? [];
  const minhasAvaliacoesRecebidas: MinhaAvaliacao[] = minhasAvaliacoesData?.recebidas ?? [];
  const evolucaoDados = useMemo(() => isOwnAura ? calcularEvolucao(minhasAvaliacoesRecebidas) : [], [isOwnAura, minhasAvaliacoesRecebidas]);

  const { data: minhasComunidadesAura = [] } = useQuery<any[]>({
    queryKey: ["/api/comunidades", { membro_id: myId, scope: "aura-registro" }],
    queryFn: async () => {
      const res = await fetch(`/api/comunidades?membro_id=${myId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!myId && canConsultAura,
  });

  const { data: minhasBiasAura = [] } = useQuery<any[]>({
    queryKey: ["/api/bias", "aura-registro"],
    queryFn: async () => {
      const res = await fetch("/api/bias", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!myId && canConsultAura,
  });

  const { data: vinculosAuraServidor = [] } = useQuery<string[]>({
    queryKey: ["/api/aura/vinculos", myId],
    queryFn: async () => {
      const res = await fetch("/api/aura/vinculos", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.ids) ? data.ids.map(String) : [];
    },
    enabled: !!myId && canConsultAura,
  });

  const auraLinkedMemberIds = useMemo(() => {
    const linkedIds = getAuraLinkedMemberIds({
      comunidades: minhasComunidadesAura,
      bias: minhasBiasAura,
      currentMemberId: myId,
    });
    for (const id of vinculosAuraServidor) linkedIds.add(String(id));
    return linkedIds;
  }, [minhasComunidadesAura, minhasBiasAura, myId, vinculosAuraServidor]);

  const memberSearchTerm = searchQuery.trim();
  const memberSearchActive = memberSearchTerm.length >= 2;
  const lookupSearchTerm = lookupQuery.trim();
  const auraSearchTerm = lookupOpen ? lookupSearchTerm : memberSearchActive ? memberSearchTerm : "";

  const { data: allMembros = [], isLoading: loadingSearch } = useQuery<MembroBusca[]>({
    queryKey: ["/api/aura/membros/busca", auraSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (auraSearchTerm.length >= 2) params.set("q", auraSearchTerm);
      const url = `/api/aura/membros/busca${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      const data: MembroBusca[] = await res.json();
      return fixMojibakeDeep(data);
    },
    enabled: !!myId && canConsultAura,
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

  const searchResults = memberSearchActive ? allMembros
    .filter(m => m.id !== myId)
    .filter(m => {
      const q = memberSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const nome = (m.nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const empresa = (m.empresa || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nome.includes(q) || empresa.includes(q);
    })
    .slice(0, 12) : [];
  const lookupResults = useMemo(() => {
    const q = lookupSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return allMembros
      .filter(m => m.id !== myId)
      .filter(m => {
        if (!q) return true;
        const nome = (m.nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const empresa = (m.empresa || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cargo = (m.cargo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(q) || empresa.includes(q) || cargo.includes(q);
      })
      .slice(0, 20);
  }, [allMembros, lookupSearchTerm, myId]);

  function abrirAuraDoMembro(membro: MembroBusca) {
    setLookupOpen(false);
    setLookupQuery("");
    setSelectedMembro(membro);
    setSelectedPalavras([]);
    setSearchQuery("");
    setLocation(`/aura/${membro.id}`);
  }

  const targetRegisterMemberId = selectedMembro?.id || (!isOwnAura ? viewedMembroId : null);
  const canRegisterSelectedAura = canRegisterAuraForMember({
    user,
    targetMemberId: targetRegisterMemberId,
    linkedMemberIds: auraLinkedMemberIds,
  });

  const { data: minhaAvaliacaoDoSelecionado } = useQuery<AvaliacaoExistente | null>({
    queryKey: ["/api/aura/avaliacao", targetRegisterMemberId],
    queryFn: async () => {
      const res = await fetch(`/api/aura/avaliacao/${targetRegisterMemberId}`, { credentials: "include" });
      if (!res.ok) return null;
      return fixMojibakeDeep(await res.json());
    },
    enabled: !!targetRegisterMemberId && canRegisterSelectedAura,
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
      if (selectedMembro?.id) form.append("avaliado_membro_id", selectedMembro.id);
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

  const transcreverAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("audio", file);
      if (selectedMembro?.id) form.append("avaliado_membro_id", selectedMembro.id);
      const res = await fetch("/api/aura/transcrever-audio", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao transcrever áudio." }));
        throw new Error(err.error || "Erro ao transcrever áudio.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: (data) => {
      setTextoIA(prev => prev ? prev + "\n\n" + data.texto : data.texto);
      toast({ title: "Áudio transcrito!", description: "A transcrição foi adicionada ao campo abaixo." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro no áudio", description: err.message, variant: "destructive" });
    },
  });

  const analisarMutation = useMutation({
    mutationFn: async ({ texto, membro_nome }: { texto: string; membro_nome: string }) => {
      const res = await apiRequest("POST", "/api/aura/analisar-texto", {
        texto,
        membro_nome,
        avaliado_membro_id: selectedMembro?.id,
      });
      return res.json() as Promise<{ palavras: string[] }>;
    },
    onSuccess: (data) => {
      if (data.palavras.length === 0) {
        toast({ title: "Nenhum termo identificado", description: "Tente descrever mais detalhadamente as características do membro.", variant: "destructive" });
        return;
      }
      setSelectedPalavras(data.palavras);
      setEvalMode("palavras");
      toast({ title: "IA identificou os termos!", description: `Sugestão: ${data.palavras.join(", ")}. Você pode ajustar antes de enviar.` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro na análise", description: err.message || "Não foi possível analisar o texto.", variant: "destructive" });
    },
  });

  const sugestoesFiltradas = useMemo(() => {
    if (!palavraInput || palavraInput.trim().length < 2) return [];
    const norm = palavraInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const seen = new Set<string>();
    return lexico.filter(p => {
      const pn = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!pn.includes(norm) || selectedPalavras.includes(p)) return false;
      const key = normalizeAuraSuggestionKey(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [palavraInput, lexico, selectedPalavras]);

  function togglePalavra(p: string) {
    setSelectedPalavras(prev => {
      if (prev.includes(p)) return prev.filter(x => x !== p);
      if (prev.length >= 3) {
        toast({ title: "Máximo de 3 termos", description: "Remova um para adicionar outro.", variant: "destructive" });
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
  const palavrasPositivas = palavrasRecebidas.filter((p) => (p.polaridade || "positiva") === "positiva");
  const pontosAtencaoReputacional = viewedAura?.pontos_atencao_reputacional ?? [];
  const viewedName = isOwnAura ? (user?.nome || user?.username || "Membro BUILT") : (viewedMembro?.nome || "Membro BUILT");
  const viewedEmail = isOwnAura ? user?.email : "";
  const viewedFoto = isOwnAura ? user?.foto_perfil : viewedMembro?.foto;
  const confiancaAura = viewedAura?.confianca || (n === 0 ? "Sem base reputacional" : n >= 10 ? "Confiança Consolidada" : n >= 5 ? "Confiança Validada" : n >= 2 ? "Confiança em Validação" : "Confiança Inicial");
  const confiancaDescricao = viewedAura?.confianca_descricao || (n === 0 ? "Aguardando primeira avaliação" : n >= 10 ? "Alta maturidade estatística" : n >= 5 ? "Base adequada para decisões operacionais" : n >= 2 ? "Percepção em formação" : "Primeira leitura reputacional");
  const amplitudeReputacional = viewedAura?.amplitude_reputacional ?? { T: 0, R: 0, C: 0 };
  const convergenciaReputacional = viewedAura?.convergencia_reputacional ?? { T: 0, R: 0, C: 0 };
  const dimensoesSemEvidencia = viewedAura?.dimensoes_sem_evidencia ?? [];
  const coberturaDimensional = viewedAura?.cobertura_dimensional ?? 0;
  const dimensoesAura = [
    {
      dim: "T" as const,
      label: "Técnica",
      peso: 40,
      pontuacao: Math.round(T),
      amplitude: amplitudeReputacional.T,
      convergencia: convergenciaReputacional.T,
      semEvidencia: dimensoesSemEvidencia.includes("T"),
      descricao: "Capacidade de entrega, método e eficiência técnica.",
    },
    {
      dim: "R" as const,
      label: "Relacional",
      peso: 25,
      pontuacao: Math.round(R),
      amplitude: amplitudeReputacional.R,
      convergencia: convergenciaReputacional.R,
      semEvidencia: dimensoesSemEvidencia.includes("R"),
      descricao: "Capacidade de gerar confiança, colaboração e conexão.",
    },
    {
      dim: "C" as const,
      label: "Comportamental",
      peso: 35,
      pontuacao: Math.round(C),
      amplitude: amplitudeReputacional.C,
      convergencia: convergenciaReputacional.C,
      semEvidencia: dimensoesSemEvidencia.includes("C"),
      descricao: "Maturidade ética, consistência institucional e atitude.",
    },
  ];
  const palavrasValidas = viewedAura?.total_palavras ?? palavrasRecebidas.reduce((total, p) => total + p.count, 0);
  const topPalavra = palavrasPositivas[0] ?? palavrasRecebidas[0] ?? null;
  const convergenciasComEvidencia = dimensoesAura.filter((d) => !d.semEvidencia).map((d) => d.convergencia);
  const convergenciaMedia = convergenciasComEvidencia.length
    ? convergenciasComEvidencia.reduce((total, valor) => total + valor, 0) / convergenciasComEvidencia.length
    : 0;
  const convergencia = convergenciaMedia >= 70 ? "Alta" : convergenciaMedia >= 50 ? "Média" : "Em formação";
  const fatorRelevancia = score === null ? 0 : Math.max(viewedAura?.FR_T ?? 1, viewedAura?.FR_R ?? 1, viewedAura?.FR_C ?? 1);
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
  const convergenciaPorNucleo = useMemo<ConvergenciaNucleo[]>(() => {
    return NUCLEOS_APLICABILIDADE.map((nucleo) => {
      const evidencia = new Map<string, number>();
      palavrasPositivas.forEach((palavra) => {
        const normalized = normalizeAuraWord(palavra.canonico || palavra.palavra);
        const matched = nucleo.keywords.some((keyword) => keywordMatchesWord(keyword, normalized));
        if (!matched) return;
        evidencia.set(palavra.canonico, (evidencia.get(palavra.canonico) || 0) + Math.max(1, palavra.count || 1));
      });
      const evidenciasOrdenadas = Array.from(evidencia.entries()).sort((a, b) => b[1] - a[1]);
      const scoreNucleo = evidenciasOrdenadas.reduce((total, [, count]) => total + count, 0);
      const palavras = evidenciasOrdenadas.map(([palavra]) => palavra);
      return {
        nucleo: nucleo.nucleo,
        score: scoreNucleo,
        nivel: nivelConvergencia(scoreNucleo),
        palavras,
        justificativa: buildJustificativaNucleo(nucleo.nucleo, palavras),
      };
    }).sort((a, b) => b.score - a.score);
  }, [palavrasPositivas]);
  const convergenciaPrincipal = convergenciaPorNucleo[0];
  const convergenciaSecundaria = convergenciaPorNucleo.find((item) => item.nucleo !== convergenciaPrincipal?.nucleo && item.score > 0);
  const leituraAplicabilidade = score === null || n === 0
    ? "A leitura contextual ainda está em formação. Ela será exibida quando houver base reputacional suficiente para orientar aplicabilidade por núcleo."
    : `${viewedName} apresenta ${faixaDescricao(score)}, com convergência predominante para o Núcleo ${convergenciaPrincipal?.nucleo || "em formação"}${convergenciaSecundaria ? ` e convergência secundária para ${convergenciaSecundaria.nucleo}` : ""}. Os termos recebidos indicam força em ${convergenciaPrincipal?.palavras.slice(0, 5).join(", ").toLowerCase() || "percepções ainda iniciais"}. Essa combinação sugere boa aplicabilidade em ${NUCLEOS_APLICABILIDADE.find((item) => item.nucleo === convergenciaPrincipal?.nucleo)?.foco || "contextos a serem validados pela aliança"}. As dimensões com baixa convergência não indicam ausência de capacidade, mas sim que as avaliações atuais ainda não trouxeram sinais suficientes para esses papéis. Para responsabilidades críticas, recomenda-se atuação acompanhada ou nova validação após entregas reais.`;
  const aplicacaoRecomendada = getAplicacaoRecomendada(convergenciaPrincipal, convergenciaSecundaria);
  const matrizAplicabilidade = [
    {
      icon: CalendarDays,
      label: "Horizonte de Projeto",
      value: horizonteProjeto,
      color: "#22C55E",
      description: "Indica o prazo de projeto mais compatível com a Aura percebida, considerando o índice geral e as evidências disponíveis.",
    },
    {
      icon: BarChart3,
      label: "Nível de Responsabilidade",
      value: nivelResponsabilidade,
      color: "#3B82F6",
      description: "Estima o grau de responsabilidade recomendado a partir da consistência e da força das percepções recebidas.",
    },
    {
      icon: Handshake,
      label: "Tipo de Aliança Recomendada",
      value: nucleoMaisForte.dim === "T" ?"Técnica e liderança" : nucleoMaisForte.dim === "R" ?"Relacionamento e comunidade" : "Governança e liderança",
      color: "#D7BB7D",
      description: "Aponta o formato de colaboração mais aderente à dimensão predominante da Aura: Técnica, Relacional ou Comportamental.",
    },
    {
      icon: Users,
      label: "Compatibilidade Cultural",
      value: compatibilidadeCultural,
      color: "#22C55E",
      description: "Mostra o nível de convergência entre as percepções recebidas e os valores de colaboração da rede BUILT.",
    },
    {
      icon: Target,
      label: "Cobertura Dimensional",
      value: `${coberturaDimensional}%`,
      color: "#005BFF",
      description: "Percentual das dimensões Técnica, Relacional e Comportamental que possuem evidências nas avaliações recebidas.",
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D7BB7D]" />
          Aura Percebida
        </h1>
        <p className="text-sm text-muted-foreground">
          Reputação construída pela percepção da comunidade sobre você.
        </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {myId && (
            <Button
              type="button"
              onClick={handleConsultAndRegisterAura}
              className="w-full gap-2 border border-[#005BFF] bg-[#005BFF] text-white shadow-sm hover:bg-[#004FE0] hover:text-white sm:w-auto"
              data-testid="btn-consultar-registrar-aura"
            >
              <Sparkles className="w-4 h-4" />
              Consultar e registrar Aura
            </Button>
          )}
          {myId && canConsultAura && !isOwnAura && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/aura")}
              className="w-full sm:w-auto"
              data-testid="btn-voltar-minha-aura"
            >
              <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
              Minha Aura
            </Button>
          )}
        </div>
      </div>

      <EnvironmentAccessDialog
        access={blockedAccess}
        open={!!blockedAccess}
        onOpenChange={(open) => !open && setBlockedAccess(null)}
      />

      {canConsultAura && (
      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Consultar e registrar Aura</DialogTitle>
            <DialogDescription>
              Selecione um membro para abrir a Aura da pessoa e registrar sua percepção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                value={lookupQuery}
                onChange={e => setLookupQuery(e.target.value)}
                placeholder="Buscar por nome, empresa ou cargo..."
                className="pl-9"
                data-testid="input-consultar-aura-membro"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border/60">
              {loadingSearch ? (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : lookupResults.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhum membro encontrado.</p>
              ) : (
                lookupResults.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => abrirAuraDoMembro(m)}
                    className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/70 border-b border-border/50 last:border-0"
                    data-testid={`btn-consultar-aura-membro-${m.id}`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold bg-[#001D34]/10 text-[#D7BB7D] shrink-0">
                      <AvatarImage foto={m.foto} nome={m.nome} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{m.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{[m.cargo, m.empresa].filter(Boolean).join(" · ") || "Membro BUILT"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {canViewRequestedAura && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4" data-testid="section-aura-dashboard">
          <Card className="border border-border/60 xl:col-span-4 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(0,29,52,0.04), rgba(215,187,125,0.04))" }}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-[#001D34]/10 text-[#D7BB7D] text-lg font-bold shrink-0">
                  {viewedFoto ? (
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
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-border/50 p-3">
                      <Users className="w-4 h-4 text-[#D7BB7D] mb-1" />
                      <strong className="text-foreground">{n}</strong>
                      <p className="text-xs text-muted-foreground">avaliadores</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <Tags className="w-4 h-4 text-[#D7BB7D] mb-1" />
                      <strong className="text-foreground">{palavrasValidas}</strong>
                      <p className="text-xs text-muted-foreground">termos válidos</p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <Target className="w-4 h-4 text-[#005BFF] mb-1" />
                      <strong className="text-foreground">{coberturaDimensional}%</strong>
                      <p className="text-xs text-muted-foreground">cobertura</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-blue-600">Confiança da Aura</p>
                    <p className="text-sm font-semibold text-foreground">{confiancaAura}</p>
                    <p className="text-[11px] text-muted-foreground">{confiancaDescricao}</p>
                  </div>
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

          {(dimensoesSemEvidencia.length > 0 || (viewedAura?.motivos_trava?.length ?? 0) > 0) && (
            <Card className="border border-amber-200 bg-amber-50/40 xl:col-span-12">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-amber-900">Cobertura e travas da Aura</p>
                    {dimensoesSemEvidencia.length > 0 && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Dimensão sem evidência não representa fraqueza automática, mas lacuna reputacional. A leitura técnica considera apenas as dimensões avaliadas, enquanto a Aura Percebida BUILT respeita a Cobertura Dimensional, o Grau de Confiança e as travas de proteção da rede BUILT.
                      </p>
                    )}
                    {(viewedAura?.motivos_trava ?? []).map((motivo) => (
                      <p key={motivo} className="text-xs text-amber-800">{motivo}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                    <p className="text-[10px] text-muted-foreground">
                      {d.semEvidencia
                        ? "Sem evidência"
                        : `Amplitude ${d.amplitude} · Convergência ${Math.round(d.convergencia)}%`}
                    </p>
                  </div>
                  <strong className="text-lg text-right text-foreground">{d.semEvidencia ? "—" : d.pontuacao}</strong>
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
                {palavrasPositivas.length > 0 ? palavrasPositivas.slice(0, 8).map(p => (
                  <span
                    key={p.canonico}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium"
                    style={{ color: dimColor(p.dimensao), borderColor: `${dimColor(p.dimensao)}45`, background: `${dimColor(p.dimensao)}10` }}
                  >
                    {p.canonico}
                  </span>
                )) : (
                  <p className="text-sm text-muted-foreground">As percepções positivas aparecerão conforme a comunidade avaliar você.</p>
                )}
              </div>
              <div className="rounded-xl border border-border/50 p-4 bg-background/40 min-h-[140px]">
                {topPalavra ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: dimColor(topPalavra.dimensao) }}>{topPalavra.canonico}</p>
                    <p className="text-xs text-muted-foreground">Dimensão: <span className="text-foreground">{dimLabel(topPalavra.dimensao)}</span></p>
                    <p className="text-xs text-muted-foreground">Frequência: <span className="text-foreground">{topPalavra.count}</span> ocorrência{topPalavra.count !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Evidência contextual: citada em avaliações recebidas da rede BUILT.</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground">
                    Sem termos recebidos ainda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {pontosAtencaoReputacional.length > 0 && (
            <Card className="border border-amber-200 bg-amber-50/40 xl:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Pontos de Atenção Reputacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pontosAtencaoReputacional.slice(0, 4).map((ponto) => (
                  <div key={`${ponto.canonico}-${ponto.status}`} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{ponto.canonico}</p>
                        <p className="text-xs text-muted-foreground">
                          {dimLabel(ponto.dimensao)} · afeta {ponto.valor_afetado}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100 text-amber-800">
                        {ponto.gravidade === "critica" ? "Curadoria" : `-${ponto.impacto.toString().replace(".", ",")}`}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{ponto.recomendacao}</p>
                    <p className="mt-2 text-[11px] font-medium text-amber-800">
                      {ponto.status === "em_curadoria_reputacional" ? "Em curadoria reputacional" : "Considerado no cálculo"}
                    </p>
                  </div>
                ))}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Termos negativos reduzem a Aura quando vinculados a antônimos reputacionais reconhecidos. Termos críticos exigem validação humana antes de impacto automático.
                </p>
              </CardContent>
            </Card>
          )}

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
            <TooltipProvider delayDuration={150}>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matrizAplicabilidade.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl border border-border/50 p-3 bg-background/40">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                        <UiTooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`O que significa ${item.label}`}
                              data-testid={`info-matriz-${item.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                            {item.description}
                          </TooltipContent>
                        </UiTooltip>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  );
                })}
              </CardContent>
            </TooltipProvider>
          </Card>

          <Card className="border border-border/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D7BB7D]" />
                Convergência de Aplicabilidade por Núcleo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {convergenciaPorNucleo.map((item) => {
                  const nivelColor =
                    item.nivel === "Alta" ? "#16A34A" :
                    item.nivel === "Média/Alta" ? "#3B82F6" :
                    item.nivel === "Baixa/Média" ? "#D7BB7D" :
                    "#64748B";
                  return (
                    <div key={item.nucleo} className="rounded-lg border border-border/50 p-3 bg-background/40" data-testid={`convergencia-nucleo-${item.nucleo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{item.nucleo}</p>
                        <Badge variant="outline" className="text-[11px]" style={{ color: nivelColor, borderColor: `${nivelColor}55`, background: `${nivelColor}12` }}>
                          {item.nivel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{item.justificativa}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {leituraAplicabilidade}
              </p>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-600">Aplicação recomendada</p>
                <p className="mt-1 text-sm font-medium text-foreground leading-relaxed">{aplicacaoRecomendada}</p>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                Essa leitura não altera o score da Aura; ela orienta onde a percepção recebida parece ter maior aplicabilidade prática dentro da BUILT.
              </p>
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
              {evolucaoDados.length === 0 ? (
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
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Percepção recebida
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
      {myId && routeMembroId && routeMembroId !== myId && canViewRequestedAura && (
        <Card className="border border-border/60" data-testid="card-avaliar">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D7BB7D]" />
              {routeMembroId && routeMembroId !== myId ? `Registrar Aura de ${viewedName}` : "Avaliar um Membro"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canRegisterSelectedAura ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <p className="font-semibold">Registro restrito a vínculos BUILT</p>
                  <p className="text-amber-800/80">
                    Você pode consultar esta Aura, mas só pode registrar percepção para pessoas vinculadas à sua BIA ou Comunidade.
                  </p>
                </div>
              </div>
            ) : !selectedMembro ? (
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
                    {!memberSearchActive ? (
                      <p className="text-xs text-muted-foreground p-2">Digite pelo menos 2 letras para buscar.</p>
                    ) : loadingSearch ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      ))
                    ) : searchResults.length === 0 ? (
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
                      ?
                      { background: "rgba(215,187,125,0.18)", color: "#b8962e", borderRight: "1px solid rgba(215,187,125,0.2)" }
                      : { color: "#64748b", borderRight: "1px solid rgba(0,0,0,0.08)" }}
                    onClick={() => setEvalMode("palavras")}
                    data-testid="btn-modo-palavras"
                  >
                    <Tags className="w-3.5 h-3.5" />
                    Escolher termos
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 transition-all font-semibold"
                    style={evalMode === "texto"
                      ?
                      { background: "rgba(215,187,125,0.18)", color: "#b8962e" }
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
                        Descreva as características de <strong className="text-foreground">{selectedMembro.nome}</strong> e a IA escolherá os termos mais adequados
                      </label>
                      <button
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border/50 text-muted-foreground hover:border-[#D7BB7D]/50 hover:text-[#D7BB7D] transition-colors shrink-0 ml-3"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={extrairArquivoMutation.isPending || transcreverAudioMutation.isPending}
                        data-testid="btn-anexar-arquivo"
                        title="Anexar PDF, TXT, CSV ou áudio"
                      >
                        {extrairArquivoMutation.isPending || transcreverAudioMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5" />
                        )}
                        {extrairArquivoMutation.isPending ? "Lendo..." : transcreverAudioMutation.isPending ? "Transcrevendo..." : "Anexar arquivo"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md,.csv,.mp3,.m4a,.wav,.ogg,.oga,.opus,.webm,.aac,.3gp,.amr,text/plain,application/pdf,audio/*"
                        className="hidden"
                        data-testid="input-arquivo"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setArquivoNome(file.name);
                            const name = file.name.toLowerCase();
                            const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|3gp|amr)$/i.test(name);
                            if (isAudio) transcreverAudioMutation.mutate(file);
                            else extrairArquivoMutation.mutate(file);
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
                    Digite para buscar até 3 palavras ou expressões que descrevem este membro
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
                        placeholder="Buscar palavra ou expressão..."
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
                      {showSugestoes && palavraInput.trim().length >= 2 && sugestoesFiltradas.length > 0 && (
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
      {isOwnAura && myId && minhasAvaliacoesDadas.length > 0 && (
        <div className="space-y-3" data-testid="section-minhas-avaliacoes">
          <button
            type="button"
            onClick={() => setShowAvaliacoesDadas(open => !open)}
            className="w-full flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-left"
            aria-expanded={showAvaliacoesDadas}
            data-testid="btn-toggle-avaliacoes-dadas"
          >
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#D7BB7D]" />
              Avaliações que você deu ({minhasAvaliacoesDadas.length})
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {showAvaliacoesDadas ? "Ocultar" : "Ver avaliações"}
              <ChevronRight className={`w-4 h-4 transition-transform ${showAvaliacoesDadas ? "rotate-90" : ""}`} />
            </span>
          </button>
          {showAvaliacoesDadas && (
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
                      {av.avaliado_nome || `Membro ${av.avaliado_membro_id.slice(0, 8)}...`}
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
          )}
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
            A Aura Percebida BUILT é o índice de validação reputacional da rede. Cada avaliação registra até 3 termos baseados em experiências reais; esses termos podem ser palavras ou expressões e são agrupados por cânone, dimensão, frequência entre avaliadores distintos e aderência ao DNA BUILT.
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
            <p>• Termos citados por 2-3 avaliadores distintos têm peso 1.5×; por 4 ou mais, peso 2.0×.</p>
            <p>• A pontuação-base de cada dimensão é calculada por <strong className="text-foreground">pontos positivos ÷ (pontos positivos + penalidades negativas validadas)</strong>.</p>
            <p>• Amplitude mede a variedade de atributos positivos; convergência mede a repetição desses atributos por avaliadores distintos. Diversidade positiva não reduz a Aura.</p>
            <p>• O cálculo aplica o <strong className="text-foreground">Fator de Relevância</strong>, que valoriza em até 20% as dimensões alinhadas ao DNA BUILT.</p>
            <p>• O índice publicado respeita a <strong className="text-foreground">Cobertura Dimensional</strong>, a <strong className="text-foreground">Confiança da Aura</strong> e as travas de proteção da Aura Suprema.</p>
            <p>• Cada par avaliador/avaliado registra uma avaliação única, sem alteração posterior.</p>
          </div>
        </CardContent>
      </Card>

      {myId && (
        <Card className="border border-border/60" data-testid="card-alertas-governanca">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, title: "Sem alertas ativos", desc: "Membro em conformidade com as políticas BUILT.", color: "#22C55E" },
              { icon: AlertTriangle, title: confiancaAura, desc: confiancaDescricao, color: "#D7BB7D" },
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



