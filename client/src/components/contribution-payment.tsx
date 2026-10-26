import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { safeAsaasUrl } from '@shared/contribution-billing';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export const flowPaymentUrl=(biaId:string,flowId:string)=>`/api/bias/${encodeURIComponent(biaId)}/aportes-iniciais/cobrancas/lancamentos/${encodeURIComponent(flowId)}`;
export async function prepareFlowPayment(biaId:string,flowId:string) {
  await apiRequest('POST',flowPaymentUrl(biaId,flowId)+'/preparar',{cashContribution:true});
  await queryClient.invalidateQueries({queryKey:['contribution-payment',biaId,flowId]});
}
const states:Record<string,string>={none:'Aguardando emissão',open:'Aguardando pagamento',overdue:'Vencida',confirmed:'Confirmado · aguardando liquidação',received:'Recebido',processing:'Em processamento',cancelled:'Cancelada',refunded:'Estornada'};

export function ContributionPaymentDetails({data}:{data:any}) {
  const [copied,setCopied]=useState('');
  const details=data.details || {};
  const copy=async(value:string,label:string)=>{try{await navigator.clipboard.writeText(value);setCopied(`${label} copiado`);}catch{setCopied('Não foi possível copiar. Selecione o código abaixo.');}};
  const boleto=safeAsaasUrl(details.bankSlipUrl);
  const qr=typeof details.qrImage==='string'&&/^[A-Za-z0-9+/=]+$/.test(details.qrImage)&&details.qrImage.length<200000?details.qrImage:null;
  return <div className="space-y-4 min-w-0">
    <p className="text-sm text-muted-foreground">{data.environment==='sandbox'?'Ambiente de testes · não pague com dinheiro real':'Cobrança da conta da empresa'}</p>
    <p className="font-semibold">{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(data.amountCents/100)} · {states[data.paymentState] || 'Em conciliação'}</p>
    {data.message && <p role="status" className="text-sm">{data.message}</p>}
    {data.details && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <section className="min-w-0 space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Pix</h3>
        {qr&&details.pix?<><img className="mx-auto h-44 w-44 rounded bg-white p-2" alt="QR Code Pix deste aporte" src={`data:image/png;base64,${qr}`}/><Button className="w-full" onClick={()=>copy(details.pix,'Pix')}>Copiar código Pix</Button><textarea aria-label="Pix copia e cola" readOnly value={details.pix} className="w-full rounded border bg-background p-2 text-xs"/></>:<p className="text-sm text-muted-foreground">{details.pixExpired?'QR Code expirado. Aguarde a atualização da cobrança.':'Pix indisponível nesta conta. Confira a habilitação e a chave Pix da conta recebedora.'}</p>}
      </section>
      <section className="min-w-0 space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Boleto</h3>
        {details.barcode&&<><textarea aria-label="Linha digitável do boleto" readOnly value={details.barcode} className="w-full rounded border bg-background p-2 text-xs"/><Button className="w-full" variant="outline" onClick={()=>copy(details.barcode,'Boleto')}>Copiar linha digitável</Button></>}
        {boleto?<Button className="w-full" asChild><a href={boleto} target="_blank" rel="noopener noreferrer">Abrir boleto</a></Button>:<p className="text-sm text-muted-foreground">Boleto ainda indisponível.</p>}
      </section>
    </div>}
    {copied&&<p role="status" className="text-sm">{copied}</p>}
  </div>;
}

export function ContributionPaymentDialog({biaId,flowId,onClose}:{biaId:string;flowId:string|null;onClose:()=>void}) {
  const url=flowPaymentUrl(biaId,flowId || '');
  const query=useQuery<any>({queryKey:['contribution-payment',biaId,flowId],enabled:!!biaId&&!!flowId,queryFn:async()=>(await apiRequest('GET',url+'/pagamento')).json(),staleTime:0,refetchInterval:flowId?5000:false});
  const prepare=useMutation({mutationFn:()=>prepareFlowPayment(biaId,flowId!),onSuccess:()=>query.refetch()});
  return <Dialog open={!!flowId} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Pagamento do aporte · Pix e boleto</DialogTitle></DialogHeader>
    {query.isPending?<p role="status">Consultando cobrança…</p>:query.isError?<p role="alert">Não foi possível consultar a cobrança. <Button variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></p>:<ContributionPaymentDetails data={query.data}/>}
    {query.data?.canPrepare&&<Button disabled={prepare.isPending} onClick={()=>prepare.mutate()}>{prepare.isPending?'Preparando…':'Emitir Pix e boleto para este aporte em dinheiro'}</Button>}
    {prepare.isError&&<p role="alert" className="text-sm text-destructive">{prepare.error.message}</p>}
  </DialogContent></Dialog>;
}
