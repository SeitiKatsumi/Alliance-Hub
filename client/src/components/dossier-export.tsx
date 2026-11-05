import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

export function DossierExport({kind, id}: {kind: 'bia' | 'imovel'; id: string}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  async function download() {
    setBusy(true); setError('');
    try {
      const base = kind === 'bia' ? '/api/bias' : '/api/carteira/imoveis';
      const response = await fetch(`${base}/${encodeURIComponent(id)}/dossie?ano=${encodeURIComponent(year)}`, {credentials:'include'});
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || 'Não foi possível gerar o dossiê. Entre novamente ou tente mais tarde.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `dossie-${kind}-${year}.zip`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar o dossiê.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => {if (!busy) {setOpen(value); setError('');}}}>
    <DialogTrigger asChild><Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Exportar dossiê</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Exportar dossiê</DialogTitle><DialogDescription>Reúna os registros para consultar ou compartilhar com seu contador.</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor={`dossier-year-${kind}-${id}`}>Ano das movimentações</Label><Input id={`dossier-year-${kind}-${id}`} type="number" min={1900} max={2100} value={year} onChange={e => setYear(e.target.value)} disabled={busy} /></div>
      <p className="text-sm text-muted-foreground">O ZIP inclui resumo em PDF, extrato dos lançamentos, documentos e comprovantes armazenados{kind === 'bia' ? ', além das versões do MAP registradas até o fim do ano' : ''}. Documentos cadastrais entram independentemente do ano, conforme suas permissões.</p>
      <p className="text-sm text-muted-foreground">Lançamentos seguem a data de pagamento ou, se ausente, a data registrada. Arquivos ausentes são identificados no resumo. Limites: 300 arquivos, 20 MB por arquivo e 100 MB no total.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={download} loading={busy} loadingText="Gerando dossiê…" disabled={!/^\d{4}$/.test(year) || +year < 1900 || +year > 2100}>Baixar dossiê</Button>
    </DialogContent>
  </Dialog>;
}
