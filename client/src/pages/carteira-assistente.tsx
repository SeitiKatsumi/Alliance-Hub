import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  FileSearch,
  FileText,
  House,
  Info,
  Loader2,
  MapPin,
  MessageSquareText,
  Mic,
  PencilLine,
  Search,
  Sparkles,
  StopCircle,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BrowserPermissionHelp } from "@/components/browser-permission-help";
import {
  createAudioMediaRecorder,
  formatRecordingTime,
  getAudioRecordingFilename,
} from "@/lib/audio-recording";

type JourneyStep = "cadastro" | "intencao" | "analise" | "conexao";
type JourneyMethod = "conversa" | "cartorio" | "documentos" | "manual";

type AssistantSession = {
  id: string;
  path: "imovel" | "oportunidade";
  method: JourneyMethod | null;
  step: JourneyStep | "concluido";
  status: string;
  draft: Record<string, any>;
  suggestions: Record<string, any>;
  confirmations: Record<string, any>;
  sources?: Array<{ tipo: JourneyMethod; nome: string; adicionado_em?: string }>;
};

type ProfessionalRecommendation = {
  id: string;
  user_id?: string | null;
  nome: string;
  cargo?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  especialidades: string[];
  aderencia: number;
  nivel_aderencia?: "alta" | "boa" | "parcial";
  especialidades_aderentes?: string[];
  motivos: string[];
};

type RecommendationResponse = {
  recomendacoes: ProfessionalRecommendation[];
  calculo?: {
    descricao?: string;
    criterios?: Array<{ nome: string; peso_maximo: number }>;
  };
};

const STEPS: Array<{ id: JourneyStep; label: string }> = [
  { id: "intencao", label: "Intenção" },
  { id: "cadastro", label: "Cadastro" },
  { id: "analise", label: "Análise" },
  { id: "conexao", label: "Conexão" },
];

const METHODS: Array<{ id: JourneyMethod; title: string; description: string; icon: typeof MessageSquareText }> = [
  { id: "conversa", title: "Conversar com a IA", description: "Conte por texto ou voz o que você já sabe.", icon: MessageSquareText },
  { id: "cartorio", title: "Enviar matrícula", description: "A IA extrai os dados para sua revisão.", icon: FileSearch },
  { id: "documentos", title: "Fotos e documentos", description: "Use imagens, certidões ou outros arquivos.", icon: Camera },
  { id: "manual", title: "Preencher manualmente", description: "Cadastre diretamente os dados essenciais.", icon: PencilLine },
];

const INTENTS = [
  ["gerir", "Apenas cadastrar e gerir"],
  ["vender", "Vender"],
  ["alugar", "Alugar"],
  ["reformar", "Reformar"],
  ["construir", "Construir"],
  ["regularizar", "Regularizar"],
  ["estruturar_alianca", "Estruturar uma Aliança BUILT"],
] as const;

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome ou identificação",
  tipo: "Tipo",
  area_m2: "Área",
  valor_atual: "Valor atual",
  cep: "CEP",
  endereco: "Endereço",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado",
  pais: "País",
  matricula: "Matrícula",
  cartorio: "Cartório",
  descricao: "Descrição",
};

function fetchJson(url: string) {
  return fetch(url, { credentials: "include", cache: "no-store" }).then(async (response) => {
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Não foi possível carregar esta etapa.");
    return json;
  });
}

