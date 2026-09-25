import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Info } from "lucide-react";
import type { InitialMapCalculation } from "@shared/member-portfolio";
import { biaPhaseLabel, type BiaPhase } from "@shared/bia-phase";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { BiaMapHistory } from "./bia-map-history";
import { BiaReviewSummary } from "./bia-review-summary";
import { biaBrandDataUrl, buildBiaBrandSvg, buildBiaHeaderSvg, downloadBiaBrandPng, loadBiaBrandArtwork } from "../lib/bia-brand";
import { printBiaSummary } from "../lib/print-bia-summary";

type BiaData = {
  id: string; nome_bia: string; codigo_publico?: string | null; situacao?: string | null;
  destinacao?: string | null; objetivo_alianca?: string; moeda?: string | null;
  localizacao?: string; observacoes?: string; selo_certified_alliance?: boolean | null;
  map_inicial?: InitialMapCalculation | null;
};

export function BiaDataDialog({ bia }: { bia: BiaData }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Info className="h-4 w-4"/>Dados da BIA</Button></DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Dados da BIA</DialogTitle><DialogDescription>{bia.nome_bia} · Resumo, marcas personalizadas e MAP Inicial.</DialogDescription></DialogHeader>
      {open && <BiaDataContent bia={bia}/>}
    </DialogContent>
  </Dialog>;
}

