import { useState, type RefObject } from "react";
import { FileDown } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { biaPdfSections, printBiaSummary, type BiaPdfSection } from "../lib/print-bia-summary";

export function BiaPdfDialog({reviewRef,name,disabled,modelFive}:{reviewRef:RefObject<HTMLDivElement|null>;name:string;disabled:boolean;modelFive:boolean}) {
  const [open,setOpen]=useState(false),[error,setError]=useState("");
  const [selected,setSelected]=useState<BiaPdfSection[]>(biaPdfSections.map(s=>s.id));
  const available=biaPdfSections.filter(s=>modelFive || s.id==="dados" || s.id==="map");
  const sections=selected.filter(id=>available.some(s=>s.id===id));
  return <Dialog open={open} onOpenChange={value=>{setOpen(value);setError("");}}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled}><FileDown className="mr-2 h-4 w-4"/>Salvar resumo em PDF</Button></DialogTrigger>
    <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
      <DialogHeader><DialogTitle>O que deseja incluir no PDF?</DialogTitle><DialogDescription>Escolha as seções do resumo de {name || "sua BIA"}. Os dados preenchidos não serão alterados.</DialogDescription></DialogHeader>
      <div className="space-y-2">{available.map(section=><label key={section.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-[#b9a36b] has-[:checked]:bg-[#b9a36b]/5">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#001d32]" checked={selected.includes(section.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,section.id]:current.filter(id=>id!==section.id))}/>
        <span><span className="block text-sm font-semibold">{section.label}</span><span className="mt-1 block text-xs text-muted-foreground">{section.description}</span></span>
      </label>)}</div>
      <p className="text-xs text-muted-foreground">Documento de revisão, sem concluir a BIA. Na impressão, escolha o destino “Salvar como PDF”.</p>
      {!sections.length && <p role="status" className="text-sm text-amber-700">Selecione pelo menos uma seção.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="button" disabled={disabled || !sections.length} onClick={()=>{
        if(!reviewRef.current)return;
        if(printBiaSummary(reviewRef.current,name,sections)){setOpen(false);setError("");}
        else setError("Permita pop-ups neste site para abrir o PDF e tente novamente.");
      }}>Gerar PDF</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
