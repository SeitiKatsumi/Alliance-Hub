import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { biaBrandDataUrl, buildBiaBrandSvg, downloadBiaBrandPng, loadBiaBrandArtwork } from "../lib/bia-brand";

export function useBiaBrand(id: string, name: string, enabled: boolean) {
  const draft=useQuery<{codigo_publico?:string|null;codigo_publico_indisponivel?:boolean}>({queryKey:["/api/bias",id,"rascunho"],enabled:enabled && !!id});
  const artwork=useQuery({queryKey:["/branding/bia-brand-artwork.png"],queryFn:()=>loadBiaBrandArtwork(),enabled});
  const code=typeof draft.data?.codigo_publico === "string" ? draft.data.codigo_publico.trim() || null : null;
  const error=artwork.isError ? "Não foi possível carregar a arte da marca." : id && (draft.isError || !draft.isPending && (!code || draft.data?.codigo_publico_indisponivel)) ? "Não foi possível obter o código oficial desta BIA." : "";
  const loading=artwork.isPending || !!id && draft.isPending;
  const url=useMemo(()=>artwork.data && !error && !loading ? biaBrandDataUrl(buildBiaBrandSvg(name,code,artwork.data)) : "",[name,code,artwork.data,error,loading]);
  return {url,code,error,loading,retry:()=>{void artwork.refetch();if(id)void draft.refetch();}};
}

export function BiaBrandPreview({name,brand}:{name:string;brand:ReturnType<typeof useBiaBrand>}) {
  const [downloading,setDownloading]=useState(false),[error,setError]=useState("");
  return <section aria-label="Marca personalizada da BIA" data-print-hide className="rounded-xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Marca da BIA</h2>
    <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
      {brand.url && <img src={brand.url} alt={`Marca de ${name || "BIA em estruturação"}`} className="w-48 max-w-full shrink-0"/>}
      <div className="min-w-0 space-y-3 text-sm">
        <p className="text-muted-foreground">Nome e código são preenchidos automaticamente. Esta marca será usada no PDF, sem substituir a foto/capa.</p>
        {brand.loading && <p role="status">Preparando marca…</p>}
        {brand.error && <div role="alert"><p>{brand.error}</p><Button type="button" variant="outline" className="mt-2" onClick={brand.retry}>Tentar carregar marca novamente</Button></div>}
        {!brand.loading && !brand.error && !brand.code && <p>Salve o rascunho para obter o código e liberar o download definitivo.</p>}
        <Button type="button" variant="outline" disabled={!brand.url || !name.trim() || !brand.code || downloading} onClick={async()=>{
          setDownloading(true);setError("");
          try {await downloadBiaBrandPng(brand.url,name,brand.code);} catch(e) {setError(e instanceof Error?e.message:"Não foi possível baixar a marca.");} finally {setDownloading(false);}
        }}>{downloading?"Gerando PNG…":"Baixar marca em PNG"}</Button>
        <p className="text-xs text-muted-foreground">PNG em alta resolução · 1352 × 1412 pixels</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </div>
    </div>
  </section>;
}
