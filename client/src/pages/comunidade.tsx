import { MessageCircle } from "lucide-react";

export default function ComunidadePage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-navy">
          <MessageCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-comunidade-title">Comunidade</h1>
          <p className="text-sm text-white/40 font-mono mt-0.5">Área de comunidade BUILT</p>
        </div>
      </div>

      <div
        className="rounded-2xl border border-white/8 p-12 flex flex-col items-center justify-center text-center"
        style={{ background: "linear-gradient(145deg, #071626, #040e1c)", minHeight: 320 }}
      >
        <div className="w-16 h-16 rounded-2xl border border-brand-gold/20 flex items-center justify-center mb-5"
          style={{ background: "rgba(215,187,125,0.06)" }}>
          <MessageCircle className="w-7 h-7 text-brand-gold/40" />
        </div>
        <p className="text-brand-gold/50 font-mono text-xs tracking-[0.3em] uppercase mb-2">// Em breve</p>
        <p className="text-white/30 font-mono text-sm">Este módulo está sendo desenvolvido.</p>
      </div>
    </div>
  );
}
