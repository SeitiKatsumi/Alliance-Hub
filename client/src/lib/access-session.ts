import type {QueryClient} from '@tanstack/react-query';

function stable(value:any):any {
  if(Array.isArray(value)) return value.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
export function accessSessionKey(user:any):string {
  return JSON.stringify(stable(user?{
    id:user.id,member:user.membro_directus_id,role:user.role,permissions:user.permissions,active:user.ativo,
    purposes:user.account_purposes,seals:user.Outras_redes_as_quais_pertenco,memberProfile:user.em_membros_built,capital:user.em_built_capital,
    alliance:user.has_alliance_participation,revision:user.access_revision,membership:user.membership,employee:user.company_employee,owner:user.company_owner_user_id,
    companyPermissions:user.company_permissions,onboarding:user.onboarding_required,pending:user.pending_vitrine,
  }:null));
}

export async function resetAccessQueries(cache:QueryClient) {
  // Drop previously authorized data and cancel in-flight results before refetching.
  const scope={predicate:(query:any)=>query.queryKey[0]!=='/api/me'};
  await cache.cancelQueries(scope);
  await cache.resetQueries(scope);
}

const ACCESS_EVENT='built:access-changed';
const ACCESS_STORAGE='built:access-change';
export function notifyAccessChanged() {
  if(typeof window==='undefined') return;
  window.dispatchEvent(new Event(ACCESS_EVENT));
  try {window.localStorage.setItem(ACCESS_STORAGE,`${Date.now()}:${Math.random()}`);} catch {/* Polling/focus still refreshes when storage is unavailable. */}
}

export function subscribeAccessChanges(refresh:()=>void) {
  const storage=(event:StorageEvent)=>{if(event.key===ACCESS_STORAGE) refresh();};
  window.addEventListener(ACCESS_EVENT,refresh);
  window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener(ACCESS_EVENT,refresh);window.removeEventListener('storage',storage);};
}
