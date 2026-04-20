import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, FileText, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConviteData {
  id: string;
  token: string;
  status: string;
  candidato_nome?: string;
  candidato_email?: string;
  comunidade?: {
    id: string;
    nome?: string;
    sigla?: string;
    pais?: string;
    territorio?: string;
  };
}

const TERMOS_ADESAO = `
TERMOS DE ADESÃO À COMUNIDADE BUILT ALLIANCES

1. OBJETO
Os presentes Termos de Adesão regulam a entrada do Candidato como membro da Comunidade BUILT Alliances, uma rede de alianças estratégicas para negócios no setor de construção e engenharia.

2. COMPROMISSOS DO MEMBRO
O membro compromete-se a:
a) Atuar com ética e transparência em todas as relações dentro da rede;
b) Participar ativamente das atividades da Comunidade;
c) Manter sigilo sobre informações confidenciais compartilhadas na rede;
d) Contribuir para o crescimento coletivo da aliança;
e) Respeitar o Código de Conduta da BUILT Alliances.

3. BENEFÍCIOS DA MEMBRESSIA
O membro terá acesso a:
a) Rede exclusiva de parceiros e aliados estratégicos;
b) Projetos colaborativos (BIAs) e oportunidades de negócio (OPAs);
c) Comunidade digital da rede BUILT;
d) Eventos e capacitações exclusivos.

4. TAXA DE ADESÃO
A participação na Comunidade BUILT está sujeita ao pagamento de uma taxa de adesão de R$ 500,00 (quinhentos reais), a ser paga conforme instrução na próxima etapa.

5. VIGÊNCIA
A membressia é válida por 12 meses, renovável automaticamente, sujeita ao bom relacionamento com a comunidade.

6. RESCISÃO
A BUILT Alliances reserva-se o direito de descontinuar a membressia em caso de violação destes termos, após aviso prévio de 30 dias.

7. FORO
Fica eleito o foro da comarca de Belo Horizonte/MG para dirimir quaisquer controvérsias.

Ao aceitar estes termos, o Candidato declara ter lido, compreendido e concordado com todas as cláusulas acima.
`.trim();

export default function AdesaoPage() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  const adesaoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/convites/${token}/adesao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceito: true }),
      });
      if (!r.ok) throw new Error("Erro ao registrar aceite");
      return r.json();
    },
    onSuccess: () => {
      setAccepted(true);
      // Redirect directly to payment page after terms acceptance
      setTimeout(() => navigate(`/pagamento/${token}`), 1500);
    },
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
          <p className="text-white/50 text-sm font-mono">Este link pode ter expirado ou sido removido.</p>
        </div>
      </div>
    );
  }

  const statusInvalid = !["aprovado", "termos_enviados"].includes(convite.status);
  const jaAceito = convite.status === "termos_aceitos" || convite.status === "pagamento_pendente" || convite.status === "membro";

  if (accepted || jaAceito) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Termos aceitos!</h2>
          <p className="text-white/60 text-sm font-mono leading-relaxed">
            Você aceitou os termos de adesão da <strong className="text-brand-gold">{convite.comunidade?.nome}</strong>.
            Verifique seu e-mail para as instruções de pagamento.
          </p>
        </div>
      </div>
    );
  }

  if (statusInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Termos não disponíveis</h2>
          <p className="text-white/50 text-sm font-mono">Este link não está disponível para aceite de termos no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#001D34" }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Termos de Adesão</h1>
          <p className="text-white/50 text-sm font-mono mt-1">
            Leia atentamente os termos antes de aceitar
          </p>
        </div>

        {/* Comunidade info */}
        <div className="rounded-xl p-4 border border-brand-gold/20 flex items-center gap-3" style={{ background: "rgba(215,187,125,0.05)" }}>
          <Shield className="w-5 h-5 text-brand-gold shrink-0" />
          <div>
            <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Aderindo à</p>
            <p className="text-sm font-bold font-mono text-white">{convite.comunidade?.nome}</p>
          </div>
        </div>

        {/* Terms document */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
            <FileText className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-white/60 uppercase tracking-wider">Documento de Adesão</span>
          </div>
          <div className="p-5 max-h-80 overflow-y-auto">
            <pre className="text-xs font-mono text-white/70 leading-relaxed whitespace-pre-wrap">
              {TERMOS_ADESAO}
            </pre>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group" data-testid="label-aceite-termos">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? "bg-brand-gold border-brand-gold" : "border-white/30 group-hover:border-white/50"}`}
            onClick={() => setChecked(c => !c)}
          >
            {checked && <svg viewBox="0 0 10 10" className="w-3 h-3 text-brand-navy"><path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span className="text-sm font-mono text-white/70 leading-relaxed select-none" onClick={() => setChecked(c => !c)}>
            Li e concordo com os <strong className="text-brand-gold">Termos de Adesão</strong> da Comunidade BUILT Alliances
          </span>
        </label>

        <Button
          onClick={() => adesaoMutation.mutate()}
          disabled={!checked || adesaoMutation.isPending}
          className="w-full h-12 font-mono font-bold text-sm disabled:opacity-40"
          style={{ background: checked ? "linear-gradient(135deg,#D7BB7D,#b89a50)" : "rgba(215,187,125,0.2)", color: "#001D34" }}
          data-testid="btn-aceitar-termos"
        >
          {adesaoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Aceitar Termos e Continuar
        </Button>
        {adesaoMutation.isError && (
          <p className="text-red-400 text-xs font-mono text-center">Erro ao registrar aceite. Tente novamente.</p>
        )}
      </div>
    </div>
  );
}
