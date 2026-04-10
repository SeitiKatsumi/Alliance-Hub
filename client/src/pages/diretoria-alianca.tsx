import { Shield, Users, Star, Award, CircleDashed, Target, FileText, Handshake } from "lucide-react";

export default function DiretoriaAliancaPage() {
  const modules = [
    { icon: Star, label: "Gestão de Diretores", desc: "Cadastro e gestão dos diretores de aliança das BIAs" },
    { icon: Target, label: "Objetivos Estratégicos", desc: "Definição e acompanhamento dos objetivos da aliança" },
    { icon: FileText, label: "Atas e Deliberações", desc: "Registro de reuniões e decisões da diretoria" },
    { icon: Handshake, label: "Acordos de Aliança", desc: "Contratos e acordos entre os membros aliados" },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #001020 0%, #000c18 100%)" }}>
      {/* Header */}
      <div className="relative mb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, #D7BB7D, transparent)" }} />
          <div className="absolute top-0 left-0 w-px h-24" style={{ background: "linear-gradient(180deg, #D7BB7D, transparent)" }} />
        </div>

        <div className="flex items-center gap-4 mb-6 pt-2 pl-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #D7BB7D20, #001D34)", border: "1px solid #D7BB7D40" }}
          >
            <Shield className="w-6 h-6" style={{ color: "#D7BB7D" }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#D7BB7D60" }}>
                BUILT ALLIANCES · MÓDULO
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full" style={{ background: "#D7BB7D40" }} />
                ))}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Diretoria da Aliança</h1>
            <p className="text-sm mt-0.5" style={{ color: "#D7BB7D80" }}>
              Governança e gestão estratégica das BIAs
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ml-2"
          style={{ background: "#D7BB7D10", border: "1px solid #D7BB7D30" }}
        >
          <CircleDashed className="w-3.5 h-3.5 animate-spin" style={{ color: "#D7BB7D", animationDuration: "3s" }} />
          <span className="text-xs font-mono" style={{ color: "#D7BB7D" }}>EM DESENVOLVIMENTO</span>
        </div>
      </div>

      {/* Grid de submódulos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {modules.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="rounded-xl p-5 opacity-60 cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #050f1c 0%, #030812 100%)",
              border: "1px solid #D7BB7D20",
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: "#D7BB7D10", border: "1px solid #D7BB7D25" }}
            >
              <Icon className="w-4 h-4" style={{ color: "#D7BB7D" }} />
            </div>
            <div className="text-sm font-semibold text-white/70 mb-1">{label}</div>
            <div className="text-xs text-white/30">{desc}</div>
          </div>
        ))}
      </div>

      {/* Placeholder principal */}
      <div
        className="rounded-2xl p-12 text-center"
        style={{
          background: "linear-gradient(135deg, #050f1c 0%, #030812 100%)",
          border: "1px dashed #D7BB7D30",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "#D7BB7D10", border: "1px solid #D7BB7D30" }}
        >
          <Shield className="w-8 h-8" style={{ color: "#D7BB7D" }} />
        </div>
        <h2 className="text-lg font-bold text-white/80 mb-2">Diretoria da Aliança</h2>
        <p className="text-sm text-white/30 max-w-md mx-auto">
          Este módulo está sendo desenvolvido. Em breve você terá acesso à governança completa
          das suas BIAs — gestão de diretores, objetivos estratégicos, atas e acordos de aliança.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 24 : 6,
                height: 6,
                background: i === 2 ? "#D7BB7D" : "#D7BB7D30",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
