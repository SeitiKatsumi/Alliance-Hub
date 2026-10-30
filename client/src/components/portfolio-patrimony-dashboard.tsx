import type { PortfolioDashboard, PortfolioMetric, PortfolioObservation } from "@shared/portfolio-dashboard";
import { PortfolioComposition } from "./portfolio-composition";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const brl = (value: number | null) => value == null ? "Dados insuficientes" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const compactBrl = (value: number | null) => value == null ? "Dados insuficientes" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(value);
const unavailableMetric = (total = 0): PortfolioMetric => ({ value: null, included: 0, total, partial: true });
function InfoHint({ label, children }: { label: string; children: string }) {
  return <Popover><PopoverTrigger asChild><button type="button" aria-label={`Sobre ${label}`} className="-my-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:-my-0.5 sm:h-7 sm:w-7"><Info className="h-4 w-4" /></button></PopoverTrigger><PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] text-sm leading-relaxed"><p>{children}</p></PopoverContent></Popover>;
}

function MetricLine({ label, displayLabel, metric, help, incompleteLabel = "Dados insuficientes" }: { label: string; displayLabel?: string; metric?: PortfolioMetric; help: string; incompleteLabel?: string }) {
  const safeMetric = metric ?? unavailableMetric();
  return <div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">
    <div className="flex items-start gap-1.5"><h4 className="min-w-0 text-sm text-muted-foreground">{displayLabel || label}</h4><InfoHint label={label}>{safeMetric.partial ? help : `${brl(safeMetric.value)}. ${help}`}</InfoHint></div>
    <p className="mt-2 break-words text-base font-semibold tabular-nums sm:text-xl">{safeMetric.partial ? incompleteLabel : <><span className="xl:hidden" title={brl(safeMetric.value)} aria-label={brl(safeMetric.value)}>{compactBrl(safeMetric.value)}</span><span className="hidden xl:inline">{brl(safeMetric.value)}</span></>}</p>
    {safeMetric.partial && <p className="sr-only">Parcial · {safeMetric.included} de {safeMetric.total} com dados</p>}
  </div>;
}

