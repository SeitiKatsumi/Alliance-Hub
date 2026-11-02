// These are real persisted account roles, not simulated BIA or company assignments.
export const ACCOUNT_ACCESS_PRESETS = [
  {value:'user',role:'user',label:'Usuário comum · imóveis próprios'},
  {value:'professional',role:'user',label:'Profissional · Vitrine'},
  {value:'investidor',role:'investidor',label:'Investidor · BUILT Capital'},
  {value:'membro',role:'membro',label:'Membro BUILT'},
  {value:'aliado',role:'aliado',label:'Aliado licenciado'},
  {value:'coproprietario',role:'coproprietario',label:'Coproprietário · consulta compartilhada'},
  {value:'manager',role:'manager',label:'Gestor da plataforma'},
  {value:'admin',role:'admin',label:'Superadmin · Administração'},
] as const;
export type AccountAccessPreset = typeof ACCOUNT_ACCESS_PRESETS[number]['value'];

export function normalizeAccountRole(role: string | null | undefined): string {
  const value=String(role||'user').toLowerCase();
  return value==='superadmin'||value==='master'?'admin':value;
}

export function accountAccessPreset(value: string) {
  return ACCOUNT_ACCESS_PRESETS.find(preset=>preset.value===value);
}
