import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  Layers3,
  ListChecks,
  Printer,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PLATFORM_FUNCTIONAL_MODULES,
  PLATFORM_FUNCTIONAL_REPORT_SUMMARY,
  PLATFORM_FUNCTIONAL_REPORT_UPDATED_AT,
  type PlatformFeatureStatus,
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
                Inventário funcional consolidado dos módulos e recursos implementados até a data de referência.
                Os itens em evolução já possuem base funcional e continuam recebendo melhorias.
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

        <footer className="mt-10 border-t border-slate-200 py-5 text-xs leading-relaxed text-slate-500">
          Este relatório descreve o estado funcional da plataforma na data de referência. Recursos dependentes de serviços externos
          podem variar conforme credenciais, disponibilidade do provedor e ambiente de homologação.
        </footer>
      </main>
    </div>
  );
}
