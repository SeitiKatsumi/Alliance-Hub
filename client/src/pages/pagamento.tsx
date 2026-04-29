import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/cNi3cudLvbdL1Wl6E304804";
const ASAAS_CARTAO_LINK = "https://www.asaas.com/c/og75ioogsdf4khkj";
const ASAAS_PARCELADO_LINK = "https://www.asaas.com/c/xmchi205bgdtdxjd";

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

function isBrazil(pais?: string | null): boolean {
  if (!pais) return false;
  const normalized = pais.trim().toLowerCase();
  return normalized === "brasil" || normalized === "brazil" || normalized === "br";
}

export default function PagamentoPage() {
  const { token } = useParams<{ token: string }>();

  const { data: convite, isLoading, error } = useQuery<ConviteData>({
    queryKey: ["/api/convites", token],
    queryFn: () => fetch(`/api/convites/${token}`).then(r => {
      if (!r.ok) throw new Error("Convite não encontrado");
      return r.json();
    }),
    enabled: !!token,
    retry: false,
    refetchInterval: 5000,
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

  const brasil = isBrazil(convite.comunidade?.pais);
  const stripeUrl = `${STRIPE_PAYMENT_LINK}?client_reference_id=${token}${convite.candidato_email ? `&prefilled_email=${encodeURIComponent(convite.candidato_email)}` : ""}`;

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
          <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-widest">Assinatura Anual</p>
          <p className="text-4xl font-bold font-mono text-brand-gold mt-2">R$ 3.197,00</p>
          <p className="text-white/40 text-xs font-mono mt-1">R$ 266,42/mês · cobrado anualmente</p>
          <p className="text-white/50 text-sm font-mono mt-2">{convite.comunidade?.nome}</p>
          {convite.candidato_nome && (
            <p className="text-white/30 text-xs font-mono mt-0.5">{convite.candidato_nome}</p>
          )}
        </div>

        {brasil ? (
          /* Asaas — Brazilian users */
          <div className="space-y-3">
            {/* Cartão de crédito à vista */}
            <div className="rounded-2xl border border-brand-gold/30 overflow-hidden" style={{ background: "rgba(215,187,125,0.07)" }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20">
                <CreditCard className="w-4 h-4 text-brand-gold" />
                <span className="text-xs font-mono text-brand-gold/70 uppercase tracking-wider">Cartão de Crédito — à vista</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm font-mono text-white/70">
                  Pague à vista no cartão de crédito. Seu acesso será ativado <strong className="text-brand-gold">automaticamente</strong> após a confirmação.
                </p>
                <Button
                  className="w-full font-mono bg-brand-gold hover:bg-brand-gold/90 text-[#001D34] font-bold"
                  onClick={() => { window.open(ASAAS_CARTAO_LINK, "_blank"); }}
                  data-testid="btn-asaas-cartao"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pagar R$ 3.197,00 à vista
                </Button>
              </div>
            </div>

            {/* Parcelado */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
                <CreditCard className="w-4 h-4 text-white/50" />
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">Parcelado no cartão</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm font-mono text-white/60">
                  Prefere parcelar? Escolha a quantidade de parcelas e pague de forma cômoda.
                </p>
                <Button
                  variant="outline"
                  className="w-full font-mono border-white/20 text-white/80 hover:text-white hover:border-white/40 bg-transparent font-semibold"
                  onClick={() => { window.open(ASAAS_PARCELADO_LINK, "_blank"); }}
                  data-testid="btn-asaas-parcelado"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pagar parcelado
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-center justify-center">
              <CreditCard className="w-3.5 h-3.5 text-white/30" />
              <p className="text-xs font-mono text-white/30">Pagamento seguro via Asaas · gerenciado pela BUILT Alliances</p>
            </div>
          </div>
        ) : (
          /* Stripe — international users */
          <div className="rounded-2xl border border-brand-gold/30 overflow-hidden" style={{ background: "rgba(215,187,125,0.07)" }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-brand-gold/20">
              <CreditCard className="w-4 h-4 text-brand-gold" />
              <span className="text-xs font-mono text-brand-gold/70 uppercase tracking-wider">Pagamento Seguro via Stripe</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-mono text-white/70">
                Assine com segurança via Stripe. Seu acesso será ativado <strong className="text-brand-gold">automaticamente</strong> após a confirmação do pagamento.
              </p>
              <Button
                className="w-full font-mono bg-brand-gold hover:bg-brand-gold/90 text-[#001D34] font-bold"
                onClick={() => { window.location.href = stripeUrl; }}
                data-testid="btn-stripe-checkout"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Assinar por R$ 3.197,00/ano
              </Button>
              <p className="text-[10px] font-mono text-white/30 text-center">
                Você será redirecionado para o ambiente seguro do Stripe. Aceitamos cartão, Apple Pay e Boleto.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
