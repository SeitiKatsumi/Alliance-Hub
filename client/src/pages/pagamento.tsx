import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CreditCard, AlertCircle, CheckCircle2, Copy, QrCode, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

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
  const [processingTimedOut, setProcessingTimedOut] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const paymentSuccess = searchParams.get("payment_success") === "true";

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
    refetchInterval: paymentSuccess ? 3000 : false,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/convites/${token}/checkout`);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  // After 60s of polling with payment_success=true, show a fallback support message
  useEffect(() => {
    if (!paymentSuccess) return;
    const timer = setTimeout(() => setProcessingTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [paymentSuccess]);

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

  if (paymentSuccess && convite.status !== "membro") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
        <div className="text-center space-y-4 p-8 max-w-md">
          {processingTimedOut ? (
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          ) : (
            <Loader2 className="w-12 h-12 text-brand-gold mx-auto animate-spin" />
          )}
          <h2 className="text-xl font-bold font-mono text-white">
            {processingTimedOut ? "Ativação demorou mais que o esperado" : "Processando pagamento…"}
          </h2>
          <p className="text-white/60 text-sm font-mono leading-relaxed">
            {processingTimedOut ? (
              <>
                Seu pagamento foi recebido, mas a ativação está demorando. Entre em contato com seu <strong className="text-brand-gold">Aliado BUILT</strong> ou envie um e-mail para{" "}
                <a href="mailto:financeiro@builtalliances.com" className="underline text-amber-400">
                  financeiro@builtalliances.com
                </a>{" "}
                informando seu nome completo.
              </>
            ) : (
              <>
                Recebemos seu pagamento. Estamos ativando seu acesso à comunidade <strong className="text-brand-gold">{convite.comunidade?.nome}</strong>.
              </>
            )}
          </p>
          {!processingTimedOut && (
            <p className="text-white/30 text-xs font-mono" data-testid="text-processing">Isso pode levar alguns instantes.</p>
          )}
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

        {/* Stripe Checkout — primary CTA */}
        <div className="rounded-2xl border border-brand-gold/30 overflow-hidden" style={{ background: "rgba(215,187,125,0.07)" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20">
            <CreditCard className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-mono text-brand-gold/70 uppercase tracking-wider">Pagamento com Cartão (recomendado)</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm font-mono text-white/70">
              Pague <strong className="text-brand-gold">{VALOR_ADESAO}</strong> com segurança via Stripe. Seu acesso será ativado automaticamente após a confirmação.
            </p>
            <Button
              className="w-full font-mono bg-brand-gold hover:bg-brand-gold/90 text-[#001D34] font-bold"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              data-testid="btn-stripe-checkout"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecionando…
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pagar com Cartão — R$ 500,00
                </>
              )}
            </Button>
            {checkoutMutation.isError && (
              <p className="text-xs font-mono text-red-400 text-center" data-testid="text-checkout-error">
                {(checkoutMutation.error as Error)?.message?.includes("expirou")
                  ? "O prazo de pagamento expirou. Solicite um novo lembrete ao seu Aliado BUILT."
                  : "Erro ao iniciar pagamento. Tente novamente."}
              </p>
            )}
            <p className="text-[10px] font-mono text-white/30 text-center">
              Você será redirecionado para o ambiente seguro do Stripe. Pagamento via cartão de crédito ou débito.
            </p>
          </div>
        </div>

        {/* PIX Fallback */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
            <QrCode className="w-4 h-4 text-white/40" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Alternativa: Pagamento via PIX</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm font-mono text-white/50">
              Caso prefira, realize o PIX para a chave abaixo e envie o comprovante ao seu Aliado BUILT. A confirmação será feita manualmente em até 24h.
            </p>

            <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Chave PIX (e-mail)</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-mono text-white/70 text-sm break-all">{CHAVE_PIX}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copiarChavePix}
                  className="shrink-0 text-white/50 hover:text-white/80"
                  data-testid="btn-copiar-pix"
                >
                  {copiado ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/10 p-3" style={{ background: "rgba(245,158,11,0.04)" }}>
              <p className="text-xs font-mono text-amber-400/60 leading-relaxed">
                Após o PIX, envie o comprovante para{" "}
                <a href="mailto:financeiro@builtalliances.com" className="underline text-amber-400/80">
                  financeiro@builtalliances.com
                </a>{" "}
                com seu nome completo no assunto.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-center justify-center">
          <CreditCard className="w-3.5 h-3.5 text-white/30" />
          <p className="text-xs font-mono text-white/30">Pagamento seguro gerenciado pela BUILT Alliances</p>
        </div>
      </div>
    </div>
  );
}
