import { Sparkles, Construction } from "lucide-react";

export default function AuraPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#020b16" }}
    >
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(215,187,125,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(215,187,125,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 space-y-6">
        {/* Animated icon */}
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center border border-brand-gold/20"
            style={{
              background: "radial-gradient(circle, rgba(215,187,125,0.1) 0%, transparent 70%)",
              boxShadow: "0 0 40px rgba(215,187,125,0.12)",
              animation: "pulse 3s ease-in-out infinite",
            }}
          >
            <Sparkles className="w-10 h-10 text-brand-gold/60" />
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border border-amber-500/30"
            style={{ background: "rgba(2,11,22,0.9)" }}
          >
            <Construction className="w-4 h-4 text-amber-400/70" />
          </div>
        </div>

        {/* Label */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-brand-gold/40 tracking-[0.4em] uppercase">
            // EM CONSTRUÇÃO
          </p>
          <h1 className="text-3xl font-bold font-mono text-brand-gold tracking-wide">
            AURA
          </h1>
          <p className="text-sm text-white/30 max-w-xs leading-relaxed">
            O módulo de scoring e reputação da rede Built Alliances está sendo desenvolvido e em breve estará disponível.
          </p>
        </div>

        {/* Decorative line */}
        <div
          className="w-40 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(215,187,125,0.4), transparent)",
          }}
        />

        <p className="text-[11px] font-mono text-white/20">
          &gt; módulo em desenvolvimento...
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
