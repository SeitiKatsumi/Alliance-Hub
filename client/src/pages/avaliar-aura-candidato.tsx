import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Loader2, AlertCircle, Sparkles, X, CheckCircle2, Search, Bot, Paperclip, Mic, StopCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConviteData {
  id: string;
  token: string;
  status: string;
  candidato_nome?: string;
  candidato_email?: string;
  invitador_membro_id?: string;
  comunidade?: { id: string; nome?: string };
}

interface LexicoItem {
  canonico: string;
  dimensao?: "T" | "R" | "C";
}

type RawLexicoItem = string | (Partial<LexicoItem> & Record<string, unknown>);

const AURA_FALLBACK_LEXICO: LexicoItem[] = [
  { canonico: "Adaptabilidade", dimensao: "T" },
  { canonico: "Aliança", dimensao: "R" },
  { canonico: "Autenticidade", dimensao: "C" },
  { canonico: "Colaboração", dimensao: "R" },
  { canonico: "Comprometimento", dimensao: "C" },
  { canonico: "Comunicação", dimensao: "R" },
  { canonico: "Confiança", dimensao: "R" },
  { canonico: "Coragem", dimensao: "C" },
  { canonico: "Criatividade", dimensao: "T" },
  { canonico: "Disciplina", dimensao: "T" },
  { canonico: "Eficiência", dimensao: "T" },
  { canonico: "Empatia", dimensao: "R" },
  { canonico: "Entendimento", dimensao: "R" },
  { canonico: "Entusiasmo", dimensao: "C" },
  { canonico: "Equilíbrio", dimensao: "C" },
  { canonico: "Estabilidade", dimensao: "T" },
  { canonico: "Evolução", dimensao: "C" },
  { canonico: "Excelência", dimensao: "T" },
  { canonico: "Foco", dimensao: "T" },
  { canonico: "Generosidade", dimensao: "R" },
  { canonico: "Gratidão", dimensao: "C" },
  { canonico: "Honra", dimensao: "C" },
  { canonico: "Humildade", dimensao: "C" },
  { canonico: "Iniciativa", dimensao: "C" },
  { canonico: "Inovação", dimensao: "T" },
  { canonico: "Integridade", dimensao: "C" },
  { canonico: "Lealdade", dimensao: "R" },
  { canonico: "Liderança", dimensao: "C" },
  { canonico: "Organização", dimensao: "T" },
  { canonico: "Persistência", dimensao: "C" },
  { canonico: "Responsabilidade", dimensao: "T" },
  { canonico: "Transparência", dimensao: "C" },
  { canonico: "Visão", dimensao: "T" },
];

function extractLexicoWord(item: RawLexicoItem): string {
  if (typeof item === "string") return item.trim();
  return String(item.canonico || item.palavra || item.nome || item.label || item.termo || item.value || "").trim();
}

function extractLexicoDimension(item: RawLexicoItem): LexicoItem["dimensao"] {
  if (typeof item === "string") return undefined;
  const value = String(item.dimensao || "").toUpperCase();
  return value === "T" || value === "R" || value === "C" ? value : undefined;
}

const DIMENSAO_COLOR: Record<string, string> = {
  T: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  R: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  C: "text-purple-400 border-purple-500/30 bg-purple-500/10",
};

