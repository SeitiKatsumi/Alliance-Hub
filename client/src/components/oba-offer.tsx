import type { BiaBudget } from "@shared/bia-budget";
import { makePaymentSchedule } from "@shared/bia-payment-plan";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ObaQuotaAvailability } from "./oba-quota-availability";
import { ObaOfferPayment } from "./oba-offer-payment";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [selectedQuotas,setSelectedQuotas]=useState<string[]>([]);
  const [action,setAction]=useState<"interesse"|"duvida"|null>(null);
  const [message,setMessage]=useState("");
  const acquisition = quote.data?.aquisicaoCotas || (preview && published.data?.aquisicaoCotas);
  const selectedPositions = offer?.quotas.filter(quota => selectedQuotas.includes(quota.id)) ?? [];
  const selectedIds = selectedPositions.map(quota => quota.id);
  const openInterest = (id?: string) => {
    setSelectedQuotas(id ? [id] : []);
    setMessage("");
    setAction("interesse");
  };
  const interest=useQuery<{meuInteresse?:{vaga_status?:string}|null;minhasCandidaturas?:Array<{vaga_status?:string}>}>({
    queryKey:["/api/oportunidades",opaId,"interesse"],enabled:!preview && !guest && !!offer,
    queryFn:async()=>(await apiRequest("GET","/api/oportunidades/"+encodeURIComponent(opaId)+"/interesse")).json(),
  });
  const save=useMutation({
    mutationFn:async(kind:"publicar"|"interesse"|"duvida")=>{
      if (guestAccessId) return apiRequest('POST', `/api/oba-guest/${guestAccessId}/interesse`, {
        vaga_ids: selectedIds, mensagem: message, oferta_revisao: quote.data?.revisao,
      });
      if(kind==="publicar")return apiRequest("POST",path(opaId),{assinatura:quote.data?.assinatura,revisao:quote.data?.revisao});
      if(kind==="duvida")return apiRequest("POST",path(opaId)+"/duvidas",{mensagem:message});
      return apiRequest("POST","/api/oportunidades/"+encodeURIComponent(opaId)+"/interesse",{
        ...(acquisition ? {vaga_ids:selectedIds} : {vaga_id:selectedIds[0]}),
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
  const available=offer.quotas.reduce((value,quota)=>value+quota.quantidade,0);
  const selectedPayments = selectedPositions.flatMap(quota => quota.pagamentos);
  const selectedPaymentTotal = selectedPayments.reduce((sum, row) => sum + row.centavos, 0);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: offer.moeda });
  const referenceTotal = selectedPositions.reduce((sum, quota) => sum + quota.quantidade, 0) * (offer.valorOrigem / offer.totalQuotas);
  const canApply = !preview && (!guest || !!guestAccessId) && offer.quotas.length > 0 &&
    (!!guestAccessId || !interest.isPending) && !interest.data?.meuInteresse;
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
    <ObaQuotaAvailability available={available} total={offer.totalQuotas} quotas={offer.quotas}
      onToggle={canApply && acquisition ? openInterest : undefined}/>
    <ObaOfferPayment offer={offer}/>
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
      <Dialog open={action !== null} onOpenChange={open => { if (!open && !save.isPending) setAction(null); }}>
        <div className={guestAccessId ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
          <DialogTrigger asChild>
            <Button disabled={!canApply} onClick={() => openInterest()}>Tenho interesse</Button>
          </DialogTrigger>
          {!guestAccessId && <Button variant="outline" disabled={preview} onClick={() => { setAction("duvida"); setMessage(""); }}>Tirar uma dúvida</Button>}
        </div>
        {action && <DialogContent className={guestAccessId ? "og-offer-dialog w-[calc(100%-1.5rem)] rounded-xl" : undefined}>
          <DialogHeader>
            <DialogTitle>{action === "duvida" ? "Tirar uma dúvida" : "Manifestar interesse"}</DialogTitle>
            <DialogDescription>{action === "duvida" ? "Envie sua pergunta ao responsável pela oferta." : acquisition
              ? "Selecione as cotas que deseja solicitar. O interesse será analisado pela BIA."
              : "Selecione uma posição disponível. O interesse será analisado pela BIA."}</DialogDescription>
          </DialogHeader>
          {action === "interesse" && <>
            <ObaQuotaAvailability available={available} total={offer.totalQuotas} quotas={offer.quotas} selected={selectedQuotas}
              valorPorCota={offer.valorOrigem / offer.totalQuotas} moeda={offer.moeda}
              onToggle={id => setSelectedQuotas(current => current.includes(id)
                ? current.filter(item => item !== id)
                : acquisition ? [...current, id] : [id])}/>
            {selectedPayments.length > 0 && money.format(selectedPaymentTotal / 100) !== money.format(referenceTotal) && <p className="flex justify-between gap-2 text-sm" role="status">
              <span>Total no plano de pagamento</span><strong>{money.format(selectedPaymentTotal / 100)}</strong>
            </p>}
          </>}
          <label className="block space-y-1">
            <span>{action === "duvida" ? "Sua dúvida" : "Mensagem (opcional)"}</span>
            <Textarea rows={3} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)}/>
          </label>
          <DialogFooter>
            <Button variant="outline" disabled={save.isPending} onClick={() => setAction(null)}>Cancelar</Button>
            <Button loading={save.isPending} disabled={action === "duvida" ? !message.trim() : selectedIds.length === 0}
              onClick={() => save.mutate(action)}>{action === "duvida" ? "Enviar dúvida" : "Confirmar interesse"}</Button>
          </DialogFooter>
        </DialogContent>}
      </Dialog>
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
