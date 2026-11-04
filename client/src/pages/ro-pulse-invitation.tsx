import {useQuery} from '@tanstack/react-query';
import {useRoute} from 'wouter';
import {apiRequest} from '@/lib/queryClient';
import {Button} from '@/components/ui/button';

export default function RoPulseInvitation(){
 const [,params]=useRoute('/ros/avisos/:id');
 const query=useQuery<any>({queryKey:['ro-pulse-invitation',params?.id],enabled:!!params?.id,queryFn:async()=>(await apiRequest('GET',`/api/reunioes-oportunidades/${encodeURIComponent(params!.id)}/pulso/convite`)).json()});
 return <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6"><h1 className="text-2xl font-bold">Reunião de Oportunidades</h1>
  {query.isLoading?<p role="status">Carregando RO…</p>:query.isError?<div role="alert" className="space-y-3"><p>Não foi possível consultar este aviso. Entre com a conta que o recebeu.</p><Button variant="outline" onClick={()=>void query.refetch()}>Tentar novamente</Button></div>:query.data&&<section className="space-y-3 rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{query.data.codigo}</p><h2 className="break-words text-xl font-semibold">{query.data.titulo}</h2><p>{String(query.data.data).slice(0,10).split('-').reverse().join('/')} · {query.data.hora||'Horário a confirmar'} · {query.data.timezone}</p><p className="capitalize">{query.data.location_type}</p><p className="text-sm text-muted-foreground">{query.data.status==='agendada'?'Consulte o organizador para participar desta RO.':'Esta RO já foi realizada ou cancelada.'}</p></section>}
 </main>;
}
