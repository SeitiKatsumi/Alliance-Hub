import type { BiaBudget } from "@shared/bia-budget";
import { makePaymentSchedule } from "@shared/bia-payment-plan";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ObaQuotaAvailability } from "./oba-quota-availability";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { BiaOfferView } from "@shared/bia-offer";

const path=(id:string)=>"/api/oportunidades/"+encodeURIComponent(id)+"/oferta";
const href=(id:string)=>"/opas/"+encodeURIComponent(id)+"/oferta";
export function usePublishedObaOffer(id?:string) {
  return useQuery<BiaOfferView | null>({queryKey:[path(id || "")],enabled:!!id,queryFn:async()=>{
    const result=await fetch(path(id!),{credentials:"include"});
    if(result.status===404)return null;
    if(!result.ok)throw new Error("Não foi possível carregar a oferta.");
    return result.json();
  }});
}

export function ObaOfferLink({opaId,manager=false}:{opaId:string;manager?:boolean}) {
  const published=usePublishedObaOffer(opaId);
  if(!manager && !published.data)return null;
  return <div className="flex flex-wrap gap-2">
    {manager && <Button variant="outline" asChild><a href={href(opaId)+"?previa=1"}>Ver como o interessado vê</a></Button>}
    {published.data && <Button variant="outline" asChild><a href={href(opaId)}>Ver oferta da BIA</a></Button>}
  </div>;
}

export function ObaOfferPage() {
  const {id}=useParams<{id:string}>();
  return <ObaOfferScreen opaId={id || ""} preview={new URLSearchParams(useSearch()).get("previa")==="1"}/>;
}

export function ObaGuestOfferPage() {
  const {id}=useParams<{id:string}>();
  return <ObaOfferScreen opaId={id || ""} guestToken={window.location.hash.slice(1)}/>;
}