export default function CarteiraAssistentePage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session") || "";
  const path = params.get("path") === "oportunidade" ? "oportunidade" : "imovel";
  const requestedStep = (params.get("step") || "intencao") as JourneyStep;
  const [method, setMethod] = useState<JourneyMethod | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({ pais: "Brasil", moeda: "BRL" });
  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedAudioReady, setRecordedAudioReady] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micPermissionHelpOpen, setMicPermissionHelpOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);

  const sessionQuery = useQuery<AssistantSession>({
    queryKey: ["/api/carteira/assistente/sessoes", sessionId],
    queryFn: () => fetchJson(`/api/carteira/assistente/sessoes/${sessionId}`),
    enabled: Boolean(sessionId),
  });
  const session = sessionQuery.data;
  const step: JourneyStep = STEPS.some((item) => item.id === requestedStep)
    ? requestedStep
    : (session?.step === "concluido" ? "conexao" : session?.step || "intencao");

  useEffect(() => {
    if (!session) return;
    setMethod(session.method || null);
    setDraft({ pais: "Brasil", moeda: "BRL", ...(session.draft || {}) });
    setSelectedMembers(Array.isArray(session.draft?.profissionais_recomendados) ? session.draft.profissionais_recomendados.map(String) : []);
  }, [session?.id]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function clearRecordingTimer() {
    if (!recordingTimerRef.current) return;
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setMicBlocked(true);
        setMicPermissionHelpOpen(true);
        toast({
          title: "Gravação indisponível",
          description: "Este navegador não permite gravar aqui. Você ainda pode enviar um arquivo de áudio.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createAudioMediaRecorder(stream);
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setRecordedDuration(0);
      setRecordedAudioReady(false);
      setFile(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearRecordingTimer();
        stream.getTracks().forEach((track) => track.stop());
        const recordedMimeType = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        const duration = recordingSecondsRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        audioStreamRef.current = null;
        setRecording(false);
        setRecordedDuration(duration);
        if (blob.size > 0) {
          setFile(new File(
            [blob],
            getAudioRecordingFilename(recordedMimeType, "cadastro-imovel"),
            { type: recordedMimeType },
          ));
          setRecordedAudioReady(true);
          toast({ title: "Áudio pronto", description: "Agora você pode gerar a prévia editável." });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setMicBlocked(false);
      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= 300) stopRecording();
      }, 1000);
    } catch (error: any) {
      clearRecordingTimer();
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      const permissionDenied = error?.name === "NotAllowedError" || /permission|denied|permiss/i.test(error?.message || "");
      if (permissionDenied) {
        setMicBlocked(true);
        setMicPermissionHelpOpen(true);
      }
      toast({
        title: permissionDenied ? "Microfone bloqueado" : "Não foi possível gravar",
        description: permissionDenied
          ? "Libere o microfone nas configurações do navegador ou envie um arquivo de áudio."
          : error?.message || "Tente novamente ou envie um arquivo de áudio.",
        variant: "destructive",
      });
    }
  }

  function requestRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    if (micBlocked) {
      setMicPermissionHelpOpen(true);
      return;
    }
    void startRecording();
  }

  function setJourneyUrl(next: { session?: string; step?: JourneyStep; path?: "imovel" | "oportunidade" }) {
    const query = new URLSearchParams(search);
    query.set("path", next.path || path);
    if (next.session || sessionId) query.set("session", next.session || sessionId);
    query.set("step", next.step || step);
    navigate(`/carteira/novo?${query.toString()}`);
  }

  async function leaveJourney() {
    if (sessionId) {
      window.sessionStorage.setItem(`built-property-journey-dismissed:${sessionId}`, "1");
      await fetch(`/api/carteira/assistente/sessoes/${sessionId}/pausar`, {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/onboarding-status"] });
    }
    navigate("/?tab=carteira&view=imoveis");
  }

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/carteira/assistente/sessoes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, intencao: draft.intencao, draft }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível iniciar.");
      return json as AssistantSession;
    },
    onSuccess: (created) => setJourneyUrl({ session: created.id, step: "cadastro", path: created.path }),
    onError: (error: Error) => toast({ title: "Não foi possível iniciar", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ nextStep, payload }: { nextStep: JourneyStep; payload?: Record<string, any> }) => {
      const response = await fetch(`/api/carteira/assistente/sessoes/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, draft, ...(payload || {}) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível salvar a etapa.");
      return json as AssistantSession;
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(["/api/carteira/assistente/sessoes", sessionId], updated);
      setJourneyUrl({ step: variables.nextStep });
    },
    onError: (error: Error) => toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }),
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (file) form.append("file", file);
      if (sourceText.trim()) form.append("texto", sourceText.trim());
      if (method) form.append("source_type", method);
      form.append("draft", JSON.stringify(draft));
      const response = await fetch(`/api/carteira/assistente/sessoes/${sessionId}/analisar`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "A análise não pôde ser concluída.");
      return json as AssistantSession;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/carteira/assistente/sessoes", sessionId], updated);
      setDraft({ pais: "Brasil", moeda: "BRL", ...(updated.draft || {}) });
      setFile(null);
      setRecordedAudioReady(false);
      setRecordedDuration(0);
      setSourceText("");
      toast({ title: "Prévia gerada", description: "Revise os dados antes de continuar." });
    },
    onError: (error: Error) => toast({ title: "Não foi possível analisar", description: error.message, variant: "destructive" }),
  });

  const recommendationsQuery = useQuery<RecommendationResponse>({
    queryKey: ["/api/carteira/assistente/recomendacoes", sessionId],
    queryFn: () => fetchJson(`/api/carteira/assistente/sessoes/${sessionId}/recomendacoes`),
    enabled: Boolean(sessionId && step === "conexao"),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/carteira/assistente/sessoes/${sessionId}/concluir`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmado: true, draft: { ...draft, profissionais_recomendados: selectedMembers } }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível concluir o cadastro.");
      return json;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carteira/resumo"] });
      navigate(result.url || "/?tab=carteira");
    },
    onError: (error: Error) => toast({ title: "Não foi possível concluir", description: error.message, variant: "destructive" }),
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ field, useExtracted }: { field: string; useExtracted: boolean }) => {
      const conflict = session?.suggestions?.conflitos?.[field];
      const nextDraft = useExtracted ? { ...draft, [field]: conflict?.extraido } : draft;
      const remainingConflicts = { ...(session?.suggestions?.conflitos || {}) };
      delete remainingConflicts[field];
      const response = await fetch(`/api/carteira/assistente/sessoes/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: nextDraft,
          suggestions: { conflitos: remainingConflicts },
          confirmations: { [`conflito_${field}`]: useExtracted ? "extraido" : "atual" },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível registrar sua escolha.");
      return json as AssistantSession;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/carteira/assistente/sessoes", sessionId], updated);
      setDraft({ pais: "Brasil", moeda: "BRL", ...(updated.draft || {}) });
    },
    onError: (error: Error) => toast({ title: "Não foi possível revisar o campo", description: error.message, variant: "destructive" }),
  });

  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const isAnalyzable = !recording && Boolean(file || sourceText.trim());
  const suggestions = session?.suggestions || {};
  const conflicts = suggestions.conflitos && typeof suggestions.conflitos === "object" ? suggestions.conflitos : {};
  const recommendations = recommendationsQuery.data?.recomendacoes || [];
  const sourceAccept = method === "cartorio"
    ? ".pdf,.png,.jpg,.jpeg,.webp"
    : method === "conversa"
      ? "audio/*"
      : "image/*,.pdf,.txt,.doc,.docx";

  const title = path === "oportunidade" ? "Cadastrar oportunidade identificada" : "Cadastrar meu imóvel";

  if (!sessionId) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">
        <button type="button" onClick={() => void leaveJourney()} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Voltar para Meus Imóveis
        </button>
        <header>
          <p className="text-xs font-semibold uppercase text-blue-600">Primeiro imóvel</p>
          <h1 className="mt-1 text-2xl font-bold text-[#001D34]">O que você deseja fazer?</h1>
          <p className="mt-1 text-sm text-slate-600">Escolha a relação com o imóvel e seu objetivo inicial.</p>
        </header>

        <nav className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50" aria-label="Etapas do cadastro">
          {STEPS.map((item, index) => (
            <span key={item.id} className={`grid min-h-12 place-items-center border-r border-slate-200 px-2 text-center text-xs font-semibold last:border-r-0 sm:text-sm ${index === 0 ? "bg-white text-blue-700" : "text-slate-400"}`}>
              {item.label}
            </span>
          ))}
        </nav>

        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setJourneyUrl({ path: "imovel", step: "intencao" })} className={`flex items-start gap-3 rounded-md border p-4 text-left ${path === "imovel" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <House className="mt-0.5 h-5 w-5 text-blue-600" />
            <span><strong className="block text-[#001D34]">É meu imóvel</strong><span className="mt-1 block text-sm text-slate-600">O ativo entrará em Meus Imóveis para gestão privada.</span></span>
          </button>
          <button type="button" onClick={() => setJourneyUrl({ path: "oportunidade", step: "intencao" })} className={`flex items-start gap-3 rounded-md border p-4 text-left ${path === "oportunidade" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <Building2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <span><strong className="block text-[#001D34]">Identifiquei uma oportunidade</strong><span className="mt-1 block text-sm text-slate-600">O registro será privado e você aparecerá como originador, não como proprietário.</span></span>
          </button>
        </div>

        <section>
          <h2 className="text-base font-semibold text-[#001D34]">Qual é o seu objetivo inicial?</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTENTS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDraft({ ...draft, intencao: value })} className={`min-h-16 rounded-md border px-4 text-left text-sm font-medium ${draft.intencao === value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:border-blue-300"}`}>
                {draft.intencao === value && <Check className="mr-2 inline h-4 w-4" />}{label}
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => startMutation.mutate()} disabled={!draft.intencao || startMutation.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
            {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Continuar para o cadastro
          </Button>
        </div>
      </main>
    );
  }

  if (sessionQuery.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;
  if (!session) return <div className="p-8 text-center text-slate-600">Esta jornada não foi encontrada.</div>;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={() => void leaveJourney()} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Sair do cadastro</button>
          <h1 className="text-2xl font-bold text-[#001D34]">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">Seu progresso fica salvo. Toda sugestão da IA pode ser revisada.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{INTENTS.find(([value]) => value === draft.intencao)?.[1] || "Cadastro em andamento"}</span>
      </header>

      <nav className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {STEPS.map((item, index) => (
          <button key={item.id} type="button" disabled={index > currentIndex} onClick={() => index <= currentIndex && setJourneyUrl({ step: item.id })} className={`min-h-12 border-r border-slate-200 px-2 text-xs font-semibold last:border-r-0 sm:text-sm ${item.id === step ? "bg-white text-blue-700" : index < currentIndex ? "text-emerald-700" : "text-slate-400"}`}>
            {index < currentIndex ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}{item.label}
          </button>
        ))}
      </nav>

      {step === "cadastro" && (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-[#001D34]">Adicione as informações que você já possui</h2>
              <p className="mt-1 text-sm text-slate-600">Use uma ou mais opções. Você pode voltar e complementar o cadastro a qualquer momento.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Fontes do cadastro">
              {METHODS.map((item) => {
                const Icon = item.icon;
                const selected = method === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    disabled={recording && item.id !== "conversa"}
                    onClick={() => {
                      setMethod(item.id);
                      if (item.id === "manual") window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    }}
                    className={`flex min-h-14 items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>
            {session.sources?.length ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Fontes adicionadas:</span>
                {session.sources.map((source, index) => (
                  <span key={`${source.tipo}-${source.nome}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                    <Check className="h-3.5 w-3.5" />{source.nome}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
              {!method ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-7 w-7 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-[#001D34]">Escolha uma fonte acima</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Ou preencha diretamente os dados ao lado.</p>
                </div>
              ) : method === "manual" ? (
                <div className="py-6 text-center">
                  <PencilLine className="mx-auto h-7 w-7 text-blue-600" />
                  <p className="mt-3 text-sm font-medium text-[#001D34]">Preenchimento manual</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Informe somente o que souber. Os demais campos poderão ser completados depois.</p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ir para os campos</Button>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="font-semibold text-[#001D34]">{METHODS.find((item) => item.id === method)?.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{METHODS.find((item) => item.id === method)?.description}</p>
                  </div>
                  {method === "conversa" && <Textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={7} placeholder="Ex.: Tenho um terreno em Campinas com aproximadamente 800 m²..." />}
                  <input
                    ref={fileRef}
                    className="hidden"
                    type="file"
                    accept={sourceAccept}
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] || null;
                      setFile(selectedFile);
                      setRecordedAudioReady(false);
                      setRecordedDuration(0);
                    }}
                  />
                  {method === "conversa" ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={requestRecording}
                          disabled={analyzeMutation.isPending}
                          className={recording ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" : ""}
                          data-testid="btn-gravar-audio-carteira"
                        >
                          {recording ? <StopCircle className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                          {recording ? "Parar e usar áudio" : recordedAudioReady ? "Gravar novamente" : "Falar agora"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileRef.current?.click()}
                          disabled={recording || analyzeMutation.isPending}
                          data-testid="btn-enviar-audio-carteira"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Enviar áudio
                        </Button>
                      </div>
                      {recording && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                          data-testid="status-gravando-audio-carteira"
                        >
                          <span className="relative flex h-3 w-3 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                          </span>
                          <span className="font-semibold">Gravando sua fala</span>
                          <span className="ml-auto tabular-nums">{formatRecordingTime(recordingSeconds)}</span>
                        </div>
                      )}
                      {!recording && file && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
                          <span className="font-semibold">{recordedAudioReady ? "Áudio gravado pronto" : "Arquivo de áudio selecionado"}</span>
                          <span className="mt-0.5 block break-all text-emerald-700/80">
                            {recordedAudioReady && recordedDuration > 0 ? `${formatRecordingTime(recordedDuration)} · ` : ""}{file.name}
                          </span>
                        </div>
                      )}
                      <p className="text-xs leading-5 text-slate-500">Você pode falar por até 5 minutos ou enviar uma gravação já existente.</p>
                    </>
                  ) : (
                    <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />{file ? file.name : "Escolher arquivo"}
                    </Button>
                  )}
                  <Button type="button" disabled={!isAnalyzable || analyzeMutation.isPending} onClick={() => analyzeMutation.mutate()} className="w-full bg-blue-600 text-white hover:bg-blue-700">{analyzeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Gerar prévia editável</Button>
                  <p className="text-xs leading-5 text-slate-500">A extração preenche apenas campos vazios. Qualquer divergência será apresentada para sua escolha.</p>
                </>
              )}
            </section>

            <section ref={formRef} className="scroll-mt-24 rounded-md border border-slate-200 bg-white p-5">
              <div className="mb-4"><h2 className="font-semibold text-[#001D34]">Revise os dados</h2><p className="mt-1 text-sm text-slate-600">Preencha somente o que souber agora.</p></div>
              {Object.keys(conflicts).length > 0 && (
                <div className="mb-5 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                  <div><h3 className="text-sm font-semibold text-amber-950">Informações diferentes encontradas</h3><p className="mt-1 text-xs text-amber-900/75">Escolha qual valor deve permanecer no cadastro.</p></div>
                  {Object.entries(conflicts).map(([field, conflict]: [string, any]) => (
                    <div key={field} className="rounded-md border border-amber-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700">{FIELD_LABELS[field] || field}</p>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <button type="button" disabled={resolveConflictMutation.isPending} onClick={() => resolveConflictMutation.mutate({ field, useExtracted: false })} className="rounded-md border border-blue-200 bg-blue-50 p-2 text-left text-blue-900"><span className="block text-[10px] font-semibold uppercase text-blue-600">Manter atual</span>{String(conflict.atual ?? "-")}</button>
                        <button type="button" disabled={resolveConflictMutation.isPending} onClick={() => resolveConflictMutation.mutate({ field, useExtracted: true })} className="rounded-md border border-slate-200 p-2 text-left text-slate-800"><span className="block text-[10px] font-semibold uppercase text-slate-500">Usar extraído</span>{String(conflict.extraido ?? "-")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Nome ou identificação *</Label><Input className="mt-1" value={draft.nome || ""} onChange={(event) => setDraft({ ...draft, nome: event.target.value })} placeholder={path === "imovel" ? "Apartamento Jardim..." : "Prédio comercial identificado..."} /></div>
              <div><Label>Tipo</Label><Input className="mt-1" value={draft.tipo || ""} onChange={(event) => setDraft({ ...draft, tipo: event.target.value })} placeholder="Terreno, casa, galpão..." /></div>
              <div><Label>Área (m²)</Label><Input className="mt-1" inputMode="decimal" value={draft.area_m2 || ""} onChange={(event) => setDraft({ ...draft, area_m2: event.target.value })} /></div>
              <div><Label>CEP</Label><Input className="mt-1" value={draft.cep || ""} onChange={(event) => setDraft({ ...draft, cep: event.target.value })} /></div>
              <div><Label>Cidade</Label><Input className="mt-1" value={draft.cidade || ""} onChange={(event) => setDraft({ ...draft, cidade: event.target.value })} /></div>
              <div><Label>Estado</Label><Input className="mt-1" value={draft.estado || ""} onChange={(event) => setDraft({ ...draft, estado: event.target.value })} /></div>
              <div><Label>País</Label><Input className="mt-1" value={draft.pais || "Brasil"} onChange={(event) => setDraft({ ...draft, pais: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Endereço</Label><Input className="mt-1" value={draft.endereco || ""} onChange={(event) => setDraft({ ...draft, endereco: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Descrição</Label><Textarea className="mt-1" value={draft.descricao || ""} onChange={(event) => setDraft({ ...draft, descricao: event.target.value })} /></div>
            </div>
            </section>
          </div>
        </div>
      )}

      {step === "intencao" && (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-[#001D34]">O que você deseja fazer?</h2>
          <p className="mt-1 text-sm text-slate-600">Essa escolha orienta a análise e pode ser alterada depois.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTENTS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDraft({ ...draft, intencao: value })} className={`min-h-16 rounded-md border px-4 text-left text-sm font-medium ${draft.intencao === value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 hover:border-blue-300"}`}>
                {draft.intencao === value && <Check className="mr-2 inline h-4 w-4" />}{label}
              </button>
            ))}
          </div>
          {draft.intencao === "estruturar_alianca" && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ao final, será preparada uma solicitação de estruturação. Nenhuma BIA será ativada automaticamente.</p>}
        </section>
      )}

      {step === "analise" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /><h2 className="font-semibold text-[#001D34]">Análise preliminar</h2></div>
            <Label className="mt-5 block">Resumo sugerido</Label>
            <Textarea className="mt-1" rows={6} value={draft.resumo_analise ?? suggestions.resumo ?? ""} onChange={(event) => setDraft({ ...draft, resumo_analise: event.target.value })} placeholder="Inclua o contexto e o objetivo do imóvel." />
            <Label className="mt-4 block">Especialidades sugeridas</Label>
            <Input className="mt-1" value={draft.especialidades_texto ?? (suggestions.especialidades || []).join(", ")} onChange={(event) => setDraft({ ...draft, especialidades_texto: event.target.value })} placeholder="Avaliação, arquitetura, engenharia..." />
          </section>
          <section className="rounded-md border border-blue-200 bg-blue-50 p-5">
            <h2 className="font-semibold text-blue-950">Estimativa de referência</h2>
            <p className="mt-1 text-sm text-blue-900/70">A faixa é editável e não representa proposta comercial.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_110px]">
              <div><Label>Mínimo</Label><Input className="mt-1 bg-white" inputMode="decimal" value={draft.estimativa_min ?? suggestions.estimativa?.min ?? ""} onChange={(event) => setDraft({ ...draft, estimativa_min: event.target.value })} /></div>
              <div><Label>Máximo</Label><Input className="mt-1 bg-white" inputMode="decimal" value={draft.estimativa_max ?? suggestions.estimativa?.max ?? ""} onChange={(event) => setDraft({ ...draft, estimativa_max: event.target.value })} /></div>
              <div><Label>Moeda</Label><Select value={draft.moeda || "BRL"} onValueChange={(value) => setDraft({ ...draft, moeda: value })}><SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BRL">BRL</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
            </div>
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-blue-900"><Checkbox checked={Boolean(draft.analise_revisada)} onCheckedChange={(checked) => setDraft({ ...draft, analise_revisada: checked === true })} /><span>Revisei esta análise e entendo que ela é apenas uma referência preliminar.</span></div>
          </section>
        </div>
      )}

      {step === "conexao" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-semibold text-[#001D34]"><Users className="h-5 w-5 text-blue-600" /> Conexões para o próximo passo</h2><p className="mt-1 text-sm text-slate-600">Veja profissionais cuja atuação combina com a necessidade informada. Selecionar alguém apenas guarda a indicação para depois.</p></div>
            {selectedMembers.length > 0 && <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{selectedMembers.length} {selectedMembers.length === 1 ? "indicação guardada" : "indicações guardadas"}</span>}
          </div>
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h3 className="font-semibold">O que significa a compatibilidade?</h3>
              <p className="mt-1 leading-6 text-blue-900/80">É uma estimativa formada pelas especialidades do profissional (até 70 pontos), localização (até 20) e vínculo/perfil BUILT (até 10). Não é uma avaliação de qualidade, garantia de contratação ou nota de Aura.</p>
            </div>
          </div>
          {recommendationsQuery.isLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div> : recommendations.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((item) => {
                const selected = selectedMembers.includes(item.id);
                const checkboxId = `professional-${item.id}`;
                return <article key={item.id} className={`rounded-md border p-4 transition-colors ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm text-[#001D34]">{item.nome}</strong><p className="mt-1 truncate text-xs text-slate-600">{[item.cargo, item.empresa].filter(Boolean).join(" · ") || "Profissional BUILT"}</p></div><span title="Compatibilidade estimada, não uma nota de qualidade" className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">{item.aderencia}% compatível</span></div>
                  <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{[item.cidade, item.estado].filter(Boolean).join(", ") || "Localização não informada"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{item.motivos.slice(0, 3).map((reason) => <span key={reason} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{reason}</span>)}</div>
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                    <Checkbox id={checkboxId} checked={selected} onCheckedChange={(checked) => setSelectedMembers((current) => checked === true ? Array.from(new Set([...current, item.id])) : current.filter((id) => id !== item.id))} />
                    <Label htmlFor={checkboxId} className="cursor-pointer text-xs font-medium text-slate-700">Guardar esta indicação</Label>
                  </div>
                </article>;
              })}
            </div>
          ) : <div className="rounded-md border border-dashed border-slate-300 px-5 py-12 text-center"><Search className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-medium text-[#001D34]">Nenhum perfil com especialidade compatível foi encontrado</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Você pode concluir o cadastro normalmente. Depois, complemente a análise ou crie uma Demanda para buscar o profissional certo na rede.</p></div>}
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">Esta etapa é opcional. Ninguém recebe acesso, mensagem ou solicitação agora; o contato só acontece quando você criar e confirmar uma Demanda.</p>
        </section>
      )}

      <footer className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <Button variant="outline" disabled={currentIndex === 0 || updateMutation.isPending || recording} onClick={() => setJourneyUrl({ step: STEPS[Math.max(0, currentIndex - 1)].id })}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        {step !== "conexao" ? (
          <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={recording || (step === "cadastro" && !String(draft.nome || "").trim()) || (step === "intencao" && !draft.intencao) || (step === "analise" && !draft.analise_revisada) || updateMutation.isPending} onClick={() => updateMutation.mutate({
            nextStep: STEPS[currentIndex + 1].id,
            payload: step === "intencao"
              ? { intencao: draft.intencao }
              : step === "cadastro"
                ? { method: method || "manual", source_type: method || "manual" }
                : undefined,
          })}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar e continuar<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={finishMutation.isPending} onClick={() => finishMutation.mutate()}>{finishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{selectedMembers.length ? `Concluir e guardar ${selectedMembers.length} ${selectedMembers.length === 1 ? "indicação" : "indicações"}` : "Concluir sem conexões"}</Button>
        )}
      </footer>

      <BrowserPermissionHelp
        open={micPermissionHelpOpen}
        onOpenChange={setMicPermissionHelpOpen}
        permission="microphone"
        blocked={micBlocked}
        onRetry={startRecording}
        fallbackLabel="Enviar áudio"
        onFallback={() => fileRef.current?.click()}
      />
    </main>
  );
}
