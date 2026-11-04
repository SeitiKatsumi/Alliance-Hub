import React from 'react';
import { RO_PULSE_LABELS, RO_PULSE_STAGES, type RoPulseConfig, type RoPulseStage } from '@shared/ro-pulse';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';

export type RoPulseCommunity = { id: string; nome: string; stage: RoPulseStage };
export const EMPTY_RO_PULSE: RoPulseConfig = { intervalo_horas: 4, comunidades: { regional: [], nacional: [], global: [] } };

export function RoPulseExplanation() {
  return <div className="space-y-2 text-sm text-muted-foreground">
    <p>O Pulso divulga esta RO aos membros das comunidades escolhidas, com um aviso em Atualizações e um e-mail, conforme as preferências de cada pessoa.</p>
    <p>A divulgação começa na comunidade de origem e avança, nesta ordem, para as regionais, nacionais e globais que você selecionar. Etapas sem comunidades escolhidas são puladas.</p>
  </div>;
}

export function RoPulseSetup({ id, value, onChange, communities, disabled = false }: {
  id: string;
  value: RoPulseConfig;
  onChange: (value: RoPulseConfig) => void;
  communities: RoPulseCommunity[];
  disabled?: boolean;
}) {
  return <div className="space-y-4" data-testid="ro-pulse-setup">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ ...value, comunidades: {
        regional: [...new Set(communities.filter(c => c.stage === 'regional').map(c => c.id))],
        nacional: [...new Set(communities.filter(c => c.stage === 'nacional').map(c => c.id))],
        global: [...new Set(communities.filter(c => c.stage === 'global').map(c => c.id))],
      } })}>Selecionar todas as comunidades</Button>
      <Button type="button" variant="ghost" size="sm" disabled={disabled || !Object.values(value.comunidades).some(ids => ids.length)} onClick={() => onChange({ ...value, comunidades: { regional: [], nacional: [], global: [] } })}>Limpar seleção</Button>
    </div>
    <div className="max-w-xs space-y-2">
      <Label htmlFor={id}>Tempo entre os pulsos (horas)</Label>
      <Input id={id} type="number" inputMode="numeric" min={1} max={168} step={1}
        disabled={disabled} value={Number.isNaN(value.intervalo_horas) ? '' : value.intervalo_horas}
        data-testid="ro-pulse-interval"
        onChange={event => onChange({ ...value, intervalo_horas: event.target.valueAsNumber })} />
    </div>
    <p className="text-sm text-muted-foreground">Por exemplo: com 4 horas, a origem recebe primeiro e a próxima etapa começa 4 horas depois. Você pode acompanhar ou pausar no detalhe da RO. A divulgação para quando a reunião acontece ou é cancelada.</p>
    <div className="space-y-3">
      {RO_PULSE_STAGES.map(stage => <details key={stage} open={stage === 'origem'} className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">{RO_PULSE_LABELS[stage]}{stage !== 'origem' && value.comunidades[stage].length > 0 ? ` · ${value.comunidades[stage].length} selecionada(s)` : ''}</summary>
        <div className="mt-3 max-h-48 space-y-3 overflow-y-auto">
          {communities.filter(c => c.stage === stage).map(c => <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={stage === 'origem' || value.comunidades[stage].includes(c.id)}
              disabled={disabled || stage === 'origem'} data-testid={`ro-pulse-community-${c.id}`}
              onCheckedChange={checked => {
                if (stage === 'origem') return;
                onChange({ ...value, comunidades: { ...value.comunidades,
                  [stage]: checked === true ? [...new Set([...value.comunidades[stage], c.id])] : value.comunidades[stage].filter(id => id !== c.id) } });
              }} />
            <span className="min-w-0 break-words">{c.nome}</span>
          </label>)}
          {!communities.some(c => c.stage === stage) && <p className="text-sm text-muted-foreground">Nenhuma comunidade disponível nesta etapa.</p>}
        </div>
      </details>)}
    </div>
  </div>;
}
