import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';

export async function readOpenBiaDraft(biaId: string) {
  const response = await fetch(`/api/bias/${encodeURIComponent(biaId)}/rascunho`, { credentials: 'include' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível verificar o rascunho. Tente novamente sem recarregar a página.');
  const draft = await response.json();
  return draft.concluido ? null : draft;
}

export function BiaDraftNotice({ biaId, onContinue, disabled }: { biaId: string; onContinue: () => void; disabled: boolean }) {
  const query = useQuery({ queryKey: ['bia-editor-open-draft', biaId], queryFn: () => readOpenBiaDraft(biaId), staleTime: 0 });
  if (!query.data) return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500 p-3 text-sm"><span>Esta BIA ainda está em estruturação. Continue no rascunho com os campos que você preencheu.</span><Button type="button" variant="outline" disabled={disabled} onClick={onContinue}>Continuar no rascunho</Button></div>;
}
