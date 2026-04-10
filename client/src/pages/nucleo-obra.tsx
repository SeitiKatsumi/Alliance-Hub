import { HardHat, Calendar, ClipboardCheck, Camera, AlertTriangle, CircleDashed } from "lucide-react";

export default function NucleoObraPage() {
  const modules = [
    { icon: Calendar, label: "Cronograma de Obras", desc: "Planejamento e controle de prazos de execução" },
    { icon: ClipboardCheck, label: "Diário de Obra", desc: "Registros diários de atividades e ocorrências" },
    { icon: Camera, label: "Registro Fotográfico", desc: "Documentação visual do andamento da obra" },
    { icon: AlertTriangle, label: "Ocorrências", desc: "Gestão de não-conformidades e pendências" },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: "linear-gradient(135deg, #001020 0%, #000c18 100%)" }}>
      {/* Header */}
      <div className="relative mb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-24 h-px" style={{ background: "linear-gradient(90deg, #E8845A, transparent)" }} />
          <div className="absolute top-0 left-0 w-px h-24" style={{ background: "linear-gradient(180deg, #E8845A, transparent)" }} />
        </div>

        <div className="flex items-center gap-4 mb-6 pt-2 pl-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #E8845A20, #001D34)", border: "1px solid #E8845A40" }}
          >
            <HardHat className="w-6 h-6" style={{ color: "#E8845A" }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#E8845A60" }}>
                BUILT ALLIANCES · MÓDULO
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full" style={{ background: "#E8845A40" }} />
                ))}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Núcleo de Obra</h1>
            <p className="text-sm mt-0.5" style={{ color: "#E8845A80" }}>
              Gestão e acompanhamento de obras das BIAs
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ml-2"
          style={{ background: "#E8845A10", border: "1px solid #E8845A30" }}
        >
          <CircleDashed className="w-3.5 h-3.5 animate-spin" style={{ color: "#E8845A", animationDuration: "3s" }} />
          <span className="text-xs font-mono" style={{ color: "#E8845A" }}>EM DESENVOLVIMENTO</span>
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
              border: "1px solid #E8845A20",
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: "#E8845A10", border: "1px solid #E8845A25" }}
            >
              <Icon className="w-4 h-4" style={{ color: "#E8845A" }} />
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
          border: "1px dashed #E8845A30",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "#E8845A10", border: "1px solid #E8845A30" }}
        >
          <HardHat className="w-8 h-8" style={{ color: "#E8845A" }} />
        </div>
        <h2 className="text-lg font-bold text-white/80 mb-2">Núcleo de Obra</h2>
        <p className="text-sm text-white/30 max-w-md mx-auto">
          Este módulo está sendo desenvolvido. Em breve você terá acesso ao controle
          completo de obras — cronogramas, diário de obra, registros fotográficos e gestão de ocorrências.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 24 : 6,
                height: 6,
                background: i === 2 ? "#E8845A" : "#E8845A30",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
