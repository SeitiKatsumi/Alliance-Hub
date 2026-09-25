import { BIA_CREATION_STEPS, emptyBiaSetup, legacyBiaSetup, legalBlockers, setupWarnings } from "@shared/bia-setup";
import { BiaLegalFields, BiaAssetFields, BiaSetupSummary } from "@/components/bia-setup-fields";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CurrencyCombobox, LocationPickerModal } from "./bias";
import { BIA_DESTINACOES, BIA_OBJETIVOS } from "@shared/bia-form-options";
import { EMPTY_BIA_INFO } from "@/components/bia-information-fields";
import { uploadBiaFiles } from "@/lib/bia-upload";
import { Switch } from "@/components/ui/switch";
import { BiaNumberInput, BiaRoleComposition } from "@/components/bia-role-composition";
import { BiaEconomicStructureFields, EconomicMapPreview, emptyEconomicStructure } from "@/components/bia-economic-structure";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateInitialMap, type InitialMapParticipantInput } from "@shared/member-portfolio";
import { validateInitialClassifications, withAutomaticEconomicRights } from "@shared/initial-contributions";
import { biaTeamFromMapParticipants, hasRequiredBiaTeam } from "@shared/bia-access";
import { formatBiaNumber, formatBiaPercent } from "@shared/bia-numbers";
import { BiaReviewSummary } from "@/components/bia-review-summary";
import { BiaPdfDialog } from "@/components/bia-pdf-dialog";
import { BiaBrandPreview, useBiaBrand } from "@/components/bia-brand-preview";

