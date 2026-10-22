import type { PortfolioDashboard, PortfolioMetric, PortfolioObservation } from "@shared/portfolio-dashboard";

const brl = (value: number | null) => value == null ? "Dados insuficientes" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
function ValueCard({ title, metric, range, detail }: { title: string; metric: PortfolioMetric; range?: { min: number | null; max: number | null }; detail: string }) {
  return <section className="min-w-0 rounded-xl border bg-card p-5">
    <h3 className="text-sm text-muted-foreground">{title}</h3>
    <p className="mt-3 break-words text-xl font-semibold tabular-nums">{range ? range.min == null || range.max == null ? "Sem estimativa" : `${brl(range.min)} a ${brl(range.max)}` : brl(metric.value)}</p>
    {metric.partial && <p className="sr-only">Parcial · {metric.included} de {metric.total} com dados</p>}
    <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
  </section>;
}

export function PatrimonyChart({ observations, kind }: { observations: PortfolioObservation[]; kind: "properties" | "cpps" }) {
  const title = kind === "properties" ? "Evolução dos imóveis próprios" : "Evolução das CPPs";
  const values = observations.map(o => ({ day: o.day, base: kind === "properties" ? o.metrics.acquisition : o.metrics.cppBase,
    estimate: kind === "properties" ? o.metrics.propertyEstimate : o.metrics.cppEstimate }));
  const numbers = values.flatMap(v => [v.base.value, v.estimate.value]).filter((v): v is number => v != null && Number.isFinite(v));
  const low = Math.min(0, ...numbers), high = Math.max(1, ...numbers), width = 620, height = 200;
  const first = values.length ? Date.parse(values[0].day) : 0;
  const last = values.length ? Date.parse(values[values.length - 1].day) : 0;
  const x = (day: string) => first === last ? width / 2 : 8 + (Date.parse(day) - first) / (last - first) * (width - 16);
  const y = (v: number) => 10 + (high - v) / (high - low) * (height - 20);
  const date = (day: string) => day.split("-").reverse().join("/");
  const baseLabel = kind === "properties" ? "Aquisição" : "Valor-base das CPPs";
  return <section className="min-w-0 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">{title}</h3>
    {!values.length ? <p className="mt-5 text-sm text-muted-foreground">Sem observações registradas.</p> : <>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs"><span className="text-blue-700 dark:text-blue-300">● {baseLabel}</span><span className="text-emerald-700 dark:text-emerald-300">● Estimativa{kind === "properties" ? " central" : ""}</span></div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>{brl(high)}</span><span>{values.length === 1 ? "Primeira observação" : `${values.length} observações`}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full text-border" role="img" aria-label={`${title}. Valores detalhados na tabela abaixo.`}>
        <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="currentColor" />
        {(["base", "estimate"] as const).map((key, k) => <g key={key} stroke={k === 0 ? "#60a5fa" : "#34d399"} fill={k === 0 ? "#60a5fa" : "#34d399"}>
          {values.map((value, i) => {
            const amount = value[key].value, previous = values[i - 1];
            if (amount == null) return null;
            return <g key={value.day}>
              {previous?.[key].value != null && <line x1={x(previous.day)} y1={y(previous[key].value!)} x2={x(value.day)} y2={y(amount)} strokeWidth="2" strokeDasharray={value[key].partial || previous[key].partial ? "5 4" : undefined} />}
              <circle cx={x(value.day)} cy={y(amount)} r="4"><title>{`${date(value.day)} · ${key === "base" ? baseLabel : "Estimativa"}: ${brl(amount)}${value[key].partial ? " (parcial)" : ""}`}</title></circle>
            </g>;
          })}
        </g>)}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{date(values[0].day)}</span>{values.length > 1 && <span>{date(values[values.length - 1].day)}</span>}</div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Ver valores e faixas</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Data</th><th className="p-2">{baseLabel}</th><th className="p-2">Estimativa</th></tr></thead><tbody>{values.map(v => <tr key={v.day} className="border-t"><td className="p-2">{date(v.day)}</td><td className="p-2">{brl(v.base.value)}{v.base.partial ? " · parcial" : ""}</td><td className="p-2">{kind === "properties" && "min" in v.estimate && "max" in v.estimate ? `${brl(v.estimate.min as number | null)} a ${brl(v.estimate.max as number | null)}` : brl(v.estimate.value)}{v.estimate.partial ? " · parcial" : ""}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}

export function PortfolioPatrimonyDashboard({ metrics, observations, historyError, historyLoading }: { metrics: PortfolioDashboard; observations: PortfolioObservation[]; historyError?: string; historyLoading?: boolean }) {
  return <div className="space-y-4" data-testid="portfolio-patrimony-dashboard">
    <div className="grid gap-3 sm:grid-cols-2">
      <ValueCard title="Valor total de aquisição dos imóveis próprios" metric={metrics.acquisition} detail="Proporcional à sua propriedade, sem somar CPPs." />
      <ValueCard title="Valor total atualizado estimado dos imóveis próprios" metric={metrics.propertyEstimate} range={metrics.propertyEstimate} detail={metrics.propertyEstimate.indicative ? "Faixa indicativa por IA · não é laudo." : "Faixa por anúncios comparáveis em até 10 km · pesquisa válida por 30 dias."} />
      <ValueCard title="Valor total de CPPs em alianças" metric={metrics.cppBase} detail="Valor-base das suas CPPs no MAP vigente; não significa dinheiro já pago." />
      <ValueCard title="Valor total atualizado estimado das CPPs" metric={metrics.cppEstimate} detail="Sua participação no patrimônio registrado das BIAs pelo MAP vigente." />
    </div>
    {historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p> : historyLoading ? <p role="status" className="text-sm text-muted-foreground">Carregando evolução…</p> : <>
      <div className="grid gap-3 lg:grid-cols-2"><PatrimonyChart observations={observations} kind="properties" /><PatrimonyChart observations={observations} kind="cpps" /></div>
      <p className="text-xs text-muted-foreground">Histórico de observações registradas, sem reconstrução de valores anteriores. Carteiras com composição ou participação diferentes iniciam uma nova série.</p>
    </>}
  </div>;
}
