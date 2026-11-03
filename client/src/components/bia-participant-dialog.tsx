import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { UserRound, ArrowUpRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { getMembroUrl } from '../lib/public-refs';
import { BIA_PARTICIPANT_ROLE_LABELS } from '../../../shared/bia-access';
import type { OrganizationMember, OrganizationPerson } from '../../../shared/bia-organization';
import { participantContributionAreas, participantEntries, type ParticipantEntry } from '../../../shared/bia-participant-detail';

type Props = {
  biaId: string; biaName: string; currency?: string; person: OrganizationPerson; name: string;
  member?: OrganizationMember; canViewFinancial: boolean; onClose: () => void; restoreFocus: () => void;
};
type CurrentMap = { atual: Array<{ memberId: string; value: number; percent: number }> };

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 403 ? 'Seu acesso financeiro a esta BIA não está disponível.' : 'Não foi possível carregar estas informações.');
  return response.json();
}
const statusLabels: Record<string, string> = { pago:'Pago', parcial:'Parcialmente pago', pendente:'Pendente', agendado:'Agendado', vencido:'Vencido', cancelado:'Cancelado' };
const dateLabel = (value?: string | null) => {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Sem data';
};

export function BiaParticipantDialog({ biaId, biaName, currency = 'BRL', person, name, member, canViewFinancial, onClose, restoreFocus }: Props) {
  const [limit, setLimit] = useState(10);
  const flows = useQuery<ParticipantEntry[]>({
    queryKey: ['/api/fluxo-caixa', biaId],
    queryFn: () => read(`/api/fluxo-caixa?bia_id=${encodeURIComponent(biaId)}`),
    enabled: canViewFinancial && !!biaId, retry: false, staleTime: 0, refetchOnMount: 'always',
  });
  const map = useQuery<CurrentMap>({
    queryKey: ['/api/bias', biaId, 'map'], queryFn: () => read(`/api/bias/${encodeURIComponent(biaId)}/map`),
    enabled: canViewFinancial && !!biaId, retry: false, staleTime: 0, refetchOnMount: 'always',
  });
  const entries = canViewFinancial && !flows.isError ? participantEntries(flows.data || [], biaId, person.id) : [];
  const allocation = canViewFinancial && !map.isError ? map.data?.atual.find(row => row.memberId === person.id) : undefined;
  const areas = participantContributionAreas(member);
  const money = (value: number | string) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency }) : 'Não informado';
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-2xl rounded-xl" data-testid="bia-participant-dialog" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
      <DialogHeader className="pr-7 text-left">
        <div className="mb-2 flex items-center gap-3"><span className="rounded-full bg-primary/10 p-3 text-primary"><UserRound size={22}/></span><DialogTitle className="min-w-0 break-words text-xl">{name}</DialogTitle></div>
        <DialogDescription className="break-words">Participação em {biaName}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">{person.roles.map(role => <span key={role} className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">{BIA_PARTICIPANT_ROLE_LABELS[role]}</span>)}</div>
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold">Áreas de contribuição</h3>
        {areas.length ? <div className="flex flex-wrap gap-2">{areas.map(area => <span key={area} className="rounded-md bg-primary/10 px-2 py-1 text-sm text-foreground">{area}</span>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma área informada no perfil.</p>}
        {person.activity.length > 0 && <p className="break-words text-sm text-muted-foreground">{person.activity.join(' · ')}</p>}
      </section>
      {!canViewFinancial ? <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Você não tem acesso aos dados financeiros desta BIA.</p> : <>
        <section className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-semibold">Participação no MAP atual</h3>
          {map.isLoading ? <Loading/> : map.isError ? <Failure retry={() => void map.refetch()}/> : allocation ? <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">CPPs no MAP</dt><dd className="mt-1 break-words text-lg font-semibold">{money(allocation.value)}</dd></div><div><dt className="text-sm text-muted-foreground">Participação</dt><dd className="mt-1 text-lg font-semibold">{allocation.percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</dd></div></dl> : <p className="text-sm text-muted-foreground">Sem participação registrada no MAP atual.</p>}
        </section>
        <section className="min-w-0 space-y-3">
          <h3 className="font-semibold">Lançamentos nesta BIA{!flows.isLoading && !flows.isError && ` (${entries.length})`}</h3>
          {flows.isLoading ? <Loading/> : flows.isError ? <Failure retry={() => void flows.refetch()}/> : !entries.length ? <p className="text-sm text-muted-foreground">Nenhum lançamento vinculado a este participante.</p> : <>
            <ul className="space-y-2">{entries.slice(0, limit).map(entry => <li key={entry.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 break-words text-sm font-medium">{entry.descricao || 'Sem descrição'}</p><strong className={`text-sm ${entry.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{entry.tipo === 'entrada' ? '+' : '−'}{money(entry.valor)}</strong></div>
              <p className="text-xs text-muted-foreground">{entry.tipo === 'entrada' ? 'Entrada' : 'Saída'} · {statusLabels[entry.status || ''] || 'Status não informado'} · {entry.data_vencimento ? 'Vencimento' : 'Data'}: {dateLabel(entry.data_vencimento || entry.data)}</p>
              <div className="flex flex-wrap gap-2 text-xs">{entry.beneficiary && <span className="rounded bg-muted px-2 py-1">Favorecido</span>}{entry.responsible && <span className="rounded bg-muted px-2 py-1">Responsável pelo lançamento</span>}{entry.natureza && entry.natureza !== 'caixa' && <span className="rounded bg-muted px-2 py-1">Não caixa</span>}{entry.conciliacao_pendente && <span className="rounded bg-muted px-2 py-1">Conciliação pendente</span>}</div>
            </li>)}</ul>
            {entries.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(value => value + 10)}>Mostrar mais lançamentos</Button>}
          </>}
        </section>
      </>}
      <DialogFooter className="sticky -bottom-4 border-t border-border bg-background pb-4 pt-3 sm:-bottom-6 sm:pb-6">
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        {member ? <Button asChild><Link href={getMembroUrl(member)}>Ver perfil <ArrowUpRight className="ml-2 h-4 w-4"/></Link></Button> : <span className="self-center text-sm text-muted-foreground">Perfil indisponível</span>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
function Loading() { return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Carregando...</p>; }
function Failure({ retry }: { retry: () => void }) { return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">Não foi possível carregar estas informações.</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>; }
