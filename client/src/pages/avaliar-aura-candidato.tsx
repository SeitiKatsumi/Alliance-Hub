import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, AlertCircle, Sparkles, X, CheckCircle2, Search } from "lucide-react";
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
  dimensao: "T" | "R" | "C";
}

const DIMENSAO_LABEL: Record<string, string> = {
  T: "Técnica",
  R: "Relacional",
  C: "Comportamental",
};

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

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/avaliacao-aura", token],
    queryFn: () => fetch(`/api/avaliacao-aura/${token}`).then(r => {
      if (!r.ok) throw new Error("Link de avaliação inválido");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const { data: lexico = [] } = useQuery<LexicoItem[]>({
    queryKey: ["/api/aura/lexico"],
    queryFn: () => fetch("/api/aura/lexico").then(r => r.json()),
  });

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
            ? <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            : <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />}
          <h2 className="text-xl font-bold font-mono text-white">
            {already ? "Avaliação já registrada" : "Avaliação não disponível"}
          </h2>
          <p className="text-white/50 text-sm font-mono">
            {already
              ? "A avaliação de Aura para este candidato já foi registrada."
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
        ? prev.filter(w => w !== word)
        : prev.length < 3
          ? [...prev, word]
          : prev
    );
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
                return (
                  <button
                    key={p}
                    onClick={() => toggleWord(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all ${item ? DIMENSAO_COLOR[item.dimensao] : "text-brand-gold border-brand-gold/30 bg-brand-gold/10"}`}
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
            return (
              <button
                key={item.canonico}
                onClick={() => !isDisabled && toggleWord(item.canonico)}
                disabled={isDisabled}
                className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all text-xs font-mono ${isSelected
                  ? `${DIMENSAO_COLOR[item.dimensao]} border-opacity-60`
                  : isDisabled
                    ? "border-white/5 text-white/20 cursor-not-allowed"
                    : "border-white/10 text-white/60 hover:border-white/20 hover:text-white/80 hover:bg-white/5"}`}
                data-testid={`btn-palavra-${item.canonico}`}
                style={{ background: isSelected ? undefined : "rgba(255,255,255,0.02)" }}
              >
                <span className="font-semibold">{item.canonico}</span>
                <span className="text-[10px] opacity-60">{DIMENSAO_LABEL[item.dimensao]}</span>
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => avaliarMutation.mutate()}
          disabled={selected.length === 0 || avaliarMutation.isPending}
          className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
          style={{
            background: selected.length > 0 ? "linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)",
            color: "#001D34",
          }}
          data-testid="btn-enviar-aura"
        >
          {avaliarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Registrar Percepção de Aura
          {selected.length > 0 && ` (${selected.length} palavra${selected.length > 1 ? "s" : ""})`}
        </Button>

        {avaliarMutation.isError && (
          <p className="text-red-400 text-xs font-mono text-center">{(avaliarMutation.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}
