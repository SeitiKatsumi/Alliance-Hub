import type { PortfolioDashboard, PortfolioMetric, PortfolioObservation } from "@shared/portfolio-dashboard";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const brl = (value: number | null) => value == null ? "Dados insuficientes" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const unavailableMetric = (total = 0): PortfolioMetric => ({ value: null, included: 0, total, partial: true });
function InfoHint({ label, children }: { label: string; children: string }) {
  return <Popover><PopoverTrigger asChild><button type="button" aria-label={`Sobre ${label}`} className="-my-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:-my-0.5 sm:h-7 sm:w-7"><Info className="h-4 w-4" /></button></PopoverTrigger><PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] text-sm leading-relaxed"><p>{children}</p></PopoverContent></Popover>;
}

function MetricLine({ label, metric, help, incompleteLabel = "Dados insuficientes" }: { label: string; metric?: PortfolioMetric; help: string; incompleteLabel?: string }) {
  const safeMetric = metric ?? unavailableMetric();
  return <div className="min-w-0 rounded-lg bg-muted/35 p-4">
    <div className="flex items-start gap-1.5"><h4 className="min-w-0 text-sm text-muted-foreground">{label}</h4><InfoHint label={label}>{help}</InfoHint></div>
    <p className="mt-2 break-words text-xl font-semibold tabular-nums">{safeMetric.partial ? incompleteLabel : brl(safeMetric.value)}</p>
    {safeMetric.partial && <p className="sr-only">Parcial · {safeMetric.included} de {safeMetric.total} com dados</p>}
  </div>;
}

function MetricGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border bg-card p-5"><h3 className="font-semibold">{title}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div></section>;
}

export function PatrimonyChart({ observations, kind }: { observations: PortfolioObservation[]; kind: "properties" | "cpps" }) {
  const title = kind === "properties" ? "Evolução dos imóveis próprios" : "Evolução das CPPs";
  const values = observations.map(o => ({ day: o.day, base: kind === "properties" ? o.metrics.acquisition : o.metrics.cppContributed || unavailableMetric(o.metrics.cppBase?.total),
    secondary: kind === "properties" ? o.metrics.propertyEstimate : o.metrics.cppRemaining || unavailableMetric(o.metrics.cppBase?.total) }));
  const numbers = values.flatMap(v => [v.base.value, v.secondary.value]).filter((v): v is number => v != null && Number.isFinite(v));
  const low = Math.min(0, ...numbers), high = Math.max(1, ...numbers), width = 620, height = 200;
  const first = values.length ? Date.parse(values[0].day) : 0;
  const last = values.length ? Date.parse(values[values.length - 1].day) : 0;
  const x = (day: string) => first === last ? width / 2 : 8 + (Date.parse(day) - first) / (last - first) * (width - 16);
  const y = (v: number) => 10 + (high - v) / (high - low) * (height - 20);
  const date = (day: string) => day.split("-").reverse().join("/");
  const baseLabel = kind === "properties" ? "Aquisição" : "Aportado";
  const secondaryLabel = kind === "properties" ? "Estimativa central" : "A aportar";
  return <section className="min-w-0 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">{title}</h3>
    {!values.length ? <p className="mt-5 text-sm text-muted-foreground">Sem observações registradas.</p> : <>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span className="text-blue-700 dark:text-blue-300">● {baseLabel}</span><span className="text-emerald-700 dark:text-emerald-300">● {secondaryLabel}</span></div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>{brl(high)}</span><span>{values.length === 1 ? "Primeira observação" : `${values.length} observações`}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full text-border" role="img" aria-label={`${title}. Valores detalhados na tabela abaixo.`}>
        <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="currentColor" />
        {(["base", "secondary"] as const).map((key, k) => <g key={key} stroke={k === 0 ? "#60a5fa" : "#34d399"} fill={k === 0 ? "#60a5fa" : "#34d399"}>
          {values.map((value, i) => {
            const amount = value[key].value, previous = values[i - 1];
            if (amount == null) return null;
            return <g key={value.day}>
              {previous?.[key].value != null && <line x1={x(previous.day)} y1={y(previous[key].value!)} x2={x(value.day)} y2={y(amount)} strokeWidth="2" strokeDasharray={value[key].partial || previous[key].partial ? "5 4" : undefined} />}
              <circle cx={x(value.day)} cy={y(amount)} r="4"><title>{`${date(value.day)} · ${key === "base" ? baseLabel : secondaryLabel}: ${brl(amount)}${value[key].partial ? " (parcial)" : ""}`}</title></circle>
            </g>;
          })}
        </g>)}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{date(values[0].day)}</span>{values.length > 1 && <span>{date(values[values.length - 1].day)}</span>}</div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Ver valores</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Data</th><th className="p-2">{baseLabel}</th><th className="p-2">{secondaryLabel}</th></tr></thead><tbody>{values.map(v => <tr key={v.day} className="border-t"><td className="p-2">{date(v.day)}</td><td className="p-2">{brl(v.base.value)}{v.base.partial ? " · parcial" : ""}</td><td className="p-2">{brl(v.secondary.value)}{v.secondary.partial ? " · parcial" : ""}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}

export function PortfolioPatrimonyDashboard({ metrics, observations, historyError, historyLoading }: { metrics: PortfolioDashboard; observations: PortfolioObservation[]; historyError?: string; historyLoading?: boolean }) {
  return <div className="space-y-4" data-testid="portfolio-patrimony-dashboard">
    <div className="grid gap-3 xl:grid-cols-2">
      <MetricGroup title="Imóveis próprios">
        <MetricLine label="Valor total estimado dos imóveis próprios" metric={metrics.propertyEstimate} incompleteLabel="Estimativa incompleta" help="Estimativa do valor patrimonial dos imóveis próprios baseada em pesquisa feita por IA comparando imóveis semelhantes em um raio de 10 km, com desvio padrão de 10% para mais ou para menos. O valor corresponde à soma das estimativas de cada imóvel da carteira; por isso, mantenha os imóveis e suas estimativas atualizados." />
        <MetricLine label="Valor total de aquisição" metric={metrics.acquisition} help="Somatório dos valores de aquisição dos imóveis de sua propriedade que foram declarados por você no momento do cadastro." />
      </MetricGroup>
      <MetricGroup title="Valor total de CPPs em alianças">
        <MetricLine label="Aportado" metric={metrics.cppContributed} help="Soma das CPPs de cada aliança multiplicada pelo percentual efetivamente aportado e conciliado nessa aliança." />
        <MetricLine label="A aportar" metric={metrics.cppRemaining} help="Saldo das CPPs ainda não integralizado: valor total das CPPs menos a parcela já aportada." />
      </MetricGroup>
    </div>
    {historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p> : historyLoading ? <p role="status" className="text-sm text-muted-foreground">Carregando evolução…</p> : <>
      <div className="grid gap-3 lg:grid-cols-2"><PatrimonyChart observations={observations} kind="properties" /><PatrimonyChart observations={observations} kind="cpps" /></div>
      <p className="text-xs text-muted-foreground">Histórico de observações registradas, sem reconstrução de valores anteriores. Carteiras com composição ou participação diferentes iniciam uma nova série.</p>
    </>}
  </div>;
}
