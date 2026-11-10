import { useLocale } from "@/components/preferences-provider";
import { biaCardIndicators, type BiaIndicatorSource } from "@shared/bia-card-indicators";
export function BiaCardIndicators({bia}: {bia: BiaIndicatorSource & {moeda?: string | null}}) {
const { t, language } = useLocale();
const {thesis, metrics, period} = biaCardIndicators(bia);
let currency = bia.moeda || "BRL";
try { new Intl.NumberFormat(language, {style:"currency", currency}); } catch { currency = "BRL"; }
return <div className="min-w-0 space-y-3 lg:max-w-[440px] lg:flex-[1.3] xl:max-w-[500px]">
<p className="text-xs font-medium text-foreground">{t(thesis)}</p>
<dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
{metrics.map(metric => <div key={metric.label} className="min-w-0">
<dt className="text-xs text-muted-foreground">{t(metric.label)}</dt>
<dd className="mt-1 break-words text-sm font-semibold text-foreground">{metric.value === null ? "Não informado" : typeof metric.value === 'string' ? metric.value : metric.kind === 'percent' ? `${new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2}).format(metric.value)}%` : new Intl.NumberFormat(language, {style:"currency", currency}).format(metric.value)}</dd>
</div>)}
</dl>{period && <p className="text-xs text-muted-foreground">Referência: {period.split('-').reverse().join('/')}</p>}</div>;
}
