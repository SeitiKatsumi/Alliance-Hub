import { Coins } from "lucide-react";

export default function BuiltCapitalPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #001428 0%, #000c1f 60%, #000408 100%)" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(215,187,125,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      <div className="relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl border border-brand-gold/20 flex items-center justify-center"
            style={{ background: "rgba(215,187,125,0.06)" }}>
            <Coins className="w-10 h-10 text-brand-gold/60" />
          </div>
        </div>
        <p className="text-[11px] text-brand-gold/40 tracking-[0.4em] uppercase font-mono mb-2">// Rede Built</p>
        <h1 className="text-3xl font-bold font-mono tracking-wide mb-3" style={{ color: "#D7BB7D" }}>BUILT CAPITAL</h1>
        <div className="w-16 h-px mx-auto mb-4" style={{ background: "linear-gradient(to right, transparent, #D7BB7D60, transparent)" }} />
        <p className="text-sm text-white/30 font-mono">Módulo em desenvolvimento</p>
        <p className="text-xs text-white/15 font-mono mt-1">Em breve disponível</p>
      </div>
    </div>
  );
}
