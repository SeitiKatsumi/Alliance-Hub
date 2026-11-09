import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ModuleInfo } from '@/components/module-info';
import { ACCOUNT_ACCESS_PRESETS, type AccountAccessPreset } from '@shared/account-access-profiles';
import { ACCOUNT_AREAS, ACCOUNT_AREA_KEYS, inheritsArea, type AreaChoices } from '@shared/account-areas';

export function AccountProfilePicker({value, choices, locked=false, dirty, saving, onSelect, onChoices, onApply}:{
  value:string; choices:AreaChoices; locked?:boolean; dirty:boolean; saving:boolean;
  onSelect:(profile:AccountAccessPreset)=>void; onChoices:(choices:AreaChoices)=>void; onApply:()=>void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const ordinary=ACCOUNT_ACCESS_PRESETS.filter(p=>!['admin','manager'].includes(p.role));
  const administrative=ACCOUNT_ACCESS_PRESETS.filter(p=>['admin','manager'].includes(p.role));
  const selectedLabel = ACCOUNT_ACCESS_PRESETS.find(profile => profile.value === value)?.label
    || (value === 'coproprietario' ? 'Acesso por copropriedade' : value === 'employee' ? 'Funcionário da empresa' : 'Perfil anterior');
  const options = (items: typeof ordinary) => items.map(profile => (
    <div key={profile.value} className="flex items-center gap-1 rounded-md hover:bg-muted">
      <button
        type="button"
        aria-pressed={value === profile.value}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          onSelect(profile.value);
          setProfileOpen(false);
        }}
      >
        <Check aria-hidden="true" className={`h-4 w-4 shrink-0 ${value === profile.value ? '' : 'invisible'}`} />
        <span className="break-words">{profile.label}</span>
      </button>
      <ModuleInfo title={profile.label} description={profile.description} />
    </div>
  ));
  return <div className="space-y-4 rounded-lg border border-border p-3">
    <div className="flex items-center gap-1">
      <label className="font-semibold" htmlFor="member-access-profile">Perfil da conta</label>
    </div>
    <Popover open={profileOpen} onOpenChange={setProfileOpen}>
      <PopoverTrigger asChild>
        <button id="member-access-profile" type="button" disabled={locked || saving} className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background p-2 text-left text-foreground disabled:opacity-50">
          <span className="min-w-0 break-words">{selectedLabel}</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Selecionar perfil da conta" className="max-h-[min(28rem,70vh)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto p-2">
        <div role="group" aria-label="Participação na plataforma">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Participação na plataforma</p>
          {options(ordinary)}
        </div>
        <div role="group" aria-label="Administração">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">Administração</p>
          {options(administrative)}
        </div>
      </PopoverContent>
    </Popover>
    {!locked && value!=='coproprietario' && <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold">Personalizar acesso por área</summary>
      <p className="my-2 text-sm text-muted-foreground">Os acessos começam com o padrão do cargo. Suas alterações por área continuam ao trocar de cargo.</p>
      {ACCOUNT_AREA_KEYS.map(area=><label key={area} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm">
        <span>{ACCOUNT_AREAS[area]}</span>
        <select className="rounded-md border border-input bg-background p-2" disabled={saving} value={choices[area] || (inheritsArea(value,area) ? 'permit' : 'deny')} onChange={event=>{
          const next={...choices}; const v=event.target.value;
          if (v==='permit'||v==='deny') next[area]=v; else delete next[area];
          onChoices(next);
        }}>
          <option value="permit" disabled={area==='admin' && value!=='admin'}>Permitido</option>
          <option value="deny">Restrito</option>
        </select>
      </label>)}
    </details>}
    <Button type="button" loading={saving} disabled={!dirty || locked} onClick={onApply}>Salvar acessos</Button>
  </div>;
}
