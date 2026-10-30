import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { portfolioComposition, type CompositionProperty, type CompositionSlice } from "@shared/portfolio-composition";
const colors = ["#22d3ee", "#3b82f6", "#8b5cf6", "#64748b", "#f59e0b", "#10b981", "#ec4899", "#94a3b8"];
function CompositionChart({ title, slices, total }: { title: string; slices: CompositionSlice[]; total: number }) {
  return <section className="min-w-0 rounded-xl border bg-card p-4" aria-label={title}>
    <h3 className="font-semibold">{title}</h3>
    {!total ? <p className="py-8 text-sm text-muted-foreground">Nenhum imóvel cadastrado.</p> : <>
      <div className="mx-auto h-40 w-full max-w-48" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="value" nameKey="name" innerRadius={44} outerRadius={65} paddingAngle={2} isAnimationActive={false}>{slices.map((s,i) => <Cell key={s.name} fill={colors[i % colors.length]} stroke="none" />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
      <ul className="space-y-2 text-xs">{slices.map((s,i) => <li key={s.name} className="flex items-start gap-2"><span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor: colors[i % colors.length]}} /><span className="min-w-0 flex-1 break-words">{s.name}</span><span className="shrink-0 tabular-nums">{s.value} · {s.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Por quantidade de imóveis</p>
    </>}
  </section>;
}
export function PortfolioComposition({ properties }: { properties: CompositionProperty[] }) {
  const data = portfolioComposition(properties);
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2"><CompositionChart title="Ocupação" slices={data.occupancy} total={data.total} /><CompositionChart title="Tipo de imóvel" slices={data.types} total={data.total} /></div>;
}
