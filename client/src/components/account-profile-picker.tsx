import {Button} from '@/components/ui/button';
import {ACCOUNT_ACCESS_PRESETS,type AccountAccessPreset} from '@shared/account-access-profiles';

export function AccountProfilePicker({value,dirty,saving,onSelect,onApply}:{
  value:string;dirty:boolean;saving:boolean;onSelect:(profile:AccountAccessPreset)=>void;onApply:()=>void;
}) {
  return <div className="rounded-lg border border-border p-3 space-y-3">
    <label className="block text-sm font-semibold" htmlFor="member-access-profile">Trocar perfil da conta</label>
    <select id="member-access-profile" disabled={saving} className="w-full rounded-md border border-input bg-background p-2 text-foreground" value={value} onChange={event=>onSelect(event.target.value as AccountAccessPreset)}>
      <option value="" disabled>Escolher um perfil…</option>
      {ACCOUNT_ACCESS_PRESETS.map(profile=><option key={profile.value} value={profile.value}>{profile.label}</option>)}
      <option disabled>Funcionário · acesso definido pela empresa</option>
    </select>
    <p className="text-xs text-muted-foreground">Ao aplicar, substitui os perfis globais selecionados. Cargos nas BIAs e vínculos com imóveis e empresas são mantidos.</p>
    <Button type="button" loading={saving} disabled={!dirty} onClick={onApply}>Aplicar perfil à conta</Button>
  </div>;
}
