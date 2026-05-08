import { Award, CircleDashed, FileText, Handshake, Shield, Star, Target } from "lucide-react";

export default function DiretoriaAliancaPage() {
  const modules = [
    { icon: Star, label: "Gestão de Diretores", desc: "Cadastro e gestão dos diretores de aliança das BIAs" },
    { icon: Target, label: "Objetivos Estratégicos", desc: "Definição e acompanhamento dos objetivos da aliança" },
    { icon: FileText, label: "Atas e Deliberações", desc: "Registro de reuniões e decisões da diretoria" },
    { icon: Handshake, label: "Acordos de Aliança", desc: "Contratos e acordos entre os membros aliados" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-10">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/40 bg-brand-gold/20">
            <Shield className="h-6 w-6 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Diretoria da Aliança</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Governança e gestão estratégica das BIAs
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5">
          <CircleDashed className="h-3.5 w-3.5 animate-spin text-brand-gold" style={{ animationDuration: "3s" }} />
          <span className="text-xs font-mono text-brand-gold">EM DESENVOLVIMENTO</span>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="cursor-not-allowed rounded-xl border border-border bg-card p-5 opacity-70"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-brand-gold/25 bg-brand-gold/10">
              <Icon className="h-4 w-4 text-brand-gold" />
            </div>
            <div className="mb-1 text-sm font-semibold text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-brand-gold/40 bg-card p-12 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10">
          <Award className="h-8 w-8 text-brand-gold" />
        </div>
        <h2 className="mb-2 text-lg font-bold text-foreground">Diretoria da Aliança</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Este módulo está sendo desenvolvido. Em breve você terá acesso à governança completa
          das suas BIAs, gestão de diretores, objetivos estratégicos, atas e acordos de aliança.
        </p>
      </div>
    </div>
  );
}
