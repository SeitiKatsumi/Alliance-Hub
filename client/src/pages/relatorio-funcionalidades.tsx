import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  Layers3,
  ListChecks,
  LockKeyhole,
  Printer,
  Search,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BIA_FUNCTIONAL_PHASES,
  BIA_ROLE_ACCESS_PROFILES,
  PLATFORM_ACCESS_CONTEXTS,
  PLATFORM_ACCESS_PROFILES,
  PLATFORM_FUNCTIONAL_MODULES,
  PLATFORM_RELEASE_CONTROLS,
  PLATFORM_FUNCTIONAL_REPORT_SUMMARY,
  PLATFORM_FUNCTIONAL_REPORT_UPDATED_AT,
  type PlatformFeatureStatus,
  type PlatformReleaseControlStatus,
} from "@/data/platform-functional-report";

const STATUS_LABEL: Record<PlatformFeatureStatus, string> = {
  disponivel: "Disponível",
  evolucao: "Em evolução",
  homologacao: "Em homologação",
};

const STATUS_CLASS: Record<PlatformFeatureStatus, string> = {
  disponivel: "border-emerald-200 bg-emerald-50 text-emerald-700",
  evolucao: "border-blue-200 bg-blue-50 text-blue-700",
  homologacao: "border-amber-200 bg-amber-50 text-amber-700",
};

const STATUS_ICON = {
  disponivel: CheckCircle2,
  evolucao: Clock3,
  homologacao: FlaskConical,
};

const RELEASE_STATUS_LABEL: Record<PlatformReleaseControlStatus, string> = {
  protegido: "Proteção existente",
  validar: "Validar antes do lançamento",
  bloqueador: "Bloqueador de lançamento",
};

const RELEASE_STATUS_CLASS: Record<PlatformReleaseControlStatus, string> = {
  protegido: "border-emerald-200 bg-emerald-50 text-emerald-800",
  validar: "border-amber-200 bg-amber-50 text-amber-800",
  bloqueador: "border-red-200 bg-red-50 text-red-800",
};

const PHASE_OPERATION_LABEL = {
  manual: "Transição deliberada",
  automatica: "Transição automática",
  final: "Estado final",
};