export function ObaOfferScreen({opaId,preview=false,guestToken,guestAccessId}:{opaId:string;preview?:boolean;guestToken?:string;guestAccessId?:string}) {
  const queryClient = useQueryClient();
  const guest=guestToken!==undefined || !!guestAccessId;
  const published=usePublishedObaOffer(!guest?opaId:undefined);
  const invited=useQuery<BiaOfferView>({
    queryKey:[path(opaId),"convite",guestToken,guestAccessId],enabled:guest && (!!opaId || !!guestAccessId),staleTime:0,refetchOnWindowFocus:"always",retry:false,
    queryFn:async()=>{
      if (guestAccessId) return (await apiRequest('GET', '/api/oba-guest/' + guestAccessId)).json();
      if(!guestToken)throw new Error("Convite indisponível.");
      const response=await fetch(path(opaId),{headers:{"X-Oba-Invite":guestToken},cache:"no-store",credentials:"omit"});
      if(!response.ok)throw new Error("Este convite ou oferta está indisponível.");
      return response.json();
    },
  });
  const drafts=useQuery<BiaOfferView>({queryKey:[path(opaId),"previa"],enabled:preview && !!opaId,queryFn:async()=>{
    const response=await apiRequest("GET",path(opaId)+"?previa=1");
    return response.json();
  }});
  const {toast}=useToast();
  const quote=guest?invited:preview?drafts:published;
  const offer=guest && quote.isError ? undefined : quote.data?.oferta;
  const [selected,setSelected]=useState("");
  const [selectedQuotas,setSelectedQuotas]=useState<string[]>([]);
  const [action,setAction]=useState<"interesse"|"duvida"|null>(null);
  const [message,setMessage]=useState("");
  const interest=useQuery<{meuInteresse?:{vaga_status?:string}|null;minhasCandidaturas?:Array<{vaga_status?:string}>}>({
    queryKey:["/api/oportunidades",opaId,"interesse"],enabled:!preview && !guest && !!offer,
    queryFn:async()=>(await apiRequest("GET","/api/oportunidades/"+encodeURIComponent(opaId)+"/interesse")).json(),
  });
  const save=useMutation({
    mutationFn:async(kind:"publicar"|"interesse"|"duvida")=>{
      if (guestAccessId) return apiRequest('POST', `/api/oba-guest/${guestAccessId}/interesse`, {
        vaga_ids: selectedQuotas, mensagem: message, oferta_revisao: quote.data?.revisao,
      });
      if(kind==="publicar")return apiRequest("POST",path(opaId),{assinatura:quote.data?.assinatura,revisao:quote.data?.revisao});
      if(kind==="duvida")return apiRequest("POST",path(opaId)+"/duvidas",{mensagem:message});
      return apiRequest("POST","/api/oportunidades/"+encodeURIComponent(opaId)+"/interesse",{
        ...(quote.data?.aquisicaoCotas && selectedQuotas.length ? {vaga_ids:selectedQuotas} : {vaga_id:offer?.quotas.find(quota=>quota.id===selected)?.id || offer?.quotas[0]?.id}),
        mensagem:message || null,oferta_revisao:quote.data?.revisao,
      });
    },
    onSuccess:async(_,kind)=>{
      setAction(null);setMessage("");
      if(kind==='interesse')setSelectedQuotas([]);
      if (guestAccessId) await queryClient.invalidateQueries({ queryKey: ['oba-guest', guestAccessId] });
      await Promise.all([queryClient.invalidateQueries({queryKey:[path(opaId)]}),
        queryClient.invalidateQueries({queryKey:["/api/oportunidades",opaId,"interesse"]})]);
      toast({title:kind==="publicar"?"Oferta publicada. Use um convite ou o Pulso para divulgar.":kind==="duvida"?"Dúvida enviada ao responsável.":"Interesse registrado. Aguardando decisão da diretoria."});
    },
    onError:(error:Error)=>toast({title:"Não foi possível concluir",description:error.message,variant:"destructive"}),
  });
  if(quote.isPending)return <p className="p-6">Carregando oferta…</p>;
  if(!offer)return <div className="space-y-3 p-6"><p>{quote.error?.message || "Oferta ainda não disponível."}</p>
    {!guest && <Button asChild variant="outline"><a href={"/opas/"+encodeURIComponent(opaId)+(preview?"?gestao=1":"")}>Voltar para a OBA</a></Button>}
  </div>;
  const active=offer.quotas.find(quota=>quota.id===selected) || offer.quotas[0];
  const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:offer.moeda}).format(value);
  const total=active?.pagamentos.reduce((value,row)=>value+row.centavos,0) || 0;
  const groups=new Map<string,{min:number;max:number;count:number;first:string;last:string}>();
  for(const row of active?.pagamentos || []) {
    const group=groups.get(row.bloco);
    if(group){group.min=Math.min(group.min,row.centavos);group.max=Math.max(group.max,row.centavos);group.last=row.mes;group.count++;}
    else groups.set(row.bloco,{min:row.centavos,max:row.centavos,count:1,first:row.mes,last:row.mes});
  }
  const acquisition=quote.data?.aquisicaoCotas || (preview && published.data?.aquisicaoCotas);
  const available=offer.quotas.reduce((value,quota)=>value+quota.quantidade,0);
  const state=interest.data?.meuInteresse?.vaga_status;
  return <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-6">
    {preview && <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" asChild><a href={"/opas/"+encodeURIComponent(opaId)+"?gestao=1"}>Voltar para a gestão</a></Button>
      <Button type="button" loading={save.isPending} onClick={()=>save.mutate("publicar")}>Publicar oferta</Button></div>}
    <header className="space-y-2">
      <p className="text-sm text-muted-foreground">{preview?"Prévia da oferta":"Oportunidade BUILT de Aliança"}</p>
      <h1 className="break-words text-2xl font-bold">{offer.titulo}</h1>
      {offer.localizacao && <p className="text-sm">{offer.localizacao}</p>}
      {offer.imagem && <img src={offer.imagem} alt="Imóvel da oferta" className="aspect-video w-full rounded-lg object-cover"/>}
    </header>
    {acquisition && <ObaQuotaAvailability available={available} total={offer.totalQuotas} quotas={offer.quotas} selected={selectedQuotas} valorPorCota={offer.valorOrigem/offer.totalQuotas} moeda={offer.moeda}
      onToggle={(!guest || !!guestAccessId) && !preview && !interest.data?.meuInteresse ? id=>{
        setSelected(id);
        setSelectedQuotas(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
      } : undefined}/>}
    <section className="space-y-3 rounded-lg border bg-card p-4">
      {!acquisition && <h2 className="font-semibold">{available} de {offer.totalQuotas} cotas disponíveis</h2>}
      {active && <>
        <label className="block space-y-1">Cota disponível<select value={active.id} className="block w-full rounded-md border bg-background p-2" onChange={e=>setSelected(e.target.value)}>
          {offer.quotas.map(quota=><option key={quota.id} value={quota.id}>Cota {quota.numero} · {quota.quantidade} CI · {quota.tipo==="guardiao"?"Sócio Guardião":"Sócio Multiplicador"}</option>)}
        </select></label>
        {active.pagamentos.length ? <p className="text-xl font-bold">{money(total/100)}</p> :
          <p className="text-xl font-bold">{money(offer.valorOrigem*active.quantidade/offer.totalQuotas)}<span className="block text-sm font-normal text-muted-foreground">Valor de referência da posição</span></p>}
        <p className="text-sm text-muted-foreground">Valor de Origem {money(offer.valorOrigem)}{offer.correcao && ` · ${offer.correcao}`}</p>
      </>}
    </section>
    {active && !active.pagamentos.length && <p className="rounded-lg border bg-card p-4 text-sm">Condições de pagamento a definir.</p>}
    {!!active?.pagamentos.length && <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Como você paga</h2>
      {Array.from(groups,([name,group])=><div key={name} className="border-t pt-2 text-sm">
        <strong>{name} · {group.count} × {money(group.min/100)}{group.min!==group.max && " a "+money(group.max/100)}</strong>
        <p>{group.first}{group.first!==group.last && " a "+group.last}</p>
      </div>)}
      <details><summary className="cursor-pointer font-medium">Ver todos os {active.pagamentos.length} pagamentos</summary>
        <table className="mt-2 w-full text-sm"><thead><tr className="border-b text-left"><th>Mês</th><th>Bloco</th><th className="text-right">Valor</th></tr></thead>
          <tbody>{active.pagamentos.map((row,index)=><tr key={index} className="border-b"><td className="py-2">{row.mes}</td><td>{row.bloco}</td><td className="text-right">{money(row.centavos/100)}</td></tr>)}</tbody>
        </table>
      </details>
    </section>}
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Como funciona a aliança</h2>
      <p className="text-sm">A diretoria analisa o interesse. Após aprovação e aceites, a pessoa entra na posição indicada na oferta. Os direitos são definidos nos documentos da aliança.</p>
      {offer.descricao && <p className="whitespace-pre-wrap break-words text-sm">{offer.descricao}</p>}
    </section>
    {!!offer.documentos.length && <section className="space-y-2 rounded-lg border bg-card p-4"><h2 className="font-semibold">Documentos da oferta</h2>
      {offer.documentos.map(doc=><a key={doc.id} href={guestAccessId && /^\/api\/files\/[\w-]+$/.test(doc.url) ? `/api/oba-guest/${guestAccessId}/files/${doc.url.split('/').at(-1)}` : doc.url} target="_blank" rel="noopener noreferrer" className="block break-words text-sm text-primary underline">{doc.titulo}</a>)}
    </section>}
    {quote.data?.validade && <p className="text-sm text-muted-foreground">Válida até {new Date(quote.data.validade).toLocaleDateString("pt-BR")} ou até as cotas serem preenchidas.</p>}
    {guest && !guestAccessId ? <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm">Entre ou crie uma conta para manifestar interesse ou tirar uma dúvida.</p>
      <Button asChild><a href={"/login?convite="+encodeURIComponent(guestToken || '')}>Continuar com o convite</a></Button>
    </div> : <div className="space-y-3 rounded-lg border bg-card p-4">
      {!preview && interest.data?.meuInteresse && <p role="status">{(interest.data.minhasCandidaturas?.length || 0)>1 ? `${interest.data.minhasCandidaturas!.length} candidaturas registradas` : state==="aprovada"?"Aprovada":state==="recusada"?"Recusada":state==="vaga_preenchida"?"Cota preenchida":"Interesse registrado"}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={preview || !active || (acquisition && !selectedQuotas.length) || (!guestAccessId && interest.isPending) || !!interest.data?.meuInteresse} onClick={()=>{setAction("interesse");setMessage("");}}>Manifestar interesse</Button>
        {!guestAccessId && <Button variant="outline" disabled={preview} onClick={()=>{setAction("duvida");setMessage("");}}>Tirar uma dúvida</Button>}
      </div>
      {action && <div className="space-y-3">
        <label className="block">{action==="duvida"?"Sua dúvida":"Mensagem (opcional)"}<Textarea rows={3} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={save.isPending} onClick={()=>setAction(null)}>Cancelar</Button>
          <Button loading={save.isPending} disabled={action==="duvida" && !message.trim()} onClick={()=>save.mutate(action)}>Enviar</Button></div>
      </div>}
    </div>}
  </main>;
}


export function BiaOfferOverview({biaId,base}:{biaId:string;base?:{valorOrigem:number;moeda:string;estrutura?:{totalCotas?:number};participantes?:Array<{titular?:string;cotasInvestimento?:number}>}}) {
  const total=Number(base?.estrutura?.totalCotas);
  const query=useQuery<{dados?:{orcamento?:BiaBudget}}>({queryKey:[`/api/bias/${biaId}/estrutura`],enabled:Number.isSafeInteger(total) && total>0});
  if(!base || !Number.isSafeInteger(total) || total<1)return null;
  const open=(base.participantes || []).filter(row=>row.titular==="vaga").reduce((sum,row)=>sum+(Number(row.cotasInvestimento)||0),0);
  const plan=query.data?.dados?.orcamento?.planoPagamento;
  let rows:ReturnType<typeof makePaymentSchedule>=[];
  if(plan)try{rows=makePaymentSchedule(plan,base.valorOrigem);}catch{}
  const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:base.moeda || "BRL"}).format(value);
  return <section aria-label="Resumo para a oferta" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
    <div><p className="text-sm text-muted-foreground">Cotas disponíveis</p><strong>{open} de {total}</strong></div>
    <div><p className="text-sm text-muted-foreground">Valor de referência por cota</p><strong>{money(base.valorOrigem/total)}</strong></div>
    {rows.length>0 && <div><p className="text-sm text-muted-foreground">Plano de pagamento</p><strong>{rows.length} pagamentos · até {rows.at(-1)!.mes}</strong></div>}
  </section>;
}
