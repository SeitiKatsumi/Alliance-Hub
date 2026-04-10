import { Wrench, HardHat, ClipboardList, FileCheck, Ruler, CircleDashed } from "lucide-react";

export default function NucleoTecnicoPage() {
  const modules = [
    { icon: ClipboardList, label: "Estudos de Viabilidade", desc: "Análises técnicas e de viabilidade de projetos" },
    { icon: Ruler, label: "Projetos e Engenharia", desc: "Coordenação de projetos arquitetônicos e complementares" },
    { icon: FileCheck, label: "Licenciamento", desc: "Aprovações, alvarás e regularizações técnicas" },
    { icon: HardHat, label: "Execução Técnica", desc: "Acompanhamento técnico das obras aliadas" },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #001020 0%, #000c18 100%)" }}>
      {/* Header */}
      <div className="relative mb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, #5B9BD5, transparent)" }} />
          <div className="absolute top-0 left-0 w-px h-24" style={{ background: "linear-gradient(180deg, #5B9BD5, transparent)" }} />
        </div>

        <div className="flex items-center gap-4 mb-6 pt-2 pl-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #5B9BD520, #001D34)", border: "1px solid #5B9BD540" }}
          >
            <Wrench className="w-6 h-6" style={{ color: "#5B9BD5" }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#5B9BD560" }}>
                BUILT ALLIANCES · MÓDULO
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full" style={{ background: "#5B9BD540" }} />
                ))}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Núcleo Técnico</h1>
            <p className="text-sm mt-0.5" style={{ color: "#5B9BD580" }}>
              Gestão técnica, projetos e engenharia das BIAs
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ml-2"
          style={{ background: "#5B9BD510", border: "1px solid #5B9BD530" }}
        >
          <CircleDashed className="w-3.5 h-3.5 animate-spin" style={{ color: "#5B9BD5", animationDuration: "3s" }} />
          <span className="text-xs font-mono" style={{ color: "#5B9BD5" }}>EM DESENVOLVIMENTO</span>
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
              border: "1px solid #5B9BD520",
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: "#5B9BD510", border: "1px solid #5B9BD525" }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: "#5B9BD5" }} />
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
          border: "1px dashed #5B9BD530",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "#5B9BD510", border: "1px solid #5B9BD530" }}
        >
          <Wrench className="w-8 h-8" style={{ color: "#5B9BD5" }} />
        </div>
        <h2 className="text-lg font-bold text-white/80 mb-2">Núcleo Técnico</h2>
        <p className="text-sm text-white/30 max-w-md mx-auto">
          Este módulo está sendo desenvolvido. Em breve você terá acesso à gestão técnica completa
          das suas BIAs — projetos, laudos, licenciamentos e coordenação de engenharia.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 24 : 6,
                height: 6,
                background: i === 2 ? "#5B9BD5" : "#5B9BD530",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
