import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { BiaLegalFields, BiaAssetFields, BiaSetupSummary } from "./bia-setup-fields";
import { biaSetupSchema, biaSetupValidationMessage, emptyBiaSetup, governanceLabel } from "@shared/bia-setup";
import { useUnsavedChanges, confirmDiscardChanges } from "@/hooks/use-unsaved-changes";

export function BiaSetupPanel({biaId,moeda,members}:{biaId:string;moeda:string;members:Record<string,string>}) {
  const [open,setOpen]=useState(false);
  return <Dialog open={open} onOpenChange={next=>{if(next || confirmDiscardChanges())setOpen(next);}}><DialogTrigger asChild><Button variant="outline" size="sm">Estrutura jurídica e ativos</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Estrutura jurídica e ativos</DialogTitle></DialogHeader>{open && <SetupEditor biaId={biaId} moeda={moeda} members={members}/>}</DialogContent></Dialog>;
}
export function SetupEditor({biaId,moeda,members,section}:{biaId:string;moeda:string;members:Record<string,string>;section?:'juridico'|'ativos'}) {
  const query=useQuery<any>({queryKey:[`/api/bias/${biaId}/estrutura`]});
  const [value,setValue]=useState(emptyBiaSetup),[revision,setRevision]=useState(-1),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('juridico'),[saved,setSaved]=useState('');
  useEffect(()=>{if(query.data && revision<0){setValue(query.data.dados);setRevision(query.data.revisao);setSaved(JSON.stringify(query.data.dados));}},[query.data,revision]);
  useUnsavedChanges(revision>=0 && JSON.stringify(value)!==saved);
  useEffect(()=>{if(section)setTab(section);},[section]);
  if(query.isPending)return <p>Carregando…</p>;
  if(query.isError)return <p role="alert">Não foi possível consultar a estrutura. <Button onClick={()=>query.refetch()}>Tentar novamente</Button></p>;
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{[['juridico','Estrutura Jurídica'],['ativos','Ativos Vinculados'],['historico','Histórico']].filter(([k])=>!section || k===section || k==='historico').map(([k,label])=><Button key={k} variant={tab===k?'default':'outline'} onClick={()=>setTab(k)}>{label}</Button>)}</div>
    <fieldset disabled={busy || !query.data.editavel} className="min-w-0">{tab==='juridico' && <BiaLegalFields disabled={busy || !query.data.editavel} value={value} onChange={setValue} bank={query.data.bancoVisivel} bankEdit={query.data.bancoEditavel} participants={query.data.participantes.map((p:any)=>({memberId:p.memberId,nome:members[p.memberId] || 'Participante'}))}/>}{tab==='ativos' && <BiaAssetFields value={value} onChange={setValue} moeda={moeda} indicators={query.data.indicadoresVisiveis} indicatorsEdit={query.data.indicadoresEditaveis}/>}</fieldset>
    {tab==='historico' && <div className="space-y-3">{!query.data.historico.length && <p>Nenhuma alteração registrada. Dados legados preservados, sem datas históricas presumidas.</p>}{query.data.historico.map((h:any)=><details key={h.revisao} className="rounded border p-3"><summary>Revisão {h.revisao} · {new Date(h.criado_em).toLocaleString('pt-BR')} · {h.motivo}</summary><p>Autor: {members[h.autor?.memberId] || "Usuário registrado"}</p>{h.anterior && <details><summary>Conteúdo anterior</summary><BiaSetupSummary value={h.anterior} moeda={moeda}/></details>}<BiaSetupSummary value={h.dados} moeda={moeda}/></details>)}</div>}
    {query.data.editavel && tab!=='historico' && <><label className="block">Motivo da alteração<Input value={reason} maxLength={4000} onChange={e=>setReason(e.target.value)}/></label><Button disabled={busy || !reason.trim()} onClick={async()=>{const validation=biaSetupSchema.safeParse(value);if(!validation.success){setError(biaSetupValidationMessage(validation.error));return;}setBusy(true);setError('');try{const response=await apiRequest('PUT',`/api/bias/${biaId}/estrutura`,{dados:value,motivo:reason,revisaoEsperada:revision});const result=await response.json();setRevision(result.revisao);setSaved(JSON.stringify(value));setReason('');await query.refetch();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>Salvar alteração</Button></>}
    {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" onClick={async()=>{if(window.confirm('Descartar alterações locais e carregar a versão atual?')){const fresh=await query.refetch();if(fresh.data){setValue(fresh.data.dados);setRevision(fresh.data.revisao);setSaved(JSON.stringify(fresh.data.dados));setError('');}}}}>Recarregar</Button></p>}
  </div>;
}
export function BiaGovernancePanel({biaId,members}:{biaId:string;members:Record<string,string>}) {
  const query=useQuery<any>({queryKey:[`/api/bias/${biaId}/governanca`]});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  if(query.isPending)return <p>Carregando Governança…</p>;
  if(query.isError)return <p role="alert">Não foi possível consultar a Governança. <Button onClick={()=>query.refetch()}>Tentar novamente</Button></p>;
  return <section className="space-y-3"><p className="text-sm text-muted-foreground">Funções designadas na BEI. Atribuições-padrão aguardam texto aprovado.</p>{query.data.participantes.map((p:any)=><div key={p.memberId} className="space-y-2"><h3 className="font-semibold">{members[p.memberId] || 'Participante'}</h3>{p.cargos.map((cargo:string)=>{
    const meta=query.data.governanca.find((g:any)=>g.memberId===p.memberId && g.cargo===cargo);
    const history=[...query.data.historico,...query.data.mapHistorico].filter((h:any)=>(h.participantes || []).some((r:any)=>r.cargos?.includes(cargo)));
    return <details key={`${cargo}:${query.data.revisao}`} className="rounded border p-3"><summary>{governanceLabel(cargo)}</summary><p className="my-2 text-sm">Início: {meta?.inicio || 'Não informado'}. Titulares e funções anteriores constam no histórico, sem inferir datas.</p><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const fields=new FormData(e.currentTarget);setBusy(true);setError('');try{await apiRequest('PUT',`/api/bias/${biaId}/governanca`,{revisaoEsperada:query.data.revisao,motivo:String(fields.get('motivo') || ''),governanca:[...query.data.governanca.filter((g:any)=>g.cargo!==cargo),{cargo,memberId:p.memberId,inicio:String(fields.get('inicio') || ''),responsabilidades:String(fields.get('responsabilidades') || '')}]});await query.refetch();}catch(e:any){setError(e.message);}finally{setBusy(false);}}}><fieldset disabled={busy || !query.data.editavel} className="space-y-3"><label className="block">Data de início conhecida<Input name="inicio" type="date" defaultValue={meta?.inicio || ''}/></label><label className="block">Responsabilidades específicas<textarea name="responsabilidades" className="w-full rounded border p-3" maxLength={4000} defaultValue={meta?.responsabilidades || ''}/></label>{query.data.editavel && <><label className="block">Motivo<Input name="motivo" required maxLength={4000}/></label><Button type="submit">Salvar responsabilidades</Button></>}</fieldset></form><h4 className="mt-3 font-semibold">Histórico registrado</h4>{history.length?history.map((h:any,i:number)=><p key={i} className="text-sm">{new Date(h.criado_em).toLocaleString('pt-BR')} · {(h.participantes || []).filter((r:any)=>r.cargos?.includes(cargo)).map((r:any)=>members[r.memberId] || r.nome || 'Participante').join(', ')}</p>):<p>Sem histórico anterior disponível.</p>}</details>;
  })}</div>)}{error && <p role="alert" className="text-destructive">{error}</p>}</section>;
}
