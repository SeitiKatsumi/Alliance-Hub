import {useEffect,useState,type ReactNode} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {apiRequest} from '@/lib/queryClient';
import {useToast} from '@/hooks/use-toast';
import {ACCESS_LEVEL_LABELS,MEMBER_BIA_ACCESS_LABELS,type MemberAccessSummary} from '@shared/member-access-summary';
import {BIA_ACCESS_KEYS,BIA_PARTICIPANT_ROLE_LABELS,resolveBiaParticipantPermissions,type BiaAccessMatrix} from '@shared/bia-access';
import {notifyAccessChanged} from '@/lib/access-session';

function AllianceAccess({item,memberId,onSaved}:{item:MemberAccessSummary['alliances'][number];memberId:string;onSaved:()=>void}) {
  const [matrix,setMatrix]=useState<BiaAccessMatrix>(item.permissions);
  useEffect(()=>setMatrix(item.permissions),[item]);
  const {toast}=useToast();
  const save=useMutation({mutationFn:async(reset:boolean)=>{
    await apiRequest(reset?'DELETE':'PUT',`/api/bias/${encodeURIComponent(item.id)}/access-control/${encodeURIComponent(memberId)}`,reset?undefined:{permissions:matrix});
  },onSuccess:()=>{notifyAccessChanged();onSaved();toast({title:'Acessos da BIA atualizados.'});},onError:(error:any)=>toast({title:'Não foi possível salvar os acessos',description:error.message,variant:'destructive'})});
  const dirty=JSON.stringify(matrix)!==JSON.stringify(item.permissions);
  const actual=resolveBiaParticipantPermissions(item.roles,matrix);
  return <details className="rounded-lg border border-border p-4">
    <summary className="cursor-pointer font-semibold">{item.name}<span className="mt-1 block text-sm font-normal text-muted-foreground">{item.roleLabels.join(' · ')}</span></summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">{item.customized?'Permissões personalizadas':'Permissões padrão dos cargos'}. Os cargos e a participação pertencem a esta BIA.</p>
      <a className="inline-block text-sm text-blue-600 dark:text-blue-300 underline" href={`/bias/${encodeURIComponent(item.code)}/editar?section=equipe`}>Alterar cargo na equipe da BIA</a>
      <div className="space-y-2">{BIA_ACCESS_KEYS.map(key=><label key={key} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
        <span>{MEMBER_BIA_ACCESS_LABELS[key]}</span>
        <select aria-label={`${item.name}: ${MEMBER_BIA_ACCESS_LABELS[key]}`} className="rounded-md border border-input bg-background px-3 py-2 text-foreground" value={matrix[key]} disabled={!item.editable || save.isPending} onChange={e=>setMatrix(m=>({...m,[key]:e.target.value as BiaAccessMatrix[typeof key]}))}>
          {Object.entries(ACCESS_LEVEL_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        {item.editable && actual[key]!==matrix[key] && <span className="w-full text-amber-700 dark:text-amber-300">O cargo mantém o mínimo: {ACCESS_LEVEL_LABELS[actual[key]]}.</span>}
      </label>)}</div>
      {item.editable && <div className="flex flex-wrap gap-2"><Button type="button" loading={save.isPending} disabled={!dirty} onClick={()=>save.mutate(false)}>Salvar acessos desta BIA</Button><Button type="button" variant="outline" disabled={!item.customized || save.isPending} onClick={()=>save.mutate(true)}>Restaurar padrão dos cargos</Button></div>}
    </div>
  </details>;
}

export function MemberAccessPanel({userId,profileControls}:{userId:string;profileControls?:ReactNode}) {
  const cache=useQueryClient();
  const key=['/api/admin/member-access',userId];
  const query=useQuery<MemberAccessSummary>({queryKey:key,queryFn:async()=>(await apiRequest('GET',`/api/admin/member-access/${encodeURIComponent(userId)}`)).json(),retry:false});
  if(query.isPending) return <p role="status">Conferindo acessos salvos…</p>;
  if(query.isError) return <div role="alert" className="rounded-lg border border-destructive p-4"><p>Não foi possível conferir os acessos deste usuário.</p><Button type="button" variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></div>;
  const data=query.data;
  return <section className="space-y-5" aria-label="Acessos salvos do usuário">
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-lg font-semibold">Quem é este usuário</h3>
      <p className="mt-3 font-medium">Membro BUILT: {data.profiles.includes('membro')?'Sim':'Não'}</p>
      {profileControls}
      <div className="mt-3 flex flex-wrap gap-2">{[data.roleLabel,data.entitlement?'Benefícios de membro ativos':'Sem anuidade/plano ativo',data.professional?'Perfil profissional':null,data.active?'Conta ativa':'Conta inativa'].filter(Boolean).map(label=><span key={label} className="rounded-md border border-border px-2 py-1 text-sm">{label}</span>)}</div>
      {data.bootstrap && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Esta conta é administradora de recuperação. Para testar um usuário comum, use outra conta.</p>}
      {data.admin && <p className="mt-3 text-sm text-muted-foreground">Esta conta possui privilégios administrativos. Os cargos abaixo não limitam esses privilégios.</p>}
      {!data.active && <p className="mt-3 text-sm text-muted-foreground">A conta inativa não pode entrar, mesmo com permissões cadastradas.</p>}
    </div>
    <div><h3 className="font-semibold">Ambientes liberados</h3><div className="mt-3 grid gap-2 sm:grid-cols-3">{data.environments.map(env=><div key={env.key} className="rounded-lg border border-border p-3"><p className="font-medium">{env.label}</p><p className={`mt-1 text-sm ${env.allowed?'text-emerald-700 dark:text-emerald-300':'text-muted-foreground'}`}>{env.allowed?'Liberado':'Sem acesso'}</p></div>)}</div><p className="mt-2 text-sm text-muted-foreground">Vitrine: {data.published?'perfil publicado':'perfil não publicado'}. Entrar no ambiente e publicar um perfil são permissões diferentes.</p></div>
    <div className="space-y-3"><h3 className="font-semibold">Cargos e acessos por aliança</h3>
      <p className="text-sm text-muted-foreground">Estes cargos mudam as abas e ações dentro de cada BIA. Use “Alterar cargo na equipe da BIA” para testá-los.</p>
      <div className="flex flex-wrap gap-2" aria-label="Cargos disponíveis nas BIAs">{Object.entries(BIA_PARTICIPANT_ROLE_LABELS).map(([role,label])=><span key={role} className="rounded-md border border-border px-2 py-1 text-xs">{label}</span>)}</div>
      {data.employee && <p className="text-sm text-muted-foreground">O acesso também depende das permissões concedidas pela empresa. A matriz abaixo mostra os direitos da BIA.</p>}
      {!data.alliances.length && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Nenhum cargo ou participação em BIA encontrado. Liberar o ambiente Alianças não cria uma participação.</p>}
      {data.alliances.map(item=><AllianceAccess key={item.id} item={item} memberId={data.memberId} onSaved={()=>{cache.invalidateQueries({queryKey:key});cache.invalidateQueries({queryKey:['/api/bias']});}}/>)}
    </div>
    <div className="rounded-lg border border-blue-400/30 bg-blue-500/5 p-4 text-sm"><h3 className="font-semibold">Testar com a mesma conta</h3><p className="mt-2 text-muted-foreground">Após salvar, a conta passa a usar os novos acessos sem sair e entrar. A janela do usuário consulta as mudanças a cada 10 segundos e ao voltar para ela. Mantenha outra conta Superadmin aberta para continuar os testes.</p><p className="mt-2 text-muted-foreground">Funcionário depende do vínculo e dos acessos no Plano Empresa; Coproprietário precisa de um imóvel compartilhado. Comunidades, cargos das BIAs e anuidade continuam nos seus controles próprios.</p></div>
  </section>;
}