function BiaDataContent({ bia }: { bia: BiaData }) {
  const queries = useQueryClient();
  const summaryRef = useRef<HTMLDivElement>(null), brandsRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(""), [downloading, setDownloading] = useState(false);
  // Identity comes from the authorized BIA detail, never its internal ID or draft defaults.
  const code = bia.codigo_publico?.trim() || null;
  const art = useQuery({queryKey:["/branding/bia-brand-artwork.png"],queryFn:()=>loadBiaBrandArtwork()});
  const headerArt = useQuery({queryKey:["/branding/bia-header-artwork.png"],queryFn:()=>loadBiaBrandArtwork("/branding/bia-header-artwork.png")});
  const vertical = useMemo(()=>art.data ? biaBrandDataUrl(buildBiaBrandSvg(bia.nome_bia,code,art.data)) : "",[art.data,bia.nome_bia,code]);
  const horizontal = useMemo(()=>headerArt.data ? biaBrandDataUrl(buildBiaHeaderSvg(bia.nome_bia,code,headerArt.data)) : "",[headerArt.data,bia.nome_bia,code]);
  const canExport = !!code && !!bia.nome_bia.trim() && !!vertical && !!horizontal;
  const form = {nome_bia:bia.nome_bia,destinacao:bia.destinacao || "",objetivo_alianca:bia.objetivo_alianca || "",moeda:bia.moeda || "BRL",localizacao:bia.localizacao || "",observacoes:bia.observacoes || ""};
  const rows = [["Código público",code ? `BIA-${code}` : "Código oficial indisponível"],["Situação",biaPhaseLabel(bia.situacao as BiaPhase)]];
  if (!bia.map_inicial) rows.push(["Nome",form.nome_bia],["Destinação",form.destinacao],["Objetivo",form.objetivo_alianca],["Moeda",form.moeda],["Localização",form.localizacao],["Descrição",form.observacoes]);
  function pdf(element: HTMLDivElement | null) {
    setError("");
    if (!element || !canExport) return;
    if (!printBiaSummary(element,bia.nome_bia,["dados","condicoes"],bia.selo_certified_alliance===true,vertical,code,"data")) setError("Permita pop-ups neste site para abrir o PDF e tente novamente.");
  }
  async function png(url: string, landscape: boolean) {
    setDownloading(true); setError("");
    try { await downloadBiaBrandPng(url,bia.nome_bia,code,landscape); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível baixar a marca."); }
    finally { setDownloading(false); }
  }
  return <div className="min-h-0 overflow-y-auto pr-1">
    {!code && <div role="status" className="mb-3 text-sm text-amber-700"><p>Código oficial indisponível. Recarregue os dados da BIA para liberar as marcas e o resumo em PDF; nenhum código será criado aqui.</p><Button variant="outline" onClick={()=>void queries.invalidateQueries({queryKey:["/api/bias"]})}>Recarregar dados da BIA</Button></div>}
    {(art.isError || headerArt.isError) && <div role="alert" className="mb-3 text-sm">Não foi possível carregar as marcas. <Button variant="outline" onClick={()=>{void art.refetch();void headerArt.refetch();}}>Tentar novamente</Button></div>}
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <Tabs defaultValue="resumo" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="resumo">Resumo</TabsTrigger><TabsTrigger value="marcas">Marcas</TabsTrigger><TabsTrigger value="map">MAP Inicial</TabsTrigger></TabsList>
      <TabsContent value="resumo" className="space-y-4">
        <div ref={summaryRef} className="space-y-4">
          <section data-pdf-section="dados" className="rounded-lg border p-5"><h2 className="mb-3 text-lg font-semibold">Identificação da BIA</h2><dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">{rows.map(([label,value])=><Fragment key={label}><dt className="font-medium">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{value || "Não informado"}</dd></Fragment>)}</dl></section>
          {bia.map_inicial && <BiaReviewSummary form={form} map={bia.map_inicial} consultation/>}
        </div>
        <Button variant="outline" disabled={!canExport} onClick={()=>pdf(summaryRef.current)}><FileDown className="mr-2 h-4 w-4"/>Salvar resumo em PDF</Button>
        <p className="text-xs text-muted-foreground">Somente consulta. Para alterar dados, estrutura jurídica ou ativos, use Editar.</p>
      </TabsContent>
      <TabsContent value="marcas" className="space-y-4">
        <p className="text-sm text-muted-foreground">Marcas com nome e código oficial da BIA. Os downloads não substituem a capa e não alteram documentos emitidos.</p>
        {(art.isPending || headerArt.isPending) && <p role="status">Preparando marcas…</p>}
        <div ref={brandsRef}><section data-pdf-section="dados"><h2 className="mb-4 text-lg font-semibold">Marcas personalizadas</h2>
          <div className="bia-brand-gallery grid gap-4 sm:grid-cols-[1fr_2fr]" style={{breakInside:"avoid"}}>
            <div className="rounded-lg border p-4"><h3 className="mb-3 font-medium">Marca vertical</h3>{vertical && <img src={vertical} alt={`Marca vertical de ${bia.nome_bia}`} style={{width:"46mm",maxWidth:"100%",height:"auto"}}/>}<div data-print-hide className="mt-4"><Button variant="outline" disabled={!canExport || downloading} onClick={()=>png(vertical,false)}>Baixar PNG vertical</Button><p className="mt-2 text-xs text-muted-foreground">1352 × 1412 pixels</p></div></div>
            <div className="rounded-lg border p-4"><h3 className="mb-3 font-medium">Marca horizontal</h3>{horizontal && <img src={horizontal} alt={`Marca horizontal de ${bia.nome_bia}`} style={{width:"138mm",maxWidth:"100%",height:"auto"}}/>}<div data-print-hide className="mt-4"><Button variant="outline" disabled={!canExport || downloading} onClick={()=>png(horizontal,true)}>Baixar PNG horizontal</Button><p className="mt-2 text-xs text-muted-foreground">4344 × 1448 pixels</p></div></div>
          </div>
        </section></div>
        <Button variant="outline" disabled={!canExport} onClick={()=>pdf(brandsRef.current)}><FileDown className="mr-2 h-4 w-4"/>Salvar marcas em PDF</Button>
        <p className="text-xs text-muted-foreground">Na janela de impressão, escolha “Salvar como PDF”.</p>
      </TabsContent>
      <TabsContent value="map" className="space-y-4"><p className="text-sm text-muted-foreground">Escolha uma revisão registrada do MAP Inicial e abra seu PDF. O arquivo preserva os dados históricos, sem recalcular a participação atual.</p><BiaMapHistory biaId={bia.id} initialOnly/></TabsContent>
    </Tabs>
  </div>;
}
