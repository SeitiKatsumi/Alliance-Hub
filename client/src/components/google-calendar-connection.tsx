import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, RefreshCw, Unplug } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface GoogleCalendarEntry {
  id: string; titulo: string; descricao: string; data: string; hora: string | null;
  status: 'pendente'; prioridade: 'media'; google_url: string; google_event: true;
}
interface ConnectionStatus { ready: boolean; connected: boolean; reconnect: boolean; email: string | null; timeZone: string | null; lastSync: string | null; message: string | null }
export function GoogleCalendarConnection({ from, to, onEventsChange, compact = false }: { from: string; to: string; onEventsChange: (entries: GoogleCalendarEntry[]) => void; compact?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const status = useQuery<ConnectionStatus>({ queryKey: ['/api/agenda/google/status'], refetchInterval: 60000 });
  const connected = !!status.data?.connected;
  const events = useQuery<{ entries: GoogleCalendarEntry[]; partial: boolean }>({
    queryKey: ['/api/agenda/google/events', from, to], enabled: connected && !status.data?.reconnect && status.data?.ready,
    refetchInterval: 5 * 60000,
    queryFn: async () => { const response = await apiRequest('GET', `/api/agenda/google/events?${new URLSearchParams({ from, to })}`); return response.json(); },
  });
  useEffect(() => { onEventsChange(connected ? events.data?.entries || [] : []); }, [connected, events.data, onEventsChange]);
  useEffect(() => {
    const url = new URL(window.location.href), result = url.searchParams.get('google');
    if (!result) return;
    if (compact) setOpen(true);
    toast({ title: result === 'connected' ? 'Google Agenda conectado' : result === 'cancelled' ? 'Conexão cancelada' : 'Não foi possível conectar o Google Agenda', description: result === 'connected' ? 'Você já pode sincronizar seus compromissos.' : result === 'expired' ? 'Inicie a conexão novamente.' : result === 'connected' || result === 'cancelled' ? undefined : 'Confira a autorização do Google e tente novamente.', variant: ['connected', 'cancelled'].includes(result) ? 'default' : 'destructive' });
    url.searchParams.delete('google'); window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [toast, compact]);
  const connect = useMutation({
    mutationFn: async () => { const response = await apiRequest('POST', '/api/agenda/google/connect'); return response.json(); },
    onSuccess: data => { if (data.redirect === '/auth/google/calendar') window.location.assign(data.redirect); },
    onError: () => toast({ title: 'Não foi possível iniciar a conexão', description: 'Tente novamente ou fale com a equipe BUILT.', variant: 'destructive' }),
  });
  const sync = useMutation({
    mutationFn: async () => { const response = await apiRequest('POST', '/api/agenda/google/sync'); return response.json(); },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda/google/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agenda/google/events'] });
      toast({ title: data.message ? 'Sincronização em andamento' : 'Agenda sincronizada', description: data.message || 'Seus compromissos foram conferidos no Google Agenda.' });
    },
    onError: () => { queryClient.invalidateQueries({ queryKey: ['/api/agenda/google/status'] }); toast({ title: 'Não foi possível sincronizar', description: 'Confira a conexão e tente novamente.', variant: 'destructive' }); },
  });
  const disconnect = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/agenda/google/connection'),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['/api/agenda/google/events'] }); onEventsChange([]);
      queryClient.invalidateQueries({ queryKey: ['/api/agenda/google/status'] });
      toast({ title: 'Google Agenda desconectado', description: 'Os eventos já enviados permanecem no Google.' });
    },
    onError: () => toast({ title: 'Não foi possível desconectar', description: 'Aguarde a sincronização e tente novamente.', variant: 'destructive' }),
  });
  const busy = connect.isPending || sync.isPending || disconnect.isPending;
  const details = <div className={compact ? 'space-y-4' : 'rounded-xl border border-border/60 bg-card p-4 space-y-3'} data-testid="google-calendar-connection">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />Google Agenda</p>
        <p className="text-xs text-muted-foreground break-words">{connected ? status.data?.email : 'Veja seus eventos do Google aqui e envie suas ações da BUILT para sua agenda principal.'}</p>
        {connected && <p className="text-xs text-muted-foreground">Sincronização automática a cada 5 minutos · Horários: {status.data?.timeZone}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {(!connected || status.data?.reconnect) && <Button type="button" variant="outline" disabled={busy || status.isLoading || !status.data?.ready} loading={connect.isPending} loadingText="Conectando…" onClick={() => connect.mutate()} data-testid="connect-google-calendar">{connected ? 'Reconectar Google Agenda' : 'Conectar Google Agenda'}</Button>}
        {connected && !status.data?.reconnect && <Button type="button" variant="outline" disabled={busy || !status.data?.ready} loading={sync.isPending} loadingText="Sincronizando…" onClick={() => sync.mutate()}><RefreshCw className="mr-2 h-4 w-4" />Sincronizar agora</Button>}
        {connected && <Button type="button" variant="ghost" disabled={busy} loading={disconnect.isPending} loadingText="Desconectando…" onClick={() => disconnect.mutate()}><Unplug className="mr-2 h-4 w-4" />Desconectar</Button>}
      </div>
    </div>
    {connected && <p className="text-xs text-muted-foreground">Eventos pessoais aparecem apenas para você em “Todas”, no período do calendário. Abra-os no Google para editar. Ações da BUILT são gerenciadas aqui; ações com horário são enviadas com duração de 1 hora e as demais como dia inteiro.</p>}
    {(status.isError || status.data?.message || events.isError || events.data?.partial) && <p role="status" className="text-xs text-amber-800 dark:text-amber-200">{status.isError ? 'Não foi possível conferir a conexão. Tente novamente.' : status.data?.message || (events.isError ? 'Não foi possível atualizar os eventos do Google agora.' : 'Alguns eventos do Google ainda não foram carregados. Tente um período menor.')}</p>}
  </div>;
  if (!compact) return details;
  return <>
    <Button type="button" variant="outline" className="gap-1 px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm" onClick={() => setOpen(true)} data-testid="btn-google-calendar-settings">
      <CalendarDays className="hidden h-4 w-4 sm:block" />Google Agenda
      {connected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Conectado" />}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Google Agenda</DialogTitle>
          <DialogDescription>Gerencie a conexão da sua agenda pessoal.</DialogDescription>
        </DialogHeader>
        {details}
      </DialogContent>
    </Dialog>
  </>;
}