export default function AvaliarAuraCandidatoPage() {
  const { token } = useParams<{ token: string }>();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [evalMode, setEvalMode] = useState<"palavras" | "ia">("palavras");
  const [textoIA, setTextoIA] = useState("");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/avaliacao-aura", token],
    queryFn: () => fetch(`/api/avaliacao-aura/${token}`).then(r => {
      if (!r.ok) throw new Error("Link de avaliação inválido");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const { data: lexicoRaw = [] } = useQuery<RawLexicoItem[]>({
    queryKey: ["/api/aura/lexico"],
    queryFn: () => fetch("/api/aura/lexico").then(r => r.json()),
  });

  const lexico = useMemo<LexicoItem[]>(() => {
    const deduped = new Map<string, LexicoItem>();

    const rawItems = Array.isArray(lexicoRaw) ? lexicoRaw : [];
    for (const item of rawItems) {
      const canonico = extractLexicoWord(item);
      if (!canonico) continue;
      const key = canonico.toLocaleLowerCase("pt-BR");
      if (!deduped.has(key)) {
        deduped.set(key, { canonico, dimensao: extractLexicoDimension(item) });
      }
    }

    const items = Array.from(deduped.values());
    return items.length > 0 ? items : AURA_FALLBACK_LEXICO;
  }, [lexicoRaw]);

  const avaliarMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/avaliacao-aura/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palavras: selected }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao registrar avaliação");
      }
      return r.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: Error) => setPageError(err.message),
  });

  const extrairArquivoMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch(`/api/avaliacao-aura/${token}/extrair-arquivo`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao processar arquivo." }));
        throw new Error(err.error || "Erro ao processar arquivo.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: data => {
      setTextoIA(prev => prev ?prev + "\n\n" + data.texto : data.texto);
      setEvalMode("ia");
      setPageError(null);
    },
    onError: (err: Error) => setPageError(err.message),
  });

  const transcreverAudioMutation = useMutation({
    mutationFn: async ({ blob, filename = "percepcao-aura.webm" }: { blob: Blob; filename?: string }) => {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch(`/api/avaliacao-aura/${token}/transcrever-audio`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao transcrever áudio." }));
        throw new Error(err.error || "Erro ao transcrever áudio.");
      }
      return res.json() as Promise<{ texto: string }>;
    },
    onSuccess: data => {
      setTextoIA(prev => prev ?prev + "\n\n" + data.texto : data.texto);
      setEvalMode("ia");
      setPageError(null);
    },
    onError: (err: Error) => setPageError(err.message),
  });

  const analisarTextoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/avaliacao-aura/${token}/analisar-texto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoIA, membro_nome: convite?.candidato_nome }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro na análise com IA." }));
        throw new Error(err.error || "Erro na análise com IA.");
      }
      return res.json() as Promise<{ palavras: string[] }>;
    },
    onSuccess: data => {
      if (!data.palavras?.length) {
        setPageError("Nenhuma palavra identificada. Descreva com mais detalhes a reputação, confiança e forma de relacionamento.");
        return;
      }
      setSelected(data.palavras.slice(0, 3));
      setEvalMode("palavras");
      setPageError(null);
    },
    onError: (err: Error) => setPageError(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (error || !convite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Link inválido</h2>
          <p className="text-white/50 text-sm font-mono">Este link pode ter expirado ou já ter sido utilizado.</p>
        </div>
      </div>
    );
  }

  if (convite.status !== "aguardando_avaliacao_aura" && !submitted) {
    const already = ["candidato", "aprovado", "vitrine_ativo", "membro"].includes(convite.status);
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          {already
            ?<CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            : <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />}
          <h2 className="text-xl font-bold font-mono text-white">
            {already ?"Avaliação já registrada" : "Avaliação não disponível"}
          </h2>
          <p className="text-white/50 text-sm font-mono">
            {already
              ?"A avaliação de Aura para este candidato já foi registrada."
              : "Este link não está mais disponível para avaliação."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#001D34" }}>
        <div className="max-w-md w-full text-center space-y-6">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white">Percepção de Aura registrada!</h1>
            <p className="text-white/50 text-sm font-mono mt-2 leading-relaxed">
              Obrigado! O Aliado BUILT foi notificado e analisará a candidatura de{" "}
              <strong className="text-brand-gold">{convite.candidato_nome}</strong> em breve.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {selected.map(p => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-mono font-semibold border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filtered = lexico.filter(item =>
    search.length < 2 || item.canonico.toLowerCase().includes(search.toLowerCase())
  );

  const toggleWord = (word: string) => {
    setSelected(prev =>
      prev.includes(word)
        ?prev.filter(w => w !== word)
        : prev.length < 3
          ?[...prev, word]
          : prev
    );
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setPageError("Este navegador não permite gravação de áudio aqui. Use Enviar áudio para selecionar uma gravação.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        setRecording(false);
        if (blob.size > 0) {
          transcreverAudioMutation.mutate({ blob, filename: "percepcao-aura.webm" });
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setMicBlocked(false);
      setEvalMode("ia");
      setPageError(null);
    } catch (err: any) {
      const permissionDenied = err?.name === "NotAllowedError" || /permission|denied|permiss/i.test(err?.message || "");
      if (permissionDenied) setMicBlocked(true);
      setPageError(
        permissionDenied
          ? "Microfone bloqueado. Permita o microfone nas configurações do navegador ou use Enviar áudio para selecionar uma gravação do celular."
          : err?.message || "Não foi possível gravar. Verifique a permissão do microfone ou envie um áudio já gravado."
      );
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#001D34" }}>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Percepção de Aura</h1>
          <p className="text-white/50 text-sm font-mono mt-1">
            Como você percebe{" "}
            <strong className="text-brand-gold">{convite.candidato_nome}</strong>{" "}
            na rede BUILT?
          </p>
        </div>

        <div className="rounded-xl p-4 border border-brand-gold/20" style={{ background: "rgba(215,187,125,0.05)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <p className="text-xs font-mono text-brand-gold/80 font-semibold">Comunidade: {convite.comunidade?.nome}</p>
          </div>
          <p className="text-[11px] font-mono text-white/40">
            Escolha até <strong className="text-white/60">3 palavras</strong> do léxico BUILT que melhor descrevam as qualidades desta pessoa.
          </p>
        </div>

        {selected.length > 0 && (
          <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Selecionadas ({selected.length}/3)</p>
            <div className="flex flex-wrap gap-2">
              {selected.map(p => {
                const item = lexico.find(l => l.canonico === p);
                const dimensao = item?.dimensao || "C";
                return (
                  <button
                    key={p}
                    onClick={() => toggleWord(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all ${item ?DIMENSAO_COLOR[dimensao] : "text-brand-gold border-brand-gold/30 bg-brand-gold/10"}`}
                    data-testid={`chip-selecionada-${p}`}
                  >
                    {p}
                    <X className="w-3 h-3 opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="grid grid-cols-2">
            <button
              type="button"
              onClick={() => setEvalMode("palavras")}
              className="h-12 flex items-center justify-center gap-2 text-xs font-mono font-semibold transition-colors"
              style={evalMode === "palavras" ?{ background: "rgba(215,187,125,0.18)", color: "#D7BB7D" } : { color: "rgba(255,255,255,0.58)" }}
              data-testid="btn-modo-palavras-publico"
            >
              <Sparkles className="w-4 h-4" />
              Escolher palavras
            </button>
            <button
              type="button"
              onClick={() => setEvalMode("ia")}
              className="h-12 flex items-center justify-center gap-2 text-xs font-mono font-semibold transition-colors"
              style={evalMode === "ia" ?{ background: "rgba(215,187,125,0.18)", color: "#D7BB7D" } : { color: "rgba(255,255,255,0.58)" }}
              data-testid="btn-modo-ia-publico"
            >
              <Bot className="w-4 h-4" />
              Analisar com IA
            </button>
          </div>
        </div>

        {evalMode === "ia" && (
          <div className="space-y-4 rounded-xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-xs font-mono text-white/55">
              Descreva a sua percepção sobre essa pessoa, anexe um arquivo, grave ou envie um áudio.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extrairArquivoMutation.isPending}
                className="h-10 rounded-lg border border-white/10 text-white/65 text-xs font-mono flex items-center justify-center gap-2"
                data-testid="btn-anexar-publico"
              >
                <Paperclip className="w-4 h-4" />
                Anexar
              </button>
              <button
                type="button"
                onClick={() => recording ?stopRecording() : startRecording()}
                disabled={transcreverAudioMutation.isPending}
                className="h-10 rounded-lg border border-white/10 text-white/65 text-xs font-mono flex items-center justify-center gap-2"
                data-testid="btn-audio-publico"
                title={micBlocked ? "Microfone bloqueado. Use Enviar áudio para escolher uma gravação." : undefined}
              >
                {recording ?<StopCircle className="w-4 h-4 text-red-300" /> : <Mic className="w-4 h-4" />}
                {transcreverAudioMutation.isPending ?"Transcrevendo..." : recording ?"Parar" : "Gravar"}
              </button>
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                disabled={transcreverAudioMutation.isPending || recording}
                className="h-10 rounded-lg border border-white/10 text-white/65 text-xs font-mono flex items-center justify-center gap-2"
                data-testid="btn-enviar-audio-publico"
              >
                <Upload className="w-4 h-4" />
                Enviar áudio
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setArquivoNome(file.name);
                extrairArquivoMutation.mutate(file);
              }}
            />
            <input
              ref={audioFileInputRef}
              type="file"
              className="hidden"
              accept="audio/*,video/mp4,video/quicktime"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setArquivoNome(file.name);
                transcreverAudioMutation.mutate({ blob: file, filename: file.name });
              }}
            />
            {arquivoNome && (
              <div className="text-[11px] font-mono text-brand-gold/80 border border-brand-gold/20 rounded-lg px-3 py-2 truncate">
                {arquivoNome}
              </div>
            )}
            <textarea
              value={textoIA}
              onChange={event => setTextoIA(event.target.value)}
              placeholder={`Ex: ${convite.candidato_nome?.split(" ")[0] || "Esta pessoa"} demonstra confiança, entrega combinados, se relaciona bem e contribui para a comunidade...`}
              className="w-full min-h-[150px] rounded-lg px-3 py-3 text-sm font-mono resize-y outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(215,187,125,0.18)", color: "rgba(255,255,255,0.82)" }}
              data-testid="textarea-ia-publico"
            />
            <Button
              type="button"
              disabled={textoIA.trim().length < 10 || analisarTextoMutation.isPending}
              onClick={() => analisarTextoMutation.mutate()}
              className="w-full h-11 font-mono font-bold text-sm disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" }}
              data-testid="btn-analisar-ia-publico"
            >
              {analisarTextoMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Analisar com IA
            </Button>
          </div>
        )}

        {evalMode === "palavras" && (
          <>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(215,187,125,0.5)" }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar palavra no léxico..."
            className="pl-9"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(215,187,125,0.2)", color: "rgba(255,255,255,0.85)" }}
            data-testid="input-busca-lexico"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
          {filtered.map(item => {
            const isSelected = selected.includes(item.canonico);
            const isDisabled = selected.length >= 3 && !isSelected;
            const dimensao = item.dimensao || "C";
            return (
              <button
                key={item.canonico}
                onClick={() => !isDisabled && toggleWord(item.canonico)}
                disabled={isDisabled}
                className={`flex min-h-11 items-center px-3 py-2.5 rounded-xl border text-left transition-all text-xs font-mono ${isSelected
                  ?`${DIMENSAO_COLOR[dimensao]} border-opacity-60`
                  : isDisabled
                    ?"border-white/5 text-white/20 cursor-not-allowed"
                    : "border-white/10 text-white/60 hover:border-white/20 hover:text-white/80 hover:bg-white/5"}`}
                data-testid={`btn-palavra-${item.canonico}`}
                style={{ background: isSelected ?undefined : "rgba(255,255,255,0.02)" }}
              >
                <span className="font-semibold leading-snug">{item.canonico}</span>
              </button>
            );
          })}
        </div>
          </>
        )}

        <Button
          onClick={() => avaliarMutation.mutate()}
          disabled={selected.length === 0 || avaliarMutation.isPending}
          className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
          style={{
            background: selected.length > 0 ?"linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)",
            color: "#001D34",
          }}
          data-testid="btn-enviar-aura"
        >
          {avaliarMutation.isPending ?<Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Registrar Percepção de Aura
          {selected.length > 0 && ` (${selected.length} palavra${selected.length > 1 ?"s" : ""})`}
        </Button>

        {pageError && (
          <p className="text-red-300 text-xs font-mono text-center rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2">{pageError}</p>
        )}
      </div>
    </div>
  );
}