export function PatrimonyChart({ observations, kind }: { observations: PortfolioObservation[]; kind: "properties" | "cpps" }) {
  const title = kind === "properties" ? "Evolução dos imóveis próprios" : "Evolução das CPPs";
  const values = observations.map(o => ({ day: o.day, base: kind === "properties" ? o.metrics.acquisition : o.metrics.cppContributed || unavailableMetric(o.metrics.cppBase?.total),
    secondary: kind === "properties" ? o.metrics.propertyEstimate : o.metrics.cppRemaining || unavailableMetric(o.metrics.cppBase?.total) }));
  const numbers = values.flatMap(v => [v.base.value, v.secondary.value]).filter((v): v is number => v != null && Number.isFinite(v));
  const stacked = values.map(v => (v.base.value ?? 0) + (v.secondary.value ?? 0));
  const low = Math.min(0, ...numbers), high = Math.max(1, ...(kind === "cpps" ? stacked : numbers)), width = 620, height = 200;
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
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span className={kind === "cpps" ? "text-violet-700 dark:text-violet-400" : "text-blue-700 dark:text-blue-300"}>● {baseLabel}</span><span className={kind === "cpps" ? "text-violet-500 dark:text-violet-200" : "text-cyan-700 dark:text-cyan-300"}>● {secondaryLabel}</span></div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>{brl(high)}</span><span>{values.length === 1 ? "Primeira observação" : `${values.length} observações`}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full text-border" role="img" aria-label={`${title}. Valores detalhados na tabela abaixo.`}>
        {[0, 0.25, 0.5, 0.75, 1].map(tick => <line key={tick} x1="0" x2={width} y1={y(low + (high - low) * tick)} y2={y(low + (high - low) * tick)} stroke="currentColor" strokeDasharray="3 4" />)}
        {(["base", "secondary"] as const).map((key, k) => <g key={key} stroke={kind === "cpps" ? (k === 0 ? "#8b5cf6" : "#c4b5fd") : (k === 0 ? "#60a5fa" : "#22d3ee")} fill={k === 0 ? "#60a5fa" : "#34d399"}>
          {values.map((value, i) => {
            const amount = value[key].value, previous = values[i - 1];
            if (amount == null) return null;
            if (kind === "cpps") {
              const offset = key === "secondary" ? (value.base.value ?? 0) : 0;
              const barWidth = Math.min(38, width / Math.max(1, values.length) * 0.6);
              return <rect key={value.day} x={Math.max(0, Math.min(width - barWidth, x(value.day) - barWidth / 2))} y={y(amount + offset)} width={barWidth} height={Math.max(0, y(offset) - y(amount + offset))} opacity={value[key].partial ? 0.5 : 1}><title>{`${date(value.day)} · ${key === "base" ? baseLabel : secondaryLabel}: ${brl(amount)}${value[key].partial ? " (parcial)" : ""}`}</title></rect>;
            }
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

export function PortfolioPatrimonyDashboard({ metrics, observations, historyError, historyLoading, properties = [], showAlliances = true, showProperties = true, showTheses = true, thesisAllocation, onCreateProperty, onViewProperties, onViewAlliances }: {
  metrics: PortfolioDashboard; observations: PortfolioObservation[]; historyError?: string; historyLoading?: boolean;
  properties?: { id: string; tipo?: string; ocupacao?: string; consolidado_via_bia?: boolean }[];
  showAlliances?: boolean; showProperties?: boolean; showTheses?: boolean;
  thesisAllocation?: { name: string; value: number; percent: number }[];
  onCreateProperty?: () => void; onViewProperties?: () => void; onViewAlliances?: () => void;
}) {
  const chart = (kind: "properties" | "cpps") => historyError
    ? <p role="alert" className="rounded-lg border p-4 text-sm text-destructive">{historyError}</p>
    : historyLoading ? <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">Carregando evolução…</p>
    : <PatrimonyChart observations={observations} kind={kind} />;
  return <div className="space-y-4" data-testid="portfolio-patrimony-dashboard">
    <div className={`grid items-stretch gap-5 ${showAlliances && showProperties ? "lg:grid-cols-2" : ""}`}>
      {showProperties && <section aria-label="Meus imóveis" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Meus imóveis</h3>{onCreateProperty && <Button onClick={onCreateProperty}>Cadastrar imóvel</Button>}</div>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <MetricLine label="Valor total estimado dos imóveis próprios" displayLabel="Valor estimado" metric={metrics.propertyEstimate} incompleteLabel="Estimativa incompleta" help="Estimativa do valor patrimonial dos imóveis próprios baseada em pesquisa feita por IA comparando imóveis semelhantes em um raio de 10 km, com desvio padrão de 10% para mais ou para menos. O valor corresponde à soma das estimativas de cada imóvel da carteira; por isso, mantenha os imóveis e suas estimativas atualizados." />
          <MetricLine label="Valor total de aquisição" displayLabel="Valor de aquisição" metric={metrics.acquisition} help="Somatório dos valores de aquisição dos imóveis de sua propriedade que foram declarados por você no momento do cadastro." />
        </div>
        {chart("properties")}
        <PortfolioComposition properties={properties} />
        {onViewProperties && <Button variant="ghost" className="mt-auto justify-start border-t pt-5 text-sky-600 dark:text-sky-300" onClick={onViewProperties}>Ver meus imóveis →</Button>}
      </section>}
      {showAlliances && <section aria-label="Minhas alianças" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{showProperties ? "Minhas alianças" : "Valor total de CPPs em alianças"}</h3>{onViewAlliances && <Button onClick={onViewAlliances}>Ver alianças</Button>}</div>
        <div className="grid min-w-0 grid-cols-2 gap-3" aria-label="Valor total de CPPs em alianças">
          <MetricLine label="Aportado" displayLabel="CPPs aportadas" metric={metrics.cppContributed} help="Soma das CPPs de cada aliança multiplicada pelo percentual efetivamente aportado e conciliado nessa aliança." />
          <MetricLine label="A aportar" displayLabel="CPPs a aportar" metric={metrics.cppRemaining} help="Saldo das CPPs ainda não integralizado: valor total das CPPs menos a parcela já aportada." />
        </div>
        {chart("cpps")}
        {showTheses && <section className="min-w-0 rounded-xl border bg-card p-4"><h3 className="font-semibold">Teses das alianças</h3><p className="mt-1 text-xs text-muted-foreground">Distribuição do valor investido</p>
          {!thesisAllocation?.length ? <p className="py-6 text-sm text-muted-foreground">{thesisAllocation ? "Sem investimentos informados para distribuir." : "Consulte a distribuição na lista de alianças."}</p> : <ul className="mt-5 space-y-4">{thesisAllocation.map(item => <li key={item.name}>
            <div className="mb-2 flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 tabular-nums">{item.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div>
            <progress className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-violet-500 [&::-moz-progress-bar]:bg-violet-500" max={100} value={item.percent} aria-label={item.name} />
            <p className="mt-1 text-xs text-muted-foreground">{brl(item.value)}</p>
          </li>)}</ul>}
        </section>}
        {onViewAlliances && <Button variant="ghost" className="mt-auto justify-start border-t pt-5 text-sky-600 dark:text-sky-300" onClick={onViewAlliances}>Ver minhas alianças →</Button>}
      </section>}
    </div>
    <p className="text-xs text-muted-foreground">Histórico de observações registradas, sem reconstrução de valores anteriores. Carteiras com composição ou participação diferentes iniciam uma nova série.</p>
  </div>;
}
