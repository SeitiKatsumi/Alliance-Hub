import { monthIndex } from "@shared/bia-payment-plan";
import type { BiaOffer } from "@shared/bia-offer";
import { paymentsPerQuota } from "@/lib/oba-offer-payment";

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const formatMonth = (month: string) => monthFormat.format(new Date(`${month}-01T00:00:00Z`)).replace(". de ", "/");
const periods: Record<number, string> = { 1: "mensal", 2: "bimestral", 3: "trimestral", 6: "semestral", 12: "anual" };

type Payment = ReturnType<typeof paymentsPerQuota>[number];

export function ObaOfferPayment({ offer }: { offer: BiaOffer }) {
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: offer.moeda });
  const payments = paymentsPerQuota(offer.quotas);
  const blocks: Payment[][] = [];
  for (const payment of payments) {
    const last = blocks.at(-1);
    if (last?.[0].bloco === payment.bloco) last.push(payment);
    else blocks.push([payment]);
  }
  const formatRange = (min: number, max: number) => min === max
    ? money.format(min / 100)
    : `${money.format(min / 100)} a ${money.format(max / 100)}`;
  return <>
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="font-semibold">Quanto custa uma cota</h2>
      <p className="text-2xl font-bold tabular-nums">{money.format(offer.valorOrigem / offer.totalQuotas)}</p>
      <p className="text-sm text-muted-foreground">Valor de referência por cota inicial</p>
      <dl className="divide-y text-sm">
        <div className="flex items-baseline justify-between gap-3 py-2"><dt>Valor de origem da BIA</dt><dd className="text-right font-semibold">{money.format(offer.valorOrigem)}</dd></div>
        <div className="flex items-baseline justify-between gap-3 py-2"><dt>Total de cotas iniciais</dt><dd className="font-semibold">{offer.totalQuotas}</dd></div>
        {offer.correcao && <div className="flex items-baseline justify-between gap-3 py-2"><dt>Correção das parcelas</dt><dd className="text-right font-semibold">{offer.correcao}</dd></div>}
      </dl>
    </section>
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="font-semibold">Como você paga por cota</h2>
      {payments.length === 0 ? <p className="text-sm text-muted-foreground">Condições de pagamento a definir.</p> : <>
        <ol className="ml-2 space-y-4 border-l pl-4">
          {blocks.map((block, index) => {
            const first = block[0];
            const last = block.at(-1)!;
            const min = Math.min(...block.map(payment => payment.min));
            const max = Math.max(...block.map(payment => payment.max));
            const interval = block.length > 1 ? monthIndex(block[1].mes) - monthIndex(first.mes) : 0;
            const period = block.every((payment, i) => monthIndex(payment.mes) === monthIndex(first.mes) + i * interval)
              ? periods[interval] : undefined;
            const dates = first.mes === last.mes ? `em ${formatMonth(first.mes)}` : `de ${formatMonth(first.mes)} a ${formatMonth(last.mes)}`;
            return <li key={`${first.mes}-${index}`} className="relative text-sm">
              <span aria-hidden="true" className="absolute -left-[1.375rem] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
              <strong className="tabular-nums">{block.length > 1 && `${block.length} × `}{formatRange(min, max)}</strong>
              <p className="text-muted-foreground">{first.bloco} · {dates}{period && `, ${period}`}</p>
            </li>;
          })}
        </ol>
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer font-medium">Ver os {payments.length} pagamentos por cota</summary>
          <table className="mt-2 w-full table-fixed text-sm">
            <thead><tr className="border-b text-left"><th scope="col" className="w-[20%] py-1">Mês</th><th scope="col">Bloco</th><th scope="col" className="w-[40%] text-right">Valor por cota</th></tr></thead>
            <tbody>{payments.map((row, index) => <tr key={index} className="border-b align-top">
              <td className="py-2">{formatMonth(row.mes)}</td><td className="break-words py-2 pr-2">{row.bloco}</td>
              <td className="py-2 text-right tabular-nums">{formatRange(row.min, row.max)}</td>
            </tr>)}</tbody>
          </table>
        </details>
      </>}
    </section>
  </>;
}
