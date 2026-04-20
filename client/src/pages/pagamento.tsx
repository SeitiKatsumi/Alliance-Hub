import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, AlertCircle, CheckCircle2, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ConviteData {
  id: string;
  token: string;
  status: string;
  candidato_nome?: string;
  candidato_email?: string;
  comunidade?: {
    id: string;
    nome?: string;
    pais?: string;
    territorio?: string;
  };
}

const VALOR_ADESAO = "R$ 500,00";
const CHAVE_PIX = "financeiro@builtalliances.com";

export default function PagamentoPage() {
  const { token } = useParams<{ token: string }>();
  const [copiado, setCopiado] = useState(false);

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  function copiarChavePix() {
    navigator.clipboard.writeText(CHAVE_PIX).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

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

  if (convite.status === "membro") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Pagamento confirmado!</h2>
          <p className="text-white/60 text-sm font-mono leading-relaxed">
            Você já é membro oficial da <strong className="text-brand-gold">{convite.comunidade?.nome}</strong>. Bem-vindo à rede BUILT Alliances!
          </p>
        </div>
      </div>
    );
  }

  const statusInvalid = !["termos_aceitos", "pagamento_pendente"].includes(convite.status);

  if (statusInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold font-mono text-white">Pagamento não disponível</h2>
          <p className="text-white/50 text-sm font-mono">Você precisa aceitar os termos de adesão antes de prosseguir com o pagamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#001D34" }}>
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.3em] uppercase">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-brand-gold mt-1">Pagamento da Adesão</h1>
        </div>

        {/* Valor */}
        <div
          className="rounded-2xl p-6 border border-brand-gold/20 text-center"
          style={{ background: "rgba(215,187,125,0.05)" }}
        >
          <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Taxa de Adesão</p>
          <p className="text-4xl font-bold font-mono text-brand-gold mt-2">{VALOR_ADESAO}</p>
          <p className="text-white/50 text-sm font-mono mt-1">{convite.comunidade?.nome}</p>
        </div>

        {/* PIX Instructions */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
            <QrCode className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-white/60 uppercase tracking-wider">Pagamento via PIX</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm font-mono text-white/70">
              Realize o pagamento de <strong className="text-brand-gold">{VALOR_ADESAO}</strong> via PIX para a chave abaixo:
            </p>

            <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Chave PIX (e-mail)</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-mono text-white text-sm break-all">{CHAVE_PIX}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copiarChavePix}
                  className="shrink-0 text-brand-gold hover:text-brand-gold/80"
                  data-testid="btn-copiar-pix"
                >
                  {copiado ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 p-3" style={{ background: "rgba(245,158,11,0.05)" }}>
              <p className="text-xs font-mono text-amber-400/80 leading-relaxed">
                <strong>Importante:</strong> Após realizar o pagamento, envie o comprovante para seu Aliado BUILT ou para{" "}
                <a href="mailto:financeiro@builtalliances.com" className="underline text-amber-400">
                  financeiro@builtalliances.com
                </a>{" "}
                com seu nome completo no assunto. Seu acesso será ativado em até 24 horas.
              </p>
            </div>
          </div>
        </div>

        {/* Steps reminder */}
        <div className="rounded-xl border border-white/8 p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Próximos passos</p>
          {[
            "Realize o PIX no valor de R$ 500,00 para a chave acima",
            "Envie o comprovante com seu nome para financeiro@builtalliances.com",
            "Aguarde a confirmação (até 24h) e receba o badge BUILT PROUD MEMBER",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border border-brand-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-mono font-bold text-brand-gold">{i + 1}</span>
              </div>
              <p className="text-xs font-mono text-white/60 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-center justify-center">
          <CreditCard className="w-3.5 h-3.5 text-white/30" />
          <p className="text-xs font-mono text-white/30">Pagamento seguro gerenciado pela BUILT Alliances</p>
        </div>
      </div>
    </div>
  );
}
