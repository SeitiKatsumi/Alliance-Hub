import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BIA_PARTICIPANT_ROLE_FIELDS, BIA_PARTICIPANT_ROLE_LABELS } from "@shared/bia-access";
import { initialMapContributionValue, type InitialMapParticipantInput } from "@shared/member-portfolio";
import { formatBiaNumber, parseBiaNumber } from "@shared/bia-numbers";

export function BiaNumberInput({value,onChange,decimals=2,disabled=false,label}:{value:number;onChange:(n:number)=>void;decimals?:number;disabled?:boolean;label:string}) {
  const [text,setText]=useState(Number.isFinite(value)?formatBiaNumber(value,decimals):"");
  const [focused,setFocused]=useState(false);
  useEffect(()=>{if(!focused)setText(Number.isFinite(value)?formatBiaNumber(value,decimals):"");},[value,focused,decimals]);
  return <Input aria-label={label} inputMode="decimal" value={text} disabled={disabled} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{setText(e.target.value);onChange(parseBiaNumber(e.target.value));}} />;
}
const roles=Object.keys(BIA_PARTICIPANT_ROLE_FIELDS).map(r=>BIA_PARTICIPANT_ROLE_LABELS[r as keyof typeof BIA_PARTICIPANT_ROLE_FIELDS]);
export function BiaRoleComposition({participants,onChange,members,readOnly=false,dmOnly=false,compact=false,valorOrigem,moeda="BRL"}:{participants:InitialMapParticipantInput[];onChange:(p:InitialMapParticipantInput[])=>void;members:Array<{id:string;nome?:string|null;Nome_de_usuario?:string|null}>;readOnly?:boolean;dmOnly?:boolean;compact?:boolean;valorOrigem?:number;moeda?:string}) {
  const types=useQuery<Array<{id:string;Nome:string}>>({queryKey:["/api/tipos-cpp"]});
  const patch=(i:number,changes:Partial<InitialMapParticipantInput>)=>onChange(participants.map((p,n)=>n===i?{...p,...changes}:p));
  const selectClass=(id:string)=>{const t=types.data?.find(t=>String(t.id)===id);return t?{id:String(t.id),nome:t.Nome}:undefined;};
  const css="h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
  const participantActions=(p:InitialMapParticipantInput,i:number)=>!readOnly && <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={()=>patch(i,{contribuicoes:[...(p.contribuicoes || []),{cargo:"Contribuição individual",indice:NaN}]})}>Adicionar cargo</Button><Button size="sm" variant="ghost" onClick={()=>{if(window.confirm("Remover esta pessoa e todos os seus cargos e valores?"))onChange(participants.filter((_,n)=>n!==i));}}><Trash2 className="mr-2 h-4 w-4"/>Remover pessoa</Button></div>;
  const columns=compact?"lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_140px]":"lg:grid-cols-[1fr_1.3fr_130px]";
  return <div className={`min-w-0 space-y-4 ${compact?"rounded-lg border bg-card p-4 sm:p-5":""}`}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{compact?"Participantes":"Equipe e composição do DM"}</h2>{!dmOnly && !readOnly && <Button variant="outline" onClick={()=>onChange([...participants,{modeloCalculo:4,nome:"",memberId:"",tipo:"multiplicador",cargos:[],contribuicoes:[{cargo:"Contribuição individual",indice:NaN}],indiceContribuicao:NaN,pesoCapital:0,capitalComprometido:NaN,naturezaCapital:"caixa"}])}><Plus className="mr-2 h-4 w-4"/>Pessoa</Button>}</div>
    {!compact && <p className="text-sm text-muted-foreground">Uma linha por cargo. Os percentuais são somados por pessoa; DM não é a participação final.</p>}
    {types.isError && <p role="alert">Não foi possível carregar os tipos de CPP. <Button variant="outline" onClick={()=>types.refetch()}>Tentar novamente</Button></p>}
    <div className={`hidden gap-3 border-y bg-muted/40 py-3 text-sm text-muted-foreground lg:grid ${columns}`}><span>Participante</span><span>Cargo</span>{compact && <span>Capital ({moeda})</span>}<span>DM (%)</span></div>
    {participants.map((p,i)=><div key={i} role="group" aria-label={`Participante ${i+1}: ${p.nome || "a selecionar"}`} className="space-y-3 border-b pb-5">
      {(p.contribuicoes || []).map((c,j)=><div key={j} className={`grid min-w-0 items-start gap-3 ${columns}`}>
        {(!compact || j===0)?<label className="min-w-0 text-sm"><span className="lg:sr-only">Pessoa</span><select className={css} aria-label={`Pessoa — linha ${i+1}, cargo ${j+1}`} disabled={readOnly || dmOnly} value={p.memberId || ""} onChange={e=>{
          if(p.memberId && !window.confirm("Trocar a pessoa remove os valores desta ficha. Continuar?"))return;
          const m=members.find(m=>String(m.id)===e.target.value);
          patch(i,{memberId:e.target.value,participantId:`member:${e.target.value}`,nome:m?.nome || m?.Nome_de_usuario || "",capitalComprometido:NaN,tipoCppCapital:undefined,contribuicoes:p.contribuicoes?.map(c=>({...c,indice:NaN,tipoCpp:undefined}))});
        }}><option value="">Selecione a pessoa</option>{members.map(m=><option key={m.id} value={m.id} disabled={participants.some((other,n)=>n!==i && other.memberId===String(m.id))}>{m.nome || m.Nome_de_usuario || "Membro"}</option>)}</select></label>:<div aria-hidden="true" className="hidden lg:block"/>}
        <label className="min-w-0 text-sm"><span className="lg:sr-only">Cargo</span><select aria-label={`Cargo — ${p.nome} ${j+1}`} className={css} disabled={readOnly || dmOnly} value={c.cargo} onChange={e=>{
          if((c.indice>0 || c.tipoCpp) && !window.confirm("Trocar o cargo limpa o percentual e a classificação desta linha. Continuar?"))return;
          const rows=p.contribuicoes!.map((r,n)=>n===j?{cargo:e.target.value,indice:NaN}:r);
          patch(i,{contribuicoes:rows,cargos:rows.map(r=>r.cargo).filter(r=>r!=="Contribuição individual")});
        }}>{["Contribuição individual",...roles].map(role=><option key={role} disabled={role!==c.cargo && participants.some(other=>other.contribuicoes?.some(r=>r.cargo===role)) && role!=="Contribuição individual"}>{role}</option>)}</select></label>
        {compact && (j===0?<label className="min-w-0 text-sm"><span className="lg:sr-only">Capital ({moeda})</span><BiaNumberInput label={`Capital — ${p.nome}`} disabled={readOnly} value={p.capitalComprometido ?? NaN} onChange={capitalComprometido=>patch(i,{capitalComprometido})}/></label>:<div aria-hidden="true" className="hidden lg:block"/>)}
        <label className="text-sm"><span className="lg:sr-only">DM (%)</span><BiaNumberInput label={`DM — ${p.nome} — ${c.cargo}`} value={c.indice} decimals={5} disabled={readOnly} onChange={indice=>patch(i,{contribuicoes:p.contribuicoes!.map((r,n)=>n===j?{...r,indice}:r)})}/></label>
        {!compact && Number.isFinite(valorOrigem) && Number.isFinite(c.indice) && c.indice>=0 && <p className="text-sm text-muted-foreground lg:col-start-3">{new Intl.NumberFormat("pt-BR",{style:"currency",currency:moeda}).format(initialMapContributionValue(valorOrigem!,c.indice))}</p>}
        {!compact && !dmOnly && !readOnly && p.contribuicoes!.length>1 && <Button size="sm" variant="ghost" onClick={()=>{if(!window.confirm("Remover este cargo e sua contribuição?"))return;const rows=p.contribuicoes!.filter((_,n)=>n!==j);patch(i,{contribuicoes:rows,cargos:rows.filter(r=>r.cargo!=="Contribuição individual").map(r=>r.cargo)});}}>Remover cargo</Button>}
        {!compact && !dmOnly && <label className="text-sm lg:col-start-2 lg:col-span-2">CPP desta contribuição<select className={css} value={c.tipoCpp?.id || ""} disabled={readOnly} onChange={e=>patch(i,{contribuicoes:p.contribuicoes!.map((r,n)=>n===j?{...r,tipoCpp:selectClass(e.target.value)}:r)})}><option value="">Selecione quando houver contribuição</option>{types.data?.map(t=><option key={t.id} value={t.id}>{t.Nome}</option>)}</select></label>}
      </div>)}
      {!dmOnly && <>
        {participantActions(p,i)}
        <details className="rounded-lg bg-muted/40 p-3"><summary className="cursor-pointer text-sm font-medium">{compact?`Detalhes · ${p.tipo==="guardiao"?"Guardião":"Multiplicador"} · natureza, CPPs e cargos`:`Capital de ${p.nome || "participante"} · informado uma única vez`}{compact && (p.contribuicoes?.some(c=>c.indice>0 && !c.tipoCpp) || ((p.capitalComprometido || 0)>0 && !p.tipoCppCapital)) && <span className="ml-2 text-amber-800">Classificação pendente</span>}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Tipo<select className={css} disabled={readOnly} value={p.tipo} onChange={e=>patch(i,{tipo:e.target.value as any})}><option value="guardiao">Guardião</option><option value="multiplicador">Multiplicador</option></select></label>
          {!compact && <label className="text-sm">Capital comprometido<BiaNumberInput label={`Capital — ${p.nome}`} disabled={readOnly} value={p.capitalComprometido ?? NaN} onChange={capitalComprometido=>patch(i,{capitalComprometido})}/></label>}
          <label className="text-sm">Natureza<select className={css} disabled={readOnly} value={p.naturezaCapital || ""} onChange={e=>patch(i,{naturezaCapital:e.target.value as any})}><option value="caixa">Dinheiro</option><option value="nao_caixa">Propriedade, bens ou direitos</option></select></label>
          <label className="text-sm">CPP do capital<select className={css} disabled={readOnly} value={p.tipoCppCapital?.id || ""} onChange={e=>patch(i,{tipoCppCapital:selectClass(e.target.value)})}><option value="">Selecione quando houver capital</option>{types.data?.map(t=><option key={t.id} value={t.id}>{t.Nome}</option>)}</select></label>
        </div>
        {compact && (p.contribuicoes || []).map((c,j)=><div key={j} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3"><label className="min-w-0 flex-1 text-sm">CPP · {c.cargo}<select aria-label={`CPP — ${p.nome} — ${c.cargo}`} className={css} value={c.tipoCpp?.id || ""} disabled={readOnly} onChange={e=>patch(i,{contribuicoes:p.contribuicoes!.map((r,n)=>n===j?{...r,tipoCpp:selectClass(e.target.value)}:r)})}><option value="">Selecione quando houver contribuição</option>{types.data?.map(t=><option key={t.id} value={t.id}>{t.Nome}</option>)}</select></label>{!readOnly && p.contribuicoes!.length>1 && <Button size="sm" variant="ghost" onClick={()=>{if(!window.confirm("Remover este cargo e sua contribuição?"))return;const rows=p.contribuicoes!.filter((_,n)=>n!==j);patch(i,{contribuicoes:rows,cargos:rows.filter(r=>r.cargo!=="Contribuição individual").map(r=>r.cargo)});}}>Remover cargo</Button>}</div>)}
        </details>
      </>}
    </div>)}
  </div>;
}
