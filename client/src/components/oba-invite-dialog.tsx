import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Copy, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { BiaOffer } from '@shared/bia-offer';

export function ObaInviteDialog({ opaId, title, offer }: { opaId: string; title: string; offer?: BiaOffer | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { toast } = useToast();
  const create = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/rede/oportunidades/${encodeURIComponent(opaId)}/convite`, { oferta: !!offer })).json(),
    onSuccess: data => {
      const money = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: offer?.moeda || 'BRL' }).format(amount);
      const lines = ['Olá! Quero te convidar para conhecer uma oportunidade na BUILT.', '', title];
      if (offer) {
        const available = offer.quotas.reduce((sum, quota) => sum + quota.quantidade, 0);
        lines.push(`${available} cotas disponíveis de ${offer.totalQuotas}, com valor de referência de ${money(offer.valorOrigem / offer.totalQuotas)} por cota.`);
        if (offer.localizacao) lines.push(offer.localizacao);
        lines.push('', 'Veja o imóvel, as condições de pagamento e escolha as cotas de seu interesse. Você pode participar pela sua conta BUILT ou acompanhar somente esta BIA com acesso por e-mail.');
      } else lines.push('', 'Veja os detalhes e manifeste seu interesse pela sua conta BUILT.');
      lines.push('', data.link, '', 'Vamos conversar?', 'BUILT · Build it. Own it.');
      setText(lines.join('\n'));
    },
    onError: (error: Error) => toast({ title: 'Não foi possível gerar o convite', description: error.message, variant: 'destructive' }),
  });
  async function share(copy: boolean) {
    try {
      if (!copy && navigator.share) await navigator.share({ title, text });
      else { await navigator.clipboard.writeText(text); toast({ title: 'Convite copiado' }); }
    } catch (error: any) { if (error.name !== 'AbortError') toast({ title: 'Não foi possível compartilhar', variant: 'destructive' }); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); if (!text) create.mutate(); }}><Share2 className="mr-2 h-4 w-4"/>Convidar pessoas</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader>
      <DialogTitle>Convidar para esta OBA</DialogTitle><DialogDescription>Personalize a mensagem e compartilhe o convite individual, válido por 24 horas.</DialogDescription>
    </DialogHeader>
      {create.isPending ? <p role="status">Preparando seu convite…</p> : <Textarea aria-label="Mensagem do convite" rows={13} value={text} onChange={event => setText(event.target.value)}/>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!text} onClick={() => share(true)}><Copy className="mr-2 h-4 w-4"/>Copiar mensagem</Button>
        <Button disabled={!text} onClick={() => share(false)}>Compartilhar convite</Button>
        <Button variant="ghost" loading={create.isPending} loadingText="Gerando…" onClick={() => create.mutate()}>Gerar outro convite</Button>
      </div>
    </DialogContent></Dialog>
  </>;
}
