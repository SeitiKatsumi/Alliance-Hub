import { portfolioPropertyBreakdown, type PortfolioProperty } from "@shared/portfolio-dashboard";

export function PortfolioValuationBreakdown({ properties }: { properties: PortfolioProperty[] }) {
  const rows = portfolioPropertyBreakdown(properties);
  const money = (n: number | null) => n == null ? "Pendente" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  return <details className="min-w-0 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Como chegamos aos valores</summary>
    <div className="mt-3 space-y-3">{rows.length ? rows.map(row => <div key={row.id} className="space-y-1 border-t pt-3">
      <a href={`/carteira/${encodeURIComponent(row.id)}?tab=analise`} className="block break-words font-medium text-sky-700 dark:text-sky-300">{row.nome}</a>
      <p className="text-xs text-muted-foreground">Sua participação: {row.share.toLocaleString("pt-BR")}% · Valores proporcionais em reais</p>
      <div className="flex flex-wrap justify-between gap-2"><span>Aquisição: {money(row.acquisition)}</span><span>Avaliação: {money(row.estimate)}</span></div>
    </div>) : <p className="text-muted-foreground">Nenhum imóvel próprio a somar.</p>}</div>
  </details>;
}
