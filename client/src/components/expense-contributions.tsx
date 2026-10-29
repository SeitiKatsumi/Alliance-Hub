import { useQuery } from "@tanstack/react-query";
import { splitExpense, type ExpenseSplitMode } from "@shared/expense-contributions";
import { expensePercent } from '@shared/existing-expense-contributions';
import { SearchableNameSelect } from "./searchable-name-select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export type ExpenseFunding = { mode: ExpenseSplitMode; participants: { memberId: string; value: string }[]; dueDate: string; cppType: string };
export const emptyExpenseFunding = (): ExpenseFunding => ({ mode: "equal", participants: [], dueDate: "", cppType: "" });
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fundingParticipants = (value: ExpenseFunding) => value.participants.map(p => ({ memberId: p.memberId, value: Number(p.value.replace(/\./g, "").replace(",", ".")) }));

export function ExpenseContributionPreview({ amount, preview, error, options, percentages = false }: {
  amount: number; preview: ReturnType<typeof splitExpense>; error?: string;
  options: { value: string; label: string }[]; percentages?: boolean;
}) {
  return <div aria-live="polite" className="space-y-1 border-t pt-3 text-sm">
    <p className="font-semibold">Despesa: {money(amount || 0)}</p>
    {error ? <p className="text-destructive">{error}</p> : preview.map(p => <p key={p.memberId}>
      {options.find(o => o.value === p.memberId)?.label || p.memberId}: {money(p.amount)}
      {percentages && amount > 0 && ` · ${expensePercent(p.amount / amount * 100)}%`}
    </p>)}
    {!error && <p className="font-semibold">Total de aportes: {money(preview.reduce((n, p) => n + p.amount, 0))}</p>}
  </div>;
}

export function ExpenseContributionsFields({ value, onChange, amount, dueDate, options, map, cppOptions, inheritedPreview }: {
  value: ExpenseFunding; onChange: (value: ExpenseFunding) => void; amount: number; dueDate: string;
  options: { value: string; label: string }[]; map: { memberId: string; percent: number }[]; cppOptions: { value: string; label: string }[];
  inheritedPreview?: () => ReturnType<typeof splitExpense>;
}) {
  let preview: ReturnType<typeof splitExpense> = [], error = "";
  try { preview = inheritedPreview ? inheritedPreview() : splitExpense(amount, value.mode, fundingParticipants(value), map); } catch (e: any) { error = e.message; }
  return <section className="min-w-0 space-y-3 rounded-lg border bg-card p-3" aria-label="Aportes para a despesa">
    <h3 className="font-semibold">Aportes para esta despesa</h3>
    {!inheritedPreview && <><Label>Divisão dos aportes</Label>
    <Select value={value.mode} onValueChange={mode => onChange({ ...value, mode: mode as ExpenseSplitMode })}>
      <SelectTrigger aria-label="Divisão dos aportes"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="equal">Dividir igualmente</SelectItem><SelectItem value="map">Percentuais do MAP atual</SelectItem><SelectItem value="manual">Valores manuais</SelectItem></SelectContent>
    </Select>
    {value.mode === "map" && <><p className="text-sm text-muted-foreground">Proporcional à participação dos selecionados no MAP atual.</p><Button type="button" variant="outline" disabled={!map.length} onClick={() => onChange({ ...value, participants: map.filter(m => m.percent > 0).map(m => ({ memberId: m.memberId, value: "" })) })}>Selecionar participantes do MAP</Button></>}
    {value.participants.map((p, i) => <div key={i} className="min-w-0 space-y-2 rounded border p-2">
      <SearchableNameSelect value={p.memberId} options={options} ariaLabel={`Participante ${i + 1}`} onValueChange={memberId => onChange({ ...value, participants: value.participants.map((item, j) => j === i ? { ...item, memberId } : item) })} />
      {value.mode === "manual" && <Input aria-label={`Valor do aporte ${i + 1}`} inputMode="decimal" placeholder="0,00" value={p.value} onChange={e => onChange({ ...value, participants: value.participants.map((item, j) => j === i ? { ...item, value: e.target.value } : item) })} />}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, participants: value.participants.filter((_, j) => j !== i) })}>Remover participante</Button>
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange({ ...value, participants: [...value.participants, { memberId: "", value: "" }] })}>Adicionar participante</Button>
    </>}
    <div className="space-y-2"><Label htmlFor="funding-due-date">Vencimento dos aportes</Label><Input id="funding-due-date" type="date" value={value.dueDate || dueDate} onChange={e => onChange({ ...value, dueDate: e.target.value })} /></div>
    {!inheritedPreview && <div className="space-y-2"><Label>Tipo de CPP dos aportes</Label><SearchableNameSelect ariaLabel="Tipo de CPP dos aportes" value={value.cppType || "__none__"} options={[{ value: "__none__", label: "Nenhum", pinned: true }, ...cppOptions]} onValueChange={cppType => onChange({ ...value, cppType: cppType === "__none__" ? "" : cppType })} /></div>}
    <ExpenseContributionPreview amount={amount} preview={preview} error={error} options={options} />
  </section>;
}

export function ExpenseContributionLinks({ flowId, onOpen }: { flowId?: string; onOpen?: (id: string) => void }) {
  const query = useQuery<any>({ queryKey: ["expense-links", flowId], enabled: !!flowId, queryFn: async () => {
    const response = await fetch(`/api/fluxo-caixa/${encodeURIComponent(flowId!)}/vinculos`, { credentials: "include" });
    if (!response.ok) throw new Error("Vínculos indisponíveis"); return response.json();
  } });
  if (!flowId) return null;
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Consultando vínculos…</p>;
  if (query.isError) return <Button variant="outline" onClick={() => query.refetch()}>Tentar consultar vínculos novamente</Button>;
  if (!query.data) return null;
  return <section className="space-y-2 rounded-lg border bg-card p-3"><h3 className="font-semibold">{query.data.despesaId === flowId ? "Aportes vinculados à despesa" : "Despesa de origem e aportes"}</h3>
    {query.data.estado !== "concluido" && <p className="text-sm text-destructive">Criação pendente de conclusão.</p>}
    {query.data.movimentos.map((m: any) => <div key={m.id} className="break-words border-t pt-2 text-sm"><p>{m.tipo === "saida" ? "Despesa" : "Aporte"}: {m.descricao}</p>{m.participante && <p>{m.participante}</p>}<p>{money(Number(m.valor))} · {m.status}</p>{m.id !== flowId && onOpen && <Button size="sm" variant="ghost" onClick={() => onOpen(m.id)}>Consultar lançamento</Button>}</div>)}
  </section>;
}
