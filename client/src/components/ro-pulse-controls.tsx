import {useEffect,useId,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {RO_PULSE_LABELS,type RoPulseConfig,type RoPulseStage} from '@shared/ro-pulse';
import {apiRequest,queryClient} from '@/lib/queryClient';
import {Button} from './ui/button';
import {EMPTY_RO_PULSE,RoPulseSetup,RoPulseExplanation} from './ro-pulse-setup';
import {useToast} from '@/hooks/use-toast';

export type PulseData={flow:null|{id:string;status:string;reason?:string;next_at?:string;config:RoPulseConfig};waves:Array<{id:string;stage:RoPulseStage;status:string}>;communities:Array<{id:string;nome:string;stage:RoPulseStage}>;can_start:boolean;email_states:Array<{state:string;total:number}>};
const empty=EMPTY_RO_PULSE;
export function RoPulseControls({meetingId}:{meetingId:string}){
 const fieldId=useId(),{toast}=useToast(),base=`/api/reunioes-oportunidades/${encodeURIComponent(meetingId)}/pulso`;
 const query=useQuery<PulseData>({queryKey:[base],queryFn:async()=>(await apiRequest('GET',base)).json(),refetchInterval:10000});
 const [config,setConfig]=useState<RoPulseConfig>(empty);
 const [configuring,setConfiguring]=useState(false);
 useEffect(()=>{setConfig(query.data?.flow?.config||empty);},[query.data?.flow?.id,meetingId]);
 const mutation=useMutation({mutationFn:async(action:string)=>(await apiRequest(action==='iniciar'?'POST':'PATCH',base,action==='iniciar'?config:{action})).json(),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:[base]});toast({title:'Pulso atualizado'});},onError:(e:any)=>toast({title:'Não foi possível atualizar o Pulso',description:e.message,variant:'destructive'})});
 if(query.isLoading)return <p role="status">Carregando Pulso da RO…</p>;
 if(query.isError)return <div role="alert" className="space-y-2 rounded-lg border p-4"><p>Não foi possível carregar o Pulso da RO.</p><p className="text-sm text-muted-foreground">{query.error.message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Tentar novamente</Button></div>;
 const data=query.data!,flow=data.flow;
 return <section className="min-w-0 space-y-4 rounded-lg border border-border p-4" aria-label="Pulso da RO">
  <div><h3 className="font-semibold">Pulso da RO</h3><RoPulseExplanation /></div>
  {flow?<>
   <p className="text-sm font-medium">{flow.status==='ativo'?'Em distribuição':flow.status==='pausado'?'Pausado':'Encerrado'} · intervalo de {flow.config.intervalo_horas} hora(s)</p>
   {flow.next_at&&flow.status==='ativo'&&<p className="text-sm text-muted-foreground">Próximo pulso: {new Date(flow.next_at).toLocaleString('pt-BR')}</p>}
   {flow.reason==='criador_sem_acesso'&&<p role="alert">O acesso do criador precisa ser revisado para continuar.</p>}
   {flow.reason==='consulta_indisponivel'&&<p role="status">A distribuição aguarda a atualização dos destinatários e tentará novamente.</p>}
   <ol className="space-y-2 text-sm">{data.waves.map(w=><li key={w.id} className="flex flex-wrap justify-between gap-2 rounded border p-2"><span>{RO_PULSE_LABELS[w.stage]}</span><span>{({pendente:'Aguardando',processando:'Enviando',executada:'Enviado',cancelada:'Cancelado'} as Record<string,string>)[w.status]}</span></li>)}</ol>
   {data.email_states.some(s=>['incerto','enviando'].includes(s.state))&&<p role="status" className="text-sm text-muted-foreground">Há e-mails sem confirmação de entrega. Eles não serão reenviados automaticamente.</p>}
   {flow.status!=='concluido'&&<div className="flex flex-wrap gap-2">
    <Button variant="outline" loading={mutation.isPending} disabled={mutation.isPending} onClick={()=>mutation.mutate(flow.status==='ativo'?'pausar':'retomar')}>{flow.status==='ativo'?'Pausar':'Retomar'}</Button>
    <Button variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate('avancar')}>Próximo pulso agora</Button>
    <Button variant="ghost" disabled={mutation.isPending} onClick={()=>mutation.mutate('encerrar')}>Encerrar Pulso</Button>
   </div>}
  </>:<>
   {!configuring ? <div className="space-y-2"><p className="text-sm text-muted-foreground">O Pulso não foi ativado para esta RO.</p><Button type="button" variant="outline" disabled={!data.can_start} onClick={()=>setConfiguring(true)}>Configurar divulgação</Button></div> : <>
   <RoPulseSetup id={fieldId} value={config} onChange={setConfig} communities={data.communities} disabled={mutation.isPending} />
   <Button loading={mutation.isPending} disabled={!data.can_start||!Number.isInteger(config.intervalo_horas)||config.intervalo_horas<1||config.intervalo_horas>168} onClick={()=>mutation.mutate('iniciar')}>Iniciar Pulso</Button>
   </>}
   {!data.can_start&&<p className="text-sm text-muted-foreground">Disponível para ROs agendadas e futuras.</p>}
  </>}
 </section>;
}
