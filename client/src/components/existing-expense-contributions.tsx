import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { existingExpenseProblem, previewExistingExpense, type ExistingExpenseMode, type ExistingExpenseUnit } from '@shared/existing-expense-contributions';
import { defaultContributionReminders } from '@shared/contribution-reminders';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { DropdownMenuItem } from './ui/dropdown-menu';
import { SearchableNameSelect } from './searchable-name-select';
import { ExpenseContributionLinks, ExpenseContributionPreview } from './expense-contributions';
import { ContributionReminderFields, saveContributionReminders } from './contribution-reminders';
import { prepareFlowPayment } from './contribution-payment';

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
async function request(method: string, url: string, body?: unknown) {
  const response = await fetch(url, { method, credentials: 'include', signal: AbortSignal.timeout(45000), headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível concluir esta operação.'), { retry: data.retry === true, status: response.status });
  return data;
}
export function ExistingExpenseAction({ entry, onOpen, menu = false }: { entry: any; onOpen: () => void; menu?: boolean }) {
  const links = useQuery<any>({ queryKey: ['expense-links', entry?.id], enabled: !!entry?.id && entry.tipo === 'saida',
    queryFn: () => request('GET', `/api/fluxo-caixa/${encodeURIComponent(entry.id)}/vinculos`) });
  if (!entry || entry.tipo !== 'saida' || (!links.data && !links.isPending && existingExpenseProblem(entry))) return null;
  const label = links.isPending ? 'Consultando aportes…' : links.data ? 'Ver aportes' : 'Gerar aportes';
  return menu ? <DropdownMenuItem disabled={links.isPending} onSelect={onOpen}>{label}</DropdownMenuItem>
    : <Button type="button" variant="outline" disabled={links.isPending} onClick={onOpen}>{label}</Button>;
}

function ExistingExpenseForm({ flowId, biaId, userId, onPayment }: { flowId: string; biaId: string; userId: string; onPayment: (id: string) => void }) {
  const url = `/api/fluxo-caixa/${encodeURIComponent(flowId)}/aportes`;
  const key = `existing-expense-funding:${userId}:${biaId}:${flowId}`;
  const [mode, setMode] = useState<ExistingExpenseMode>('manual');
  const [unit, setUnit] = useState<ExistingExpenseUnit>('valor');
  const [rows, setRows] = useState<{ memberId: string; value: string }[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [pending, setPending] = useState<any>(() => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } });
  const [emitPayment, setEmitPayment] = useState(false);
  const [reminders, setReminders] = useState(defaultContributionReminders);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [created, setCreated] = useState<any[] | null>(null);
  const context = useQuery<any>({ queryKey: ['existing-expense', flowId], queryFn: () => request('GET', url), retry: false });
  const ctx = context.data;
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['/api/fluxo-caixa'] }); void queryClient.invalidateQueries({ queryKey: ['expense-links'] }); };
  const refresh = () => { setPreview(null); review.reset(); void context.refetch(); };
  const change = (work: () => void) => { work(); setPreview(null); review.reset(); };
  const input = () => ({ mode, unit, participants: rows.map(r => ({ memberId: r.memberId, ...(mode === 'manual' ? { value: number(r.value) } : {}) })),
    dueDate: dueDate || ctx.expense.data_vencimento, sourceVersion: ctx.sourceVersion, mapVersion: mode === 'map' ? ctx.mapVersion : null });
  const review = useMutation({ mutationFn: async () => {
    const value = input(); const result = await request('POST', url + '/previa', value);
    return { ...value, expected: result.expected };
  }, onSuccess: setPreview });
  const confirm = useMutation({ mutationFn: async () => {
    const saved = pending || (ctx.resumeRequest ? { request: ctx.resumeRequest, emitPayment: false, reminders: defaultContributionReminders } :
      { request: { ...preview, requestId: crypto.randomUUID() }, emitPayment, reminders });
    sessionStorage.setItem(key, JSON.stringify(saved)); setPending(saved);
    const result = await request('POST', url, saved.request);
    // Financial creation is durable. External follow-ups must never recreate the lot.
    sessionStorage.removeItem(key); setPending(null);
    const entries = result.movimentos.filter((m: any) => m.tipo === 'entrada');
    const notices: string[] = [];
    for (const entry of entries) {
      if (saved.reminders.enabled) try { await saveContributionReminders(biaId, entry.id, saved.reminders); }
      catch { notices.push('Aportes gerados; alguns lembretes não foram configurados. Use Lembretes do aporte no lançamento.'); }
      if (saved.emitPayment) try { await prepareFlowPayment(biaId, entry.id); }
      catch { notices.push('Aportes gerados; algumas cobranças não foram emitidas. Use Pix e boleto do aporte no lançamento.'); }
    }
    setWarnings([...new Set(notices)]); return entries;
  }, onSuccess: entries => { setCreated(entries); invalidate(); void context.refetch(); }, onError: (error: any) => {
    if (error.status && !error.retry) { sessionStorage.removeItem(key); setPending(null); setPreview(null); void context.refetch(); invalidate(); }
  } });
  const busy = review.isPending || confirm.isPending;
  let localPreview: { memberId: string; amount: number }[] = [], localError = '';
  if (ctx?.expense && rows.length) try {
    localPreview = previewExistingExpense(ctx.expense.valor, mode, unit, input().participants, ctx.participants.map((p: any) => ({ memberId: p.memberId, percent: p.percent })));
  } catch (error: any) { localError = error.message; }
  if (context.isPending) return <p role="status">Consultando despesa e participantes…</p>;
  if (context.isError) return <div role="alert"><p>{context.error.message}</p><Button variant="outline" onClick={() => context.refetch()}>Tentar novamente</Button></div>;
  if (created || (ctx.linked && ctx.state === 'concluido')) return <div className="space-y-3">
    {created && <p role="status">Aportes gerados. A despesa original foi preservada.</p>}
    <ExpenseContributionLinks flowId={flowId} />
    {warnings.map(text => <p key={text} role="alert" className="text-sm text-amber-600">{text}</p>)}
    {created?.map(entry => <Button key={entry.id} variant="outline" onClick={() => onPayment(entry.id)}>Pix e boleto · {money(Number(entry.valor))}</Button>)}
  </div>;
  if (pending || ctx.linked) return <div className="space-y-3"><ExpenseContributionLinks flowId={flowId} />
    <p>{confirm.isPending ? 'Gerando os aportes…' : 'Retome a solicitação salva para concluir os mesmos aportes.'}</p>
    {(pending || ctx.resumeRequest) && <Button loading={confirm.isPending} loadingText="Gerando…" onClick={() => confirm.mutate()}>Retomar geração</Button>}
    {confirm.isError && <p role="alert" className="text-destructive">{confirm.error.message}</p>}
  </div>;
  if (ctx.problem) return <p role="alert">{ctx.problem}</p>;
  const labels = new Map<string, string>(ctx.participants.map((p: any) => [p.memberId, p.label]));
  return <div className="space-y-4">
    <div className="rounded-lg border p-3"><p className="font-semibold break-words">{ctx.expense.descricao}</p><p>{money(ctx.expense.valor)} · {ctx.expense.status}</p></div>
    <fieldset disabled={busy} className="space-y-4 min-w-0">
      <Label htmlFor="existing-expense-mode">Divisão dos aportes</Label>
      <select id="existing-expense-mode" className="w-full rounded-md border bg-background p-2" value={mode} onChange={e => change(() => {
        const next = e.target.value as ExistingExpenseMode; setMode(next);
        if (next === 'map') { setUnit('percentual'); setRows(ctx.participants.filter((p: any) => p.percent > 0).map((p: any) => ({ memberId: p.memberId, value: String(p.percent).replace('.', ',') }))); }
      })}>
        <option value="manual">Definir a parte de cada um</option><option value="map" disabled={!ctx.mapAvailable}>Usar o MAP</option>
      </select>
      {!ctx.mapAvailable && <p className="text-sm text-muted-foreground">MAP indisponível. Você pode definir a divisão manualmente.</p>}
      {mode === 'manual' && <><Label htmlFor="existing-expense-unit">Informar por</Label><select id="existing-expense-unit" className="w-full rounded-md border bg-background p-2" value={unit} onChange={e => change(() => { setUnit(e.target.value as ExistingExpenseUnit); setRows(rows.map(r => ({ ...r, value: '' }))); })}><option value="valor">Valor (R$)</option><option value="percentual">Percentual (%)</option></select></>}
      {rows.map((row, i) => <div className="space-y-2 rounded-lg border p-3 min-w-0" key={i}>
        {mode === 'manual' ? <SearchableNameSelect ariaLabel={`Participante ${i + 1}`} value={row.memberId} options={ctx.participants.map((p: any) => ({ value: p.memberId, label: p.label }))} onValueChange={memberId => change(() => setRows(rows.map((r, j) => j === i ? { ...r, memberId } : r)))} /> : <p>{labels.get(row.memberId)} · {number(row.value).toLocaleString('pt-BR', { maximumFractionDigits: 5 })}%</p>}
        {mode === 'manual' && <><Input inputMode="decimal" aria-label={`Parte do participante ${i + 1}`} placeholder={unit === 'valor' ? '0,00' : '0,00%'} value={row.value} onChange={e => change(() => setRows(rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r)))} /><Button type="button" variant="ghost" size="sm" onClick={() => change(() => setRows(rows.filter((_, j) => j !== i)))}>Remover participante</Button></>}
      </div>)}
      {mode === 'manual' && <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => change(() => setRows([...rows, { memberId: '', value: '' }]))}>Adicionar participante</Button>}
      <div className="space-y-2"><Label htmlFor="existing-expense-due">Vencimento dos aportes</Label><Input id="existing-expense-due" type="date" value={dueDate || ctx.expense.data_vencimento} onChange={e => change(() => setDueDate(e.target.value))} /></div>
      <ExpenseContributionPreview amount={ctx.expense.valor} preview={localPreview} error={localError} percentages options={ctx.participants.map((p: any) => ({ value: p.memberId, label: p.label }))} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={emitPayment} disabled={busy} onCheckedChange={v => setEmitPayment(v === true)} />Emitir Pix e boleto para os aportes em dinheiro</label>
      <ContributionReminderFields value={reminders} onChange={setReminders} disabled={busy} />
    </fieldset>
    {review.isError && <div role="alert" className="space-y-2"><p className="text-destructive">{review.error.message}</p><Button variant="outline" onClick={refresh}>Atualizar dados</Button></div>}
    {confirm.isError && <p role="alert" className="text-destructive">{confirm.error.message}</p>}
    {preview ? <Button className="w-full" loading={confirm.isPending} loadingText="Gerando…" disabled={busy || (reminders.enabled && !reminders.month && !reminders.week && !reminders.day)} onClick={() => confirm.mutate()}>Confirmar e gerar aportes</Button>
      : <Button className="w-full" loading={review.isPending} loadingText="Conferindo…" disabled={busy || !rows.length || !!localError} onClick={() => review.mutate()}>Conferir divisão</Button>}
  </div>;
}
export function ExistingExpenseDialog({ flowId, biaId, userId, onClose, onPayment }: { flowId: string | null; biaId: string; userId: string; onClose: () => void; onPayment: (id: string) => void }) {
  return <Dialog open={!!flowId} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Aportes da despesa</DialogTitle></DialogHeader>
    {flowId && <ExistingExpenseForm key={flowId} flowId={flowId} biaId={biaId} userId={userId} onPayment={onPayment} />}
  </DialogContent></Dialog>;
}
