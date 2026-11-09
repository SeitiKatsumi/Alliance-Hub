import { ACCOUNT_ACCESS_PRESETS, type AccountAccessPreset } from './account-access-profiles';

export const ACCOUNT_AREAS = {
  vitrine: 'Consultar a Vitrine',
  publicar: 'Publicar o perfil na Vitrine',
  agenda: 'Agenda e alertas',
  carteira: 'Carteira de imóveis',
  alliances: 'Alianças',
  aura: 'Aura',
  admin: 'Administração',
} as const;

export type AccountArea = keyof typeof ACCOUNT_AREAS;
export type AreaChoices = Partial<Record<AccountArea, 'permit' | 'deny'>>;
export const ACCOUNT_AREA_KEYS = Object.keys(ACCOUNT_AREAS) as AccountArea[];
export const PROFILE_ORDER = ACCOUNT_ACCESS_PRESETS.map(preset => preset.value);
type Profile = AccountAccessPreset;

const minimum: Record<AccountArea, Profile> = {
  vitrine: 'user', publicar: 'professional', agenda: 'user', carteira: 'user',
  alliances: 'membro', aura: 'membro', admin: 'admin',
};

export function inheritsArea(profile: string, area: AccountArea) {
  return PROFILE_ORDER.indexOf(profile as Profile) >= PROFILE_ORDER.indexOf(minimum[area]);
}

export function areaChoices(permissions: unknown): AreaChoices {
  const raw = permissions as Record<string, unknown> | null;
  const result: AreaChoices = {};
  for (const key of ACCOUNT_AREA_KEYS) {
    const value = raw?.['area_' + key];
    if (value === 'edit') result[key] = 'permit';
    if (value === 'none') result[key] = 'deny';
  }
  return result;
}

export function withAreaChoices(base: Record<string, string>, choices: AreaChoices) {
  const result = { ...base };
  for (const key of ACCOUNT_AREA_KEYS) {
    delete result['area_' + key];
    if (choices[key]) result['area_' + key] = choices[key] === 'permit' ? 'edit' : 'none';
  }
  return result;
}

export function blockedArea(permissions: unknown, area: AccountArea | null) {
  return !!area && areaChoices(permissions)[area] === 'deny';
}

// Module checks supplement the existing record, employment, membership and bank authorizations.
export function areaForPath(url: string): AccountArea | null {
  const [raw, query = ''] = url.toLowerCase().split('?');
  const path = raw.replace(/^\/api(?=\/)/, '').replace(/\/$/, '');
  const root = path.split('/')[1];
  if (['admin', 'users', 'relatorio-funcionalidades'].includes(root)) return 'admin';
  if (['agenda', 'agenda-alertas', 'notificacoes', 'convites-alianca'].includes(root)) return 'agenda';
  if (!raw.startsWith('/api/') && path === '/convites') return 'agenda';
  if (['carteira', 'inventario'].includes(root) || (['', '/painel'].includes(path) && new URLSearchParams(query).get('tab') === 'carteira')) return 'carteira';
  if (['vitrine', 'anuncios'].includes(root)) return 'vitrine';
  if (['aura', 'avaliacao-aura'].includes(root)) return 'aura';
  if (/^(?:area-aliancas|area-membros|banco-ativos|bias|bia|opas?|oportunidades|demandas|land-bank|comunidades?|celulas|ros|reunioes-oportunidades|chamadas-alianca|nucleo|alianca-docs|movimentacao-cotas|transferencia-cotas|fluxo-caixa|diretoria-alianca|gestao-bias|gestao-opas|rastreabilidade)(?:$|-)/.test(root)) return 'alliances';
  return null;
}
