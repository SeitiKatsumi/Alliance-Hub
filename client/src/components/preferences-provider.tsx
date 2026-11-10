import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultPreferences, preferencesSchema, type UserPreferences } from '@shared/user-preferences';
import { translateInterface } from '@/lib/interface-language';
import { InterfaceLocale } from '@/lib/interface-locale-runtime';

export type PreferencesPatch = {language?:UserPreferences['language'];email?:Partial<UserPreferences['email']>};
type PreferencesContextValue = { data: UserPreferences; loading: boolean; error: boolean; reload: () => void; save: (value: PreferencesPatch) => Promise<void> };
const Context = createContext<PreferencesContextValue>({data:defaultPreferences(), loading:true,error:false,reload:()=>{},save:async()=>{throw new Error('Preferences unavailable');}});
export { Context as PreferencesContext };

export function PreferencesProvider({userId,children}:{userId:string;children:ReactNode}) {
  const cache = useQueryClient();
  const [initialLanguage] = useState<UserPreferences['language']>(() => {
    try {
      const saved = localStorage.getItem(userId ? 'built.ui.language.' + userId : 'built.ui.language');
      const language = preferencesSchema.shape.language.safeParse(saved);
      return language.success ? language.data : 'pt-BR';
    } catch { return 'pt-BR'; }
  });
  const key = ['/api/me/preferences',userId];
  const query = useQuery({queryKey:key,queryFn:async()=>{
    const response = await fetch('/api/me/preferences',{credentials:'include',signal:AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('Preferences unavailable');
    return preferencesSchema.parse(await response.json());
  },enabled:!!userId,retry:false,staleTime:30_000,refetchOnWindowFocus:true});
  const data = query.data || {...defaultPreferences(),language:initialLanguage};
  useEffect(()=>{
    if (!query.data || !userId) return;
    try {
      localStorage.setItem('built.ui.language.'+userId,query.data.language);
      localStorage.setItem('built.ui.language',query.data.language);
    } catch { /* A preferência da conta continua disponível sem armazenamento local. */ }
  },[query.data,userId]);
  useEffect(()=>{document.documentElement.lang=data.language;return()=>{document.documentElement.lang='pt-BR';};},[data.language]);
  return <Context.Provider value={{data,loading:query.isPending,error:query.isError,reload:()=>{void query.refetch();},save:async(value)=>{
    const response=await fetch('/api/me/preferences',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('Preferences not saved');
    cache.setQueryData(key,preferencesSchema.parse(await response.json()));
  }}}><InterfaceLocale.Provider value={data.language}>{children}</InterfaceLocale.Provider></Context.Provider>;
}
export function usePreferences() { return useContext(Context); }
export function useLocale() {
  const {data}=usePreferences();
  return {language:data.language,t:(source:string)=>translateInterface(source,data.language)};
}
