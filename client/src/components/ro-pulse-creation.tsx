import React, { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RoPulseConfig } from '@shared/ro-pulse';
import { apiRequest } from '@/lib/queryClient';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { EMPTY_RO_PULSE, RoPulseExplanation, RoPulseSetup, type RoPulseCommunity } from './ro-pulse-setup';

export function RoPulseCreation({ communityId, value, onChange, disabled }: {
  communityId: string;
  value: RoPulseConfig | null;
  onChange: (value: RoPulseConfig | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  const catalog = useQuery<RoPulseCommunity[]>({
    queryKey: ['/api/comunidades', communityId, 'ro-pulso'],
    enabled: !!communityId && value !== null,
    queryFn: async () => (await apiRequest('GET', `/api/comunidades/${encodeURIComponent(communityId)}/ro-pulso`)).json(),
  });
  return <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Pulso da RO" data-testid="ro-pulse-creation">
    <div className="space-y-2"><h3 className="font-semibold">Pulso da RO · divulgação por comunidades</h3><RoPulseExplanation /></div>
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <Checkbox checked={value !== null} disabled={disabled || !communityId}
        onCheckedChange={checked => onChange(checked === true ? EMPTY_RO_PULSE : null)} />
      Divulgar esta RO com Pulso
    </label>
    {!communityId && <p className="text-sm text-muted-foreground">Selecione a comunidade de origem para configurar a divulgação.</p>}
    {value !== null && <>
      <p className="text-sm text-muted-foreground">Ao criar a RO, a divulgação começa pela comunidade de origem.</p>
      {catalog.isPending ? <p role="status">Carregando comunidades…</p> : catalog.isError ?
        <div role="alert" className="space-y-2"><p>Não foi possível carregar as comunidades do Pulso.</p><Button type="button" variant="outline" onClick={() => void catalog.refetch()}>Tentar novamente</Button></div> :
        <RoPulseSetup id={id} value={value} onChange={onChange} communities={catalog.data || []} disabled={disabled} />}
    </>}
  </section>;
}
