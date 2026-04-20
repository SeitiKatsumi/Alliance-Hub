import { CheckCircle2 } from "lucide-react";

export default function PagamentoSucessoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#001D34" }}>
      <div className="text-center space-y-5 p-8 max-w-md">
        <div className="relative inline-flex">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-brand-gold/50 uppercase tracking-[0.3em]">BUILT ALLIANCES</p>
          <h1 className="text-2xl font-bold font-mono text-white">Pagamento recebido!</h1>
        </div>
        <p className="text-white/60 text-sm font-mono leading-relaxed">
          Seu pagamento foi confirmado. Estamos ativando seu acesso à comunidade BUILT. Em instantes você receberá um e-mail de boas-vindas.
        </p>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-4">
          <p className="text-xs font-mono text-white/40 leading-relaxed">
            Se o acesso não for ativado em alguns minutos, entre em contato com seu <strong className="text-brand-gold/70">Aliado BUILT</strong> ou envie um e-mail para{" "}
            <a href="mailto:financeiro@builtalliances.com" className="underline text-amber-400/70">
              financeiro@builtalliances.com
            </a>
            .
          </p>
        </div>
        <p className="text-[10px] font-mono text-white/20">Você pode fechar esta página.</p>
      </div>
    </div>
  );
}