const steps=BIA_CREATION_STEPS;
const empty={estrutura_bia:emptyBiaSetup(),nome_bia:"",objetivo_alianca:"",destinacao:"",moeda:"BRL",localizacao:"",latitude:null as number|null,longitude:null as number|null,observacoes:"",imagem_directus_id:"",anexos:[] as string[],selo_certified_alliance:false,info_comercial:EMPTY_BIA_INFO,valor_geral_venda_vgv:NaN,valor_realizado_venda:NaN,comissao_prevista_corretor:NaN,ir_previsto:NaN,inss_previsto:NaN,manutencao_pos_obra_prevista:NaN,map_inicial:{modeloCalculo:5,estrutura:emptyEconomicStructure,valorOrigem:NaN,participantes:[] as InitialMapParticipantInput[]}};
export default function BiaNovaPage(){
  const params=useParams<{id?:string}>();
  const [id,setId]=useState(params.id || "");
  const creationKey=useRef(crypto.randomUUID());
  const reviewRef=useRef<HTMLDivElement>(null);
  const [concluding,setConcluding]=useState(false);
  const [locationOpen,setLocationOpen]=useState(false);
  const [form,setForm]=useState(empty),[saved,setSaved]=useState(JSON.stringify(empty));
  const [revision,setRevision]=useState(0),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
  const dirty=JSON.stringify(form)!==saved;
  const generalPending=[!form.nome_bia?.trim() && "Nome",!form.destinacao && "Destinação",!form.objetivo_alianca && "Objetivo",!form.localizacao?.trim() && "Localização",!form.observacoes?.trim() && "Descrição"].filter(Boolean);
  useUnsavedChanges(dirty || busy);
  const members=useQuery<any[]>({queryKey:["/api/membros"]});
  const cppTypes=useQuery<Array<{id:string;Nome:string}>>({queryKey:["/api/tipos-cpp"]});
  const defaults=useQuery<any>({queryKey:["/api/bias-criacao/contexto"]});
  const draft=useQuery<any>({queryKey:["/api/bias",params.id,"rascunho"],enabled:!!params.id});
  const brand=useBiaBrand(id,form.nome_bia,step===5);
  const loaded=useRef(false);
  useEffect(()=>{if(draft.data && !loaded.current){loaded.current=true;const restored={...empty,...draft.data.dados,estrutura_bia:legacyBiaSetup(draft.data.dados)};setForm(restored);setSaved(JSON.stringify(restored));setRevision(draft.data.revisao);setDone(draft.data.concluido);setConcluding(!!draft.data.conclusao_iniciada);}},[draft.data]);
  useEffect(()=>{if(!params.id && defaults.data && !loaded.current){loaded.current=true;const participantes=defaults.data.participantes.map((p:InitialMapParticipantInput)=>({...p,modeloCalculo:5,cotasInvestimento:NaN}));setForm(current=>({...current,map_inicial:{...current.map_inicial,participantes:current.map_inicial.participantes.length?current.map_inicial.participantes:participantes}}));setSaved(JSON.stringify({...empty,map_inicial:{...empty.map_inicial,participantes}}));}},[params.id,defaults.data]);
  const preview=useMemo(()=>{try{
    const team=biaTeamFromMapParticipants(form.map_inicial.participantes);
    const participants=form.map_inicial.modeloCalculo===5 ? withAutomaticEconomicRights(form.map_inicial.participantes,cppTypes.data || []) : form.map_inicial.participantes;
    const map=calculateInitialMap(form.map_inicial.valorOrigem,participants,form.map_inicial.estrutura);
    validateInitialClassifications(map.participantes);return {map,error:"",teamPending:!hasRequiredBiaTeam(team)};
  }catch(e:any){return {map:null,error:e.message,teamPending:true};}},[form.map_inicial,cppTypes.data]);
  const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:form.moeda}).format(n);
  async function save(conclude=false){
    setBusy(true);setError("");
    try{
      const data=await (await (concluding && id
        ? apiRequest("GET",`/api/bias/${id}/rascunho`)
        : apiRequest(id?"PUT":"POST",id?`/api/bias/${id}/rascunho`:"/api/bias",{...form,map_inicial:form.map_inicial.modeloCalculo===5 && cppTypes.data ? {...form.map_inicial,participantes:withAutomaticEconomicRights(form.map_inicial.participantes,cppTypes.data)} : form.map_inicial,_rascunho:true,chaveCriacao:creationKey.current,revisaoEsperada:revision}))).json();
      const restored={...empty,...data.dados,estrutura_bia:legacyBiaSetup(data.dados)};setId(data.bia_id);setRevision(data.revisao);setForm(restored);setSaved(JSON.stringify(restored));setConcluding(!!data.conclusao_iniciada);
      queryClient.invalidateQueries({queryKey:["/api/bias"]});queryClient.invalidateQueries({queryKey:["/api/bias-rascunhos"]});
      if(data.apresentacao_pendente)throw new Error("Rascunho salvo, mas não foi possível atualizar o nome e a capa na lista de BIAs. Clique em Salvar rascunho novamente para tentar sincronizar.");
      if(conclude){try{await apiRequest("POST",`/api/bias/${data.bia_id}/concluir-estruturacao`,{revisaoEsperada:data.revisao});setDone(true);}catch(error){const fresh=await (await apiRequest("GET",`/api/bias/${data.bia_id}/rascunho`)).json();setConcluding(!!fresh.conclusao_iniciada);throw error;}}
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  const field=(name:keyof Omit<typeof empty,"map_inicial">,value:string)=>setForm(f=>({...f,[name]:value}));
  async function upload(files:File[],cover=false) {
    setBusy(true);setError("");
    try {
      const ids=await uploadBiaFiles(files);
      setForm(f=>cover?({...f,imagem_directus_id:ids[0]}):({...f,anexos:[...f.anexos,...ids]}));
    } catch(e:any) {setError(e.message);} finally {setBusy(false);}
  }
  if(params.id && draft.isPending)return <p className="p-8">Carregando estruturação…</p>;
  if(params.id && draft.isError)return <div className="p-8" role="alert">Não foi possível abrir o rascunho. <Button onClick={()=>draft.refetch()}>Tentar novamente</Button></div>;
  if(done)return <div className="mx-auto max-w-3xl space-y-5 p-8"><Check className="h-10 w-10 text-emerald-600"/><h1 className="text-3xl font-bold">Estruturação concluída</h1><p>A BIA segue para captação e aceite dos participantes. Nenhum lançamento financeiro foi criado.</p><div className="flex flex-wrap gap-3"><Button asChild><Link href={`/bias/${id}`}>Abrir BIA</Link></Button><Button variant="outline" asChild><Link href={`/bias/${id}?tab=capital&capital=financeiro&financeiro=aportes`}>Configurar aportes e parcelas</Link></Button></div></div>;
  return <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-6 sm:px-8">
    <Link href="/area-aliancas?tab=bias" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Voltar para BIAs</Link>
    <header className="flex flex-wrap items-center gap-4"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Nova aliança</p><h1 className="mt-2 text-3xl font-bold">{form.nome_bia || "Nova BIA"}</h1></div><span className="rounded-md bg-amber-50 px-3 py-1 text-sm text-amber-800">Em estruturação</span></header>
    <nav aria-label="Etapas da criação" className="grid grid-cols-2 gap-2 border-b pb-6 sm:grid-cols-4 2xl:grid-cols-7">{steps.map((label,n)=><button key={label} type="button" aria-current={step===n?"step":undefined} className={`flex items-center gap-2 rounded-lg p-3 text-left text-sm ${step===n?"bg-blue-50 font-semibold text-blue-600":"text-muted-foreground"}`} onClick={()=>setStep(n)}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step===n?"bg-blue-600 text-white":"bg-muted"}`}>{n+1}</span>{label}</button>)}</nav>
    <div className={`grid min-w-0 items-start gap-8 ${step<=1 || form.map_inicial.modeloCalculo===5 && step>=2?"":"xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <fieldset disabled={busy || concluding} className="min-w-0 space-y-6">
        {concluding && <p role="status" className="rounded border p-3">A conclusão já foi iniciada. Os dados estão preservados; use Concluir estruturação para recuperar a operação sem duplicar convites.</p>}
        {step===0 && <><h2 className="text-xl font-semibold">Dados da BIA</h2><div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm sm:col-span-2">Nome da BIA *<Input value={form.nome_bia} onChange={e=>field("nome_bia",e.target.value)} maxLength={200}/></label>
          <div className="space-y-2 text-sm sm:col-span-2"><p>Imagem da BIA</p>{form.imagem_directus_id && <div className="flex items-center gap-3"><img className="h-24 w-40 rounded-lg object-cover" src={`/api/assets/${form.imagem_directus_id}`} alt="Capa da BIA"/><Button variant="ghost" onClick={()=>field("imagem_directus_id","")}>Remover imagem</Button></div>}<p className="text-muted-foreground">Use uma imagem horizontal para aparecer nos cards da BIA.</p><Input aria-label="Escolher imagem da BIA" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{if(e.target.files?.length)void upload(Array.from(e.target.files),true);e.target.value="";}}/></div>
          <div className="space-y-2 text-sm sm:col-span-2"><p id="destinacao-label">Destinação *</p><ToggleGroup type="single" aria-labelledby="destinacao-label" value={form.destinacao} onValueChange={v=>field("destinacao",v)} className="justify-start flex-wrap gap-2" data-testid="toggle-destinacao">{BIA_DESTINACOES.map(opt=><ToggleGroupItem key={opt} value={opt} className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold px-4">{opt}</ToggleGroupItem>)}</ToggleGroup></div>
          <div className="space-y-2 text-sm"><p>Moeda da BIA</p><CurrencyCombobox value={form.moeda} onChange={v=>field("moeda",v)}/></div>
          <div className="space-y-2 text-sm"><p>Localização *</p><Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" onClick={()=>setLocationOpen(true)}>{form.localizacao || "Selecionar no Mapa"}</Button></div>
          <div className="space-y-2 text-sm sm:col-span-2"><p id="objetivo-label">Objetivo da Aliança *</p><ToggleGroup type="single" aria-labelledby="objetivo-label" value={form.objetivo_alianca} onValueChange={v=>field("objetivo_alianca",v)} className="justify-start flex-wrap gap-2" data-testid="toggle-objetivo">{BIA_OBJETIVOS.map(opt=><ToggleGroupItem key={opt} value={opt} className="border border-input data-[state=on]:border-brand-gold data-[state=on]:bg-brand-gold/10 data-[state=on]:text-brand-gold px-4">{opt}</ToggleGroupItem>)}</ToggleGroup></div>
          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2"><div><p>Selo Certified Alliance</p><p className="text-xs text-muted-foreground">Esta BIA foi validada por um Aliado BUILT</p></div><Switch aria-label="Selo Certified Alliance" checked={form.selo_certified_alliance} onCheckedChange={selo_certified_alliance=>setForm(f=>({...f,selo_certified_alliance}))}/></div>
          <p className="text-sm text-muted-foreground sm:col-span-2">A BIA permanece privada durante a estruturação e captação.</p>
          <label className="text-sm sm:col-span-2">Descrição *<textarea className="mt-2 min-h-28 w-full rounded border bg-background p-3" value={form.observacoes} onChange={e=>field("observacoes",e.target.value)}/></label>
          <div className="space-y-2 sm:col-span-2"><p className="text-sm">Anexos</p><Input aria-label="Adicionar anexos" type="file" multiple onChange={e=>{if(e.target.files?.length)void upload(Array.from(e.target.files));e.target.value="";}}/>{form.anexos.map((id,n)=><div className="flex items-center justify-between" key={id}><a href={`/api/assets/${id}`} target="_blank" rel="noopener noreferrer">Anexo {n+1}</a><Button variant="ghost" onClick={()=>setForm(f=>({...f,anexos:f.anexos.filter(x=>x!==id)}))}>Remover anexo {n+1}</Button></div>)}</div>
        </div></>}
        {step===1 && form.map_inicial.modeloCalculo===5 && <><div><h2 className="text-xl font-semibold">Base econômica inicial</h2><p className="mt-1 text-sm text-muted-foreground">Estruture o capital, as CIs, a integralização e os direitos econômicos para gerar o MAP Inicial.</p></div><BiaEconomicStructureFields biaName={form.nome_bia} value={form.map_inicial} moeda={form.moeda} members={members.data || []} onChange={value=>setForm(f=>({...f,map_inicial:{...f.map_inicial,...value,estrutura:value.estrutura!}}))}/></>}
        {step===1 && form.map_inicial.modeloCalculo!==5 && <>
          <div><h2 className="text-xl font-semibold">Equipe e DM</h2><p className="mt-1 text-sm text-muted-foreground">Informe o valor de origem, os participantes e o DM de cada cargo. O capital é informado uma única vez por pessoa.</p></div>
          <section aria-label="Totais da composição" className="rounded-lg border bg-card p-5">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
              <label className="space-y-2 text-sm">Valor de Origem ({form.moeda})<BiaNumberInput label="Valor de Origem" value={form.map_inicial.valorOrigem} onChange={valorOrigem=>setForm(f=>({...f,map_inicial:{...f.map_inicial,valorOrigem}}))}/></label>
              <div className="lg:pl-5"><p className="text-sm text-muted-foreground">DM total</p><p className="mt-2 text-xl font-semibold">{preview.map?formatBiaPercent(preview.map.divisorMultiplicador):"Pendente"}</p></div>
              <div className="lg:pl-5"><p className="text-sm text-muted-foreground">Capital total informado</p><p className="mt-2 text-xl font-semibold">{form.map_inicial.participantes.some(p=>Number.isFinite(p.capitalComprometido))?money(form.map_inicial.participantes.reduce((total,p)=>total+(Number.isFinite(p.capitalComprometido)?p.capitalComprometido!:0),0)):"Pendente"}</p></div>
              <div className="lg:pl-5"><p className="text-sm text-muted-foreground">BEI (estimada)</p><p className="mt-2 text-xl font-semibold">{preview.map?money(preview.map.baseEconomicaInicial):"Pendente"}</p></div>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">O DM não é a participação final na BIA. A composição completa e a participação de cada pessoa aparecem no MAP Inicial.</p>
          </section>
          <BiaRoleComposition compact valorOrigem={form.map_inicial.valorOrigem} moeda={form.moeda} participants={form.map_inicial.participantes} members={members.data || []} onChange={participantes=>setForm(f=>({...f,map_inicial:{...f.map_inicial,participantes}}))}/>
        </>}
        {(step===2 || step===5) && <div ref={reviewRef} className="space-y-5"><h2 data-print-hide className="text-xl font-semibold">{step===2?"Prévia do MAP Inicial":"Revisar estruturação"}</h2>{step===5 && preview.map && <BiaReviewSummary form={form} map={preview.map}/>} {form.map_inicial.modeloCalculo===5 && <p data-print-hide className="text-sm text-muted-foreground">CPPs calculadas, somente leitura. Para alterar, volte à Base econômica inicial. Equivalentes monetários não são capital adicional.</p>}{preview.map && form.map_inicial.modeloCalculo===5 && <EconomicMapPreview map={preview.map} moeda={form.moeda}/>} {form.map_inicial.modeloCalculo!==5 && preview.map?.participantes.map(p=><div key={p.participantId} data-pdf-section="map" className="space-y-3 border-b pb-4"><h3 className="font-semibold">{p.nome} · {p.tipo === "guardiao"?"Guardião":"Multiplicador"}</h3><div className="flex flex-wrap gap-5 text-sm"><span>Capital: {money(p.capitalComprometido ?? p.cppCapital)}</span>{p.modeloCalculo===5?<><span>CIs: {formatBiaNumber(p.cotasInvestimento!,5)}</span><span>CPP do capital: {formatBiaPercent(p.cppCapitalPercentual!)}</span><span>Direitos: {formatBiaPercent(p.indiceContribuicao)}</span></>:<span>CPP total: {money(p.cppTotal)}</span>}<strong>CPP total: {formatBiaPercent(p.mapPercentual)}</strong></div>{p.contribuicoes?.map(c=><p key={c.cargo} className="text-sm text-muted-foreground">{c.cargo} · {formatBiaPercent(c.indice)} · {c.tipoCpp?.nome || "Sem contribuição"} · {money(c.valor || 0)}</p>)}</div>)}{step===5 && <BiaSetupSummary value={form.estrutura_bia} moeda={form.moeda} anexos={form.anexos}/>} {step===5 && <p data-print-hide className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">Concluir inicia os convites e documentos dos participantes. Não ativa movimentações financeiras nem gera parcelas.</p>}</div>}
        {step===3 && <BiaLegalFields disabled={busy || concluding} value={form.estrutura_bia} participants={form.map_inicial.participantes} onChange={estrutura_bia=>setForm(f=>({...f,estrutura_bia}))}/>}
        {step===4 && <BiaAssetFields value={form.estrutura_bia} moeda={form.moeda} onChange={estrutura_bia=>setForm(f=>({...f,estrutura_bia}))}/>}
        {(step===5 || step===6) && <section className="space-y-3 rounded-lg border p-5"><h2 className="text-xl font-semibold">{step===6?"Ativação da BIA":"Conferência da estruturação"}</h2>{[
          {step:0,label:"Dados da BIA",errors:generalPending},
          {step:1,label:"Base Econômica Inicial",errors:preview.error?[preview.error]:[]},
          {step:2,label:"MAP Inicial e equipe",errors:preview.teamPending?["Defina Aliado e Diretor de Aliança."]:[]},
          {step:3,label:"Estrutura Jurídica",errors:legalBlockers(form.estrutura_bia),pending:setupWarnings(form.estrutura_bia).some(w=>!w.startsWith("Ativo"))},
          {step:4,label:"Ativos Vinculados",errors:[],pending:!form.estrutura_bia.ativos.length},
          {step:0,label:"Documentos informativos",errors:[],pending:!form.anexos.length},
        ].map((item,i)=><div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><span>{item.label}: {item.errors.length?"✕ Impede ativação":item.pending?"⚠ Pendente — não impede ativação":"✓ Completo"}{item.errors.length>0 && <span className="block text-sm text-destructive">{item.errors.join(" · ")}</span>}</span><Button variant="ghost" onClick={()=>setStep(item.step)}>Revisar</Button></div>)}
          {setupWarnings(form.estrutura_bia).map(w=><p key={w} className="text-sm text-amber-800">⚠ Pendente: {w} Não impede a ativação.</p>)}
          {step===6 && <p>Concluir encaminha a BIA para Em captação. Após os aceites obrigatórios, ficará Ativa junto da fase operacional. Não são gerados lançamentos financeiros.</p>}
        </section>}
        {step===5 && <BiaBrandPreview name={form.nome_bia} brand={brand}/>}
        {preview.error && step>0 && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Composição pendente: {preview.error}</p>}
        {step>0 && !form.nome_bia.trim() && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Para salvar o rascunho, informe o Nome da BIA na etapa Dados da BIA. Isso não impede a prévia do MAP Inicial. <Button type="button" variant="ghost" className="h-auto whitespace-normal p-0 underline" onClick={()=>setStep(0)}>Preencher nome da BIA</Button></p>}
        {step===5 && generalPending.length>0 && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Dados pendentes: {generalPending.join(", ")}. Complete a etapa Dados da BIA antes de concluir.</p>}
        {step===5 && preview.map && preview.teamPending && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">O MAP Inicial foi calculado. Para concluir a estruturação, defina Aliado BUILT e Diretor de Aliança na Base econômica inicial. Autor é opcional.</p>}
        {error && <p role="alert" className="rounded border border-red-300 p-4 text-sm text-red-700">{error}</p>}
        {(members.isError || defaults.isError) && <div role="alert" className="space-y-2"><p>Não foi possível carregar membros ou equipe automática. A prévia usa os dados já preenchidos; recarregue as consultas antes de concluir.</p><Button type="button" variant="outline" disabled={members.isFetching || defaults.isFetching} onClick={()=>{void members.refetch();void defaults.refetch();}}>Tentar carregar novamente</Button></div>}
      </fieldset>
      {step>1 && !(form.map_inicial.modeloCalculo===5 && step>=2) && <aside className="space-y-6 rounded-xl bg-[#001d32] p-6 text-white xl:sticky xl:top-6"><h2 className="text-lg font-semibold">Resumo econômico da BIA</h2><div><p className="text-sm text-slate-300">Valor de Origem</p><p className="mt-2 text-2xl font-semibold">{Number.isFinite(form.map_inicial.valorOrigem)?money(form.map_inicial.valorOrigem):"Pendente"}</p></div><div className="border-t border-white/20 pt-5"><p className="text-sm text-slate-300">DM total</p><p className="mt-2 text-2xl font-semibold">{preview.map?formatBiaPercent(preview.map.divisorMultiplicador):"Composição pendente"}</p></div><div className="border-t border-white/20 pt-5"><p className="text-sm text-slate-300">{form.map_inicial.modeloCalculo===5?"Referência patrimonial (VO)":"Base Econômica Inicial"}</p><p className="mt-2 text-2xl font-semibold">{preview.map?money(preview.map.baseEconomicaInicial):"—"}</p></div><p className="text-sm text-slate-300">Capital por pessoa e direitos por cargo. A BEI é o conjunto de condições; a participação final aparece no MAP Inicial.</p></aside>}
    </div>
    <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-4"><Button variant="outline" disabled={step===0 || busy} onClick={()=>setStep(s=>s-1)}>Voltar</Button><div className="flex flex-wrap gap-2">{step===5 && <BiaPdfDialog reviewRef={reviewRef} name={form.nome_bia} disabled={busy || !preview.map} modelFive={form.map_inicial.modeloCalculo===5} certified={form.selo_certified_alliance===true} brandUrl={brand.url} brandCode={brand.code}/>}<Button variant="outline" disabled={busy || !form.nome_bia.trim()} onClick={()=>save()}>{busy?"Salvando…":"Salvar rascunho"}</Button>{step<6?<Button disabled={busy || (step===0 && !form.nome_bia.trim()) || (step===1 && !preview.map)} onClick={()=>setStep(s=>s+1)}>{step===1 && form.map_inicial.modeloCalculo===5?"Gerar MAP Inicial":"Continuar"}<ArrowRight className="ml-2 h-4 w-4"/></Button>:<Button disabled={busy || legalBlockers(form.estrutura_bia).length>0 || generalPending.length>0 || !preview.map || preview.teamPending || !form.nome_bia.trim() || members.isError || defaults.isError} onClick={()=>save(true)}>Concluir estruturação</Button>}</div></footer>
    {!!id && !dirty && <p className="text-sm text-muted-foreground">Rascunho salvo · revisão {revision}. <Link className="underline" href={`/bias/${id}/estruturacao`}>Link para continuar depois</Link></p>}
    <LocationPickerModal open={locationOpen} onClose={()=>setLocationOpen(false)} onSelect={(localizacao,latitude,longitude)=>{setForm(f=>({...f,localizacao,latitude,longitude}));setLocationOpen(false);}}/>
  </main>;
}