function DetailList({ items, tone = "default" }: { items: string[]; tone?: "default" | "success" | "warning" }) {
  const dotClass = tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-blue-500";
  return <ul className="space-y-1.5">{items.map((item) => <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
    <span>{item}</span>
  </li>)}</ul>;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatReportDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function RelatorioFuncionalidadesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"todos" | PlatformFeatureStatus>("todos");

  const modules = useMemo(() => {
    const term = normalizeSearch(search);
    return PLATFORM_FUNCTIONAL_MODULES.map((module) => ({
      ...module,
      features: module.features.filter((feature) => {
        const matchesStatus = status === "todos" || feature.status === status;
        const matchesSearch = !term || normalizeSearch(`${module.title} ${module.summary} ${feature.title} ${feature.description}`).includes(term);
        return matchesStatus && matchesSearch;
      }),
    })).filter((module) => module.features.length > 0);
  }, [search, status]);

  const visibleFeatures = modules.reduce((total, module) => total + module.features.length, 0);

  return (
    <div className="min-h-full bg-[#f6f8fb] text-[#001D34] print:bg-white">
      <header className="border-b border-border/70 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-slate-600"
            onClick={() => navigate("/?tab=gestao")}
            data-testid="btn-relatorio-funcionalidades-voltar"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Gestão
          </Button>
          <Button
            type="button"
            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => window.print()}
            data-testid="btn-imprimir-relatorio-funcionalidades"
          >
            <Printer className="h-4 w-4" />
            Imprimir / salvar PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 md:px-8 print:max-w-none print:px-0 print:py-0">
        <section className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <FileText className="h-4 w-4" />
                BUILT Alliances Platform
              </div>
              <h1 className="text-2xl font-bold tracking-normal md:text-3xl">Relatório de funcionalidades da plataforma</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Documento de prontidão para lançamento: ciclo completo da BIA, requisitos de cada fase, acesso por tipo de usuário,
                efeitos de escolhas contextuais, barreiras de isolamento e inventário dos módulos implementados.
              </p>
            </div>
            <div className="shrink-0 text-left md:text-right">
              <p className="text-xs uppercase text-slate-500">Data de referência</p>
              <p className="mt-1 text-sm font-semibold">{formatReportDate(PLATFORM_FUNCTIONAL_REPORT_UPDATED_AT)}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 border-b border-slate-200 md:grid-cols-4">
          <div className="border-b border-r border-slate-200 px-4 py-5 md:border-b-0">
            <Layers3 className="h-4 w-4 text-blue-600" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{PLATFORM_FUNCTIONAL_REPORT_SUMMARY.modules}</p>
            <p className="text-xs text-slate-500">Módulos documentados</p>
          </div>
          <div className="border-b border-slate-200 px-4 py-5 md:border-b-0 md:border-r">
            <ListChecks className="h-4 w-4 text-violet-600" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{PLATFORM_FUNCTIONAL_REPORT_SUMMARY.features}</p>
            <p className="text-xs text-slate-500">Funcionalidades mapeadas</p>
          </div>
          <div className="border-r border-slate-200 px-4 py-5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{PLATFORM_FUNCTIONAL_REPORT_SUMMARY.disponivel}</p>
            <p className="text-xs text-slate-500">Disponíveis</p>
          </div>
          <div className="px-4 py-5">
            <Clock3 className="h-4 w-4 text-blue-600" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{PLATFORM_FUNCTIONAL_REPORT_SUMMARY.evolucao + PLATFORM_FUNCTIONAL_REPORT_SUMMARY.homologacao}</p>
            <p className="text-xs text-slate-500">Em evolução ou homologação</p>
          </div>
        </section>

        <nav className="my-6 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm print:hidden sm:grid-cols-2 lg:grid-cols-5" aria-label="Seções do relatório">
          {[
            ["#ciclo-bia", "Fases da BIA"],
            ["#perfis-acesso", "Usuários e acessos"],
            ["#papeis-bia", "Papéis na BIA"],
            ["#isolamento-lancamento", "Segurança do lançamento"],
            ["#inventario-funcional", "Todos os módulos"],
          ].map(([href, label]) => <a key={href} href={href} className="rounded-md border border-slate-200 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50">{label}</a>)}
        </nav>

        <section id="ciclo-bia" className="scroll-mt-6 border-t border-slate-200 pt-8">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Workflow className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Ciclo de vida completo da BIA</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                Cada fase habilita capacidades diferentes. A fase nunca substitui a autorização: o usuário também precisa estar vinculado à BIA e possuir o nível exigido na matriz de acesso.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {BIA_FUNCTIONAL_PHASES.map((phase, index) => <article key={phase.id} className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#001D34] text-xs font-bold text-white">{index + 1}</div>
                  <div>
                    <h3 className="font-bold">{phase.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{phase.purpose}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 border-blue-200 bg-blue-50 text-blue-700">{PHASE_OPERATION_LABEL[phase.operation]}</Badge>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">O que fica disponível</h4>
                  <DetailList items={phase.available} tone="success" />
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">O que é necessário</h4>
                  <DetailList items={phase.requirements} />
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Quem atua</h4>
                    <p className="text-xs leading-relaxed text-slate-600">{phase.actors}</p>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Bloqueios da fase</h4>
                    <DetailList items={phase.restrictions} tone="warning" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Próxima etapa:</strong> {phase.next}</span>
              </div>
            </article>)}
          </div>
        </section>

        <section id="perfis-acesso" className="scroll-mt-6 border-t border-slate-200 pt-8 mt-10">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700"><UserRound className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">O que cada tipo de usuário pode fazer</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                Acesso global, benefício de anuidade, vínculo empresarial e autorização contextual são camadas diferentes. Quando mais de uma camada se aplica, todas precisam permitir a ação.
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {PLATFORM_ACCESS_PROFILES.map((profile) => <article key={profile.id} className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
              <h3 className="font-bold">{profile.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{profile.identity}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Disponível</h4><DetailList items={profile.available} tone="success" /></div>
                <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Condições</h4><DetailList items={profile.conditional} tone="warning" /></div>
              </div>
              <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Não recebe automaticamente</h4>
                <DetailList items={profile.unavailable} tone="warning" />
              </div>
            </article>)}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold">O que muda ao selecionar uma tese, convite ou vínculo</h3>
            <p className="mt-1 text-sm text-slate-600">Escolhas de contexto personalizam a experiência, mas não devem ser confundidas com permissão.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {PLATFORM_ACCESS_CONTEXTS.map((context) => <article key={context.id} className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
                <h4 className="font-semibold">{context.title}</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Efeito real</p><DetailList items={context.effect} tone="success" /></div>
                  <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Não concede</p><DetailList items={context.doesNotGrant} tone="warning" /></div>
                </div>
              </article>)}
            </div>
          </div>
        </section>

        <section id="papeis-bia" className="scroll-mt-6 border-t border-slate-200 pt-8 mt-10">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Building2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Papéis e acessos dentro de cada BIA</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                A matriz possui níveis nenhum, visualizar e editar para Diretoria, Configuração, documentos por núcleo, Banco, Financeiro, Análises e DM. Papéis acumulam o maior nível válido, sempre limitado à BIA do vínculo.
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {BIA_ROLE_ACCESS_PROFILES.map((role) => <article key={role.id} className="rounded-lg border border-slate-200 bg-white p-4 print:break-inside-avoid">
              <h3 className="font-bold">{role.title}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">Acesso padrão</h4><DetailList items={role.defaultAccess} /></div>
                <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Pode fazer</h4><DetailList items={role.actions} tone="success" /></div>
                <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Limites</h4><DetailList items={role.limits} tone="warning" /></div>
              </div>
            </article>)}
          </div>
        </section>

        <section id="isolamento-lancamento" className="scroll-mt-6 border-t border-slate-200 pt-8 mt-10">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700"><LockKeyhole className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold">Isolamento de dados e prontidão para lançamento</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
                Esta seção separa proteções já aplicadas, verificações pendentes e bloqueadores que precisam ser resolvidos antes de liberar usuários comuns em produção.
              </p>
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {(["protegido", "validar", "bloqueador"] as PlatformReleaseControlStatus[]).map((releaseStatus) => {
              const count = PLATFORM_RELEASE_CONTROLS.filter((control) => control.status === releaseStatus).length;
              const Icon = releaseStatus === "protegido" ? ShieldCheck : AlertTriangle;
              return <div key={releaseStatus} className={`rounded-lg border p-4 ${RELEASE_STATUS_CLASS[releaseStatus]}`}>
                <Icon className="h-5 w-5" /><p className="mt-2 text-2xl font-bold tabular-nums">{count}</p><p className="text-xs font-medium">{RELEASE_STATUS_LABEL[releaseStatus]}</p>
              </div>;
            })}
          </div>
          <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {PLATFORM_RELEASE_CONTROLS.map((control) => <article key={control.id} className="grid gap-3 p-4 lg:grid-cols-[220px_minmax(0,1fr)] print:break-inside-avoid">
              <div>
                <h3 className="text-sm font-bold">{control.title}</h3>
                <Badge variant="outline" className={`mt-2 ${RELEASE_STATUS_CLASS[control.status]}`}>{RELEASE_STATUS_LABEL[control.status]}</Badge>
              </div>
              <div className="grid gap-3 text-xs leading-relaxed text-slate-600 md:grid-cols-3">
                <div><strong className="block text-slate-800">Regra</strong>{control.rule}</div>
                <div><strong className="block text-slate-800">Evidência atual</strong>{control.evidence}</div>
                <div><strong className="block text-slate-800">Ação antes do release</strong>{control.action}</div>
              </div>
            </article>)}
          </div>
        </section>

        <section id="inventario-funcional" className="scroll-mt-6 border-t border-slate-200 pt-8 mt-10">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700"><ListChecks className="h-5 w-5" /></div>
            <div><h2 className="text-xl font-bold">Inventário completo dos módulos</h2><p className="mt-1 text-sm text-slate-600">Todas as funcionalidades catalogadas, com situação de entrega e busca.</p></div>
          </div>

        <section className="my-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px] print:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar módulo ou funcionalidade..."
              className="pl-9"
              data-testid="input-buscar-relatorio-funcionalidades"
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as "todos" | PlatformFeatureStatus)}>
            <SelectTrigger data-testid="select-status-relatorio-funcionalidades">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="evolucao">Em evolução</SelectItem>
              <SelectItem value="homologacao">Em homologação</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <div className="mb-4 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>{visibleFeatures} funcionalidade(s) exibida(s)</span>
          {(search || status !== "todos") && (
            <button type="button" className="font-medium text-blue-700 hover:text-blue-800" onClick={() => { setSearch(""); setStatus("todos"); }}>
              Limpar filtros
            </button>
          )}
        </div>

        {modules.length === 0 ? (
          <div className="border-y border-slate-200 py-14 text-center">
            <Search className="mx-auto h-5 w-5 text-slate-400" />
            <p className="mt-3 text-sm font-medium">Nenhuma funcionalidade encontrada</p>
            <p className="mt-1 text-xs text-slate-500">Revise a busca ou a situação selecionada.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {modules.map((module, moduleIndex) => (
              <section key={module.id} data-testid={`modulo-relatorio-${module.id}`}>
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-700">
                    {String(moduleIndex + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{module.title}</h2>
                    <p className="mt-0.5 text-sm text-slate-600">{module.summary}</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                  {module.features.map((feature) => {
                    const StatusIcon = STATUS_ICON[feature.status];
                    return (
                      <article key={feature.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center print:break-inside-avoid">
                        <div className="flex min-w-0 gap-3">
                          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold">{feature.title}</h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{feature.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`w-fit shrink-0 ${STATUS_CLASS[feature.status]}`}>
                          {STATUS_LABEL[feature.status]}
                        </Badge>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        </section>

        <footer className="mt-10 border-t border-slate-200 py-5 text-xs leading-relaxed text-slate-500">
          Este relatório descreve o estado funcional da plataforma na data de referência. Recursos dependentes de serviços externos
          podem variar conforme credenciais, disponibilidade do provedor e ambiente de homologação.
        </footer>
      </main>
    </div>
  );
}
