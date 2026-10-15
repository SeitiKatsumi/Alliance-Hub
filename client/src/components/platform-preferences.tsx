import { useEffect, useRef, useState } from 'react';
import { Mail, Languages } from 'lucide-react';
import { emailCategories, type UserPreferences } from '@shared/user-preferences';
import { useLocale, usePreferences } from './preferences-provider';
import { AppearanceSettings } from './appearance-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';

const copy = {
  invites:['Convites','Convites para comunidades, BIAs, reuniões e imóveis compartilhados.'],
  agenda:['Agenda e lembretes','Chamadas de aliança e lembretes de vencimento.'],
  bia:['Atualizações de BIAs','Solicitações, respostas e novos integrantes nas suas alianças.'],
  opportunities:['Oportunidades e demandas','Novas oportunidades e manifestações de interesse.'],
  community:['Comunidade e rede','Novos membros, candidaturas e lembretes de avaliação de Aura.'],
};

export function PlatformPreferences() {
  const preferences=usePreferences(); const {t}=useLocale();
  const [draft,setDraft]=useState<UserPreferences>(preferences.data);
  const [saving,setSaving]=useState(false); const [feedback,setFeedback]=useState<'saved'|'error'|null>(null);
  const [dirty,setDirty]=useState(false);
  const baseline=useRef(preferences.data);
  useEffect(()=>{if (!dirty) {setDraft(preferences.data);baseline.current=preferences.data;}},[preferences.data,dirty]);
  const change=(next:UserPreferences)=>{setDraft(next);setDirty(true);setFeedback(null);};
  return <div className="space-y-5" data-testid="platform-preferences">
    <AppearanceSettings />
    {preferences.loading ? <p role="status">{t('Carregando preferências…')}</p> : preferences.error ? <div role="alert" className="rounded-lg border p-4"><p>{t('Não foi possível carregar suas preferências.')}</p><Button className="mt-3" variant="outline" onClick={preferences.reload}>{t('Tentar novamente')}</Button></div> : <>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Mail className="h-5 w-5 shrink-0"/>{t('Notificações por e-mail')}</CardTitle><CardDescription>{t('Escolha quais e-mails deseja receber. Os avisos dentro da plataforma continuam disponíveis.')}</CardDescription></CardHeader>
        <CardContent><div className="divide-y">{emailCategories.map(category=><label key={category} htmlFor={`email-${category}`} className="flex items-start justify-between gap-4 py-4 first:pt-0"><span className="min-w-0"><span className="block text-sm font-medium">{t(copy[category][0])}</span><span className="mt-1 block text-sm text-muted-foreground">{t(copy[category][1])}</span></span><Switch id={`email-${category}`} aria-label={t(copy[category][0])} checked={draft.email[category]} disabled={saving} onCheckedChange={checked=>change({...draft,email:{...draft.email,[category]:checked}})} className="shrink-0"/></label>)}</div>
        </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Languages className="h-5 w-5 shrink-0"/>{t('Idioma')}</CardTitle></CardHeader><CardContent className="space-y-3">
        <label htmlFor="interface-language" className="block text-sm font-medium">{t('Idioma da interface')}</label>
        <select id="interface-language" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground" disabled={saving} value={draft.language} onChange={event=>change({...draft,language:event.target.value as UserPreferences['language']})}>
          <option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option>
        </select>
        <p className="text-sm text-muted-foreground">{t('Tradução disponível em Configurações, navegação e categorias do Perfil. Demais telas podem aparecer em português. Textos de usuários, e-mails e documentos não são traduzidos.')}</p>
      </CardContent></Card>
      <div className="space-y-3"><p className="text-sm text-muted-foreground">{t('As preferências de e-mail e idioma ficam salvas na sua conta.')}</p>
        {feedback && <p role={feedback==='error'?'alert':'status'} className={feedback==='error'?'text-sm text-destructive':'text-sm text-foreground'}>{t(feedback==='saved'?'Preferências salvas.':'Não foi possível salvar. Suas preferências anteriores foram mantidas.')}</p>}
        <Button className="w-full sm:w-auto" disabled={!dirty||saving} onClick={async()=>{setSaving(true);setFeedback(null);try{
          const email=Object.fromEntries(emailCategories.filter(key=>draft.email[key]!==baseline.current.email[key]).map(key=>[key,draft.email[key]]));
          const patch={...(draft.language!==baseline.current.language?{language:draft.language}:{}),...(Object.keys(email).length?{email}:{})};
          if (Object.keys(patch).length) await preferences.save(patch);
          setDirty(false);setFeedback('saved');
        }catch{setFeedback('error');}finally{setSaving(false);}}}>{t(saving?'Salvando…':'Salvar preferências')}</Button>
      </div>
    </>}
  </div>;
}
