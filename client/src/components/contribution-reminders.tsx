import React,{useState} from 'react';
import {useQuery,useMutation} from '@tanstack/react-query';
import {apiRequest} from '@/lib/queryClient';
import {defaultContributionReminders,type ContributionReminderSettings} from '@shared/contribution-reminders';
import {Button} from './ui/button';
import {Checkbox} from './ui/checkbox';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
const url=(bia:string,flow:string)=>`/api/bias/${encodeURIComponent(bia)}/aportes-iniciais/cobrancas/lancamentos/${encodeURIComponent(flow)}/lembretes`;
export async function saveContributionReminders(bia:string,flow:string,settings:ContributionReminderSettings){return apiRequest('PUT',url(bia,flow),settings);}
export function ContributionReminderFields({value,onChange,disabled=false}:{value:ContributionReminderSettings;onChange:(v:ContributionReminderSettings)=>void;disabled?:boolean}){
 return <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3"><label className="flex items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={value.enabled} onCheckedChange={v=>onChange({...value,enabled:v===true})}/>Lembrar o pagador por e-mail e na plataforma</label>{value.enabled&&<div className="flex flex-wrap gap-4">{(['month','week','day'] as const).map((key,i)=><label className="flex items-center gap-2 text-sm" key={key}><Checkbox disabled={disabled} checked={value[key]} onCheckedChange={v=>onChange({...value,[key]:v===true})}/>{['1 mês antes','1 semana antes','1 dia antes'][i]}</label>)}</div>}</fieldset>;
}
function Settings({biaId,flowId}:{biaId:string;flowId:string}){
 const [value,setValue]=useState<ContributionReminderSettings>(defaultContributionReminders);
 const query=useQuery({queryKey:['contribution-reminders',biaId,flowId],queryFn:async()=>{const data=await(await apiRequest('GET',url(biaId,flowId))).json();setValue(data.settings);return data;}});
 const save=useMutation({mutationFn:()=>saveContributionReminders(biaId,flowId,value)});
 if(query.isPending)return <p role="status">Carregando lembretes…</p>;
 if(query.isError)return <p role="alert">Não foi possível carregar os lembretes.</p>;
 return <div className="space-y-4"><ContributionReminderFields value={value} onChange={setValue} disabled={!query.data.canEdit||save.isPending}/>{query.data.canEdit&&<Button loading={save.isPending} disabled={value.enabled&&(!query.data.eligible||!(value.month||value.week||value.day))} onClick={()=>save.mutate()}>Salvar lembretes</Button>}{save.isError&&<p role="alert" className="text-destructive">{save.error.message}</p>}{save.isSuccess&&<p role="status">Preferências salvas.</p>}</div>;
}
export function ContributionReminderDialog({biaId,flowId,onClose}:{biaId:string;flowId:string|null;onClose:()=>void}){return <Dialog open={!!flowId} onOpenChange={open=>{if(!open)onClose();}}><DialogContent><DialogHeader><DialogTitle>Lembretes do aporte</DialogTitle></DialogHeader>{flowId&&<Settings key={flowId} biaId={biaId} flowId={flowId}/>}</DialogContent></Dialog>;}
