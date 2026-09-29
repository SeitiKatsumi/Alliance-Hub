import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EconomicMapPreview } from "./bia-economic-structure";
import type { InitialEconomicStructure, InitialMapParticipant } from "@shared/member-portfolio";
import { formatBiaPercent } from "@shared/bia-numbers";
import { biaBrandDataUrl, buildBiaBrandSvg, loadBiaBrandArtwork } from "../lib/bia-brand";
import { printBiaSummary } from "../lib/print-bia-summary";

type Row = { memberId: string; name: string; value: number; percent: number; group?: string };
type Version = { id: string; tipo: "zero" | "atual"; numero: number; revisao_base: number; criado_em: string;
  autor: { name?: string }; motivo: string; hash: string;
  snapshot?: { rows: Row[]; biaName: string; base: { moeda: string; modelo_calculo?: number; valor_origem: number; divisor_multiplicador: number; estrutura_economica?: InitialEconomicStructure; participantes?: InitialMapParticipant[] } } };
const label = (v: Version) => v.tipo === "zero" ? `MAP Inicial — revisão ${v.numero}` : `MAP ${v.numero}`;
const money = (value: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export function BiaMapVersionReport({version}:{version:Version}) {
  const snapshot=version.snapshot;
  if(!snapshot)return null;
  const base=snapshot.base;
  return <div>
    <section data-pdf-section="dados"><h2>{label(version)}</h2><p>Nova apresentação para consulta da revisão registrada. Não cria revisão nem substitui documentos assinados.</p>
      <dl><dt>Data da revisão</dt><dd>{new Date(version.criado_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</dd><dt>Responsável</dt><dd>{version.autor.name || "Sistema"}</dd><dt>Motivo registrado</dt><dd>{version.motivo}</dd><dt>Revisão da base</dt><dd>{version.revisao_base}</dd><dt>Hash da revisão de origem</dt><dd>{version.hash}</dd></dl>
    </section>
    {base.modelo_calculo===5 && base.estrutura_economica && base.participantes?.length ? <EconomicMapPreview moeda={base.moeda} map={{valorOrigem:base.valor_origem,divisorMultiplicador:base.divisor_multiplicador,estrutura:base.estrutura_economica,participantes:base.participantes}}/> : <section data-pdf-section="map"><h2>Participações registradas</h2><p>Composição histórica, sem conversão para outro modelo econômico.</p><table><thead><tr>{["Participante","Categoria registrada","Valor patrimonial registrado","Participação"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{snapshot.rows.map(r=><tr key={r.memberId}><th scope="row">{r.name}</th><td>{r.group || "Não informada"}</td><td>{money(r.value,base.moeda)}</td><td>{formatBiaPercent(r.percent)}</td></tr>)}</tbody></table></section>}
  </div>;
}

export function BiaMapHistory({ biaId, initialOnly = false, pdfCode }: { biaId: string; initialOnly?: boolean; pdfCode?: string | null }) {
  const [selected, setSelected] = useState("");
  const [comparison, setComparison] = useState("");
  const [pdfError,setPdfError]=useState("");
  const reportRef=useRef<HTMLDivElement>(null);
  const prefix = `/api/bias/${biaId}/map/versoes`;
  const versions = useQuery<Version[]>({ queryKey: [prefix], queryFn: async () => (await apiRequest("GET", prefix)).json() });
  const availableVersions=versions.data?.filter(v=>!initialOnly || v.tipo==="zero");
  const selectedId = selected || availableVersions?.[0]?.id || "";
  const detail = useQuery<Version>({ queryKey: [prefix, selectedId], enabled: !!selectedId,
    queryFn: async () => (await apiRequest("GET", `${prefix}/${selectedId}`)).json() });
  const previous = useQuery<Version>({ queryKey: [prefix, comparison], enabled: !!comparison,
    queryFn: async () => (await apiRequest("GET", `${prefix}/${comparison}`)).json() });
  const currentRows = detail.data?.snapshot?.rows || [];
  const priorRows = previous.data?.snapshot?.rows || [];
  const identities = Array.from(new Set([...currentRows, ...(comparison ? priorRows : [])].map((row) => row.memberId)));
  const currency = detail.data?.snapshot?.base.moeda || "BRL";
  const code=pdfCode?.trim() || null;
  const artwork=useQuery({queryKey:["/branding/bia-brand-artwork.png"],queryFn:()=>loadBiaBrandArtwork(),enabled:!!code && initialOnly && !!detail.data?.snapshot});
  const name=detail.data?.snapshot?.biaName || "";
  const brand=useMemo(()=>artwork.data && code && name?biaBrandDataUrl(buildBiaBrandSvg(name,code,artwork.data)):"",[artwork.data,code,name]);
  const canGenerate=initialOnly && !!code && !!brand && detail.data?.tipo==="zero" && detail.data.id===selectedId && !!detail.data.snapshot && !versions.isFetching && !versions.isError && !detail.isFetching && !detail.isError && !artwork.isError;

  return <Card><CardHeader><CardTitle>Histórico do MAP</CardTitle></CardHeader><CardContent className="space-y-4">
    {versions.isPending && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}
    {(versions.isError || detail.isError || (comparison && previous.isError)) && <p role="alert" className="text-sm text-red-600">Não foi possível carregar as versões. Atualize a página para tentar novamente.</p>}
    {availableVersions?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão registrada. As revisões serão preservadas ao salvar o MAP Inicial.</p>}
    {!!availableVersions?.length && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Versão<select className="block h-10 w-full rounded-md border bg-background px-3" value={selectedId} onChange={(e) => setSelected(e.target.value)}>
          {availableVersions.map((v) => <option value={v.id} key={v.id}>{label(v)}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Comparar com<select className="block h-10 w-full rounded-md border bg-background px-3" value={comparison} onChange={(e) => setComparison(e.target.value)}>
          <option value="">Sem comparação</option>{availableVersions.filter((v) => v.id !== selectedId).map((v) => <option value={v.id} key={v.id}>{label(v)}</option>)}
        </select></label>
      </div>
      {detail.data && <div className="space-y-1 text-sm">
        <p>{new Date(detail.data.criado_em).toLocaleString("pt-BR")} · {detail.data.autor.name || "Sistema"}</p>
        <p>{detail.data.motivo}</p><p className="text-muted-foreground">Base: revisão {detail.data.revisao_base}</p>
        <a className="inline-block py-2 font-medium text-blue-700 underline" href={`${prefix}/${selectedId}/pdf`} target="_blank" rel="noreferrer">Abrir PDF desta versão</a>
      </div>}
      {initialOnly && <div className="space-y-2">
        <Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={!canGenerate} onClick={()=>{
          if(!canGenerate || !reportRef.current)return;
          setPdfError(printBiaSummary(reportRef.current,name,["dados","map","cpp"],false,brand,code,"map")?"":"Permita pop-ups neste site para gerar o PDF e tente novamente.");
        }}>Gerar novo PDF do MAP Inicial</Button>
        <p className="text-xs text-muted-foreground">Usa a revisão selecionada, com layout em tabelas. Não inclui edições ainda não salvas nem cria uma nova revisão. Na impressão, escolha Salvar como PDF.</p>
        {!code && <p role="status" className="text-sm">Código oficial indisponível para gerar a marca do PDF.</p>}
        {artwork.isError && <p role="alert" className="text-sm">Não foi possível carregar a marca. <Button type="button" variant="ghost" onClick={()=>artwork.refetch()}>Tentar novamente</Button></p>}
        {pdfError && <p role="alert" className="text-sm text-destructive">{pdfError}</p>}
        <div hidden><div ref={reportRef}>{detail.data && <BiaMapVersionReport version={detail.data}/>}</div></div>
      </div>}
      {(detail.isFetching || (comparison && previous.isFetching)) ? <p className="text-sm">Carregando composição…</p> : <div className="grid gap-3 md:grid-cols-2">
        {identities.map((id) => {
          const row = currentRows.find((r) => r.memberId === id);
          const prior = comparison ? priorRows.find((r) => r.memberId === id) : undefined;
          return <div className="min-w-0 rounded-lg border p-3 text-sm" key={id}>
            <p className="break-words font-semibold">{row?.name || prior?.name}</p>
            <p>{money(row?.value || 0, currency)} · {(row?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p>
            {comparison && previous.data && <p className="mt-1 text-xs text-muted-foreground">Comparação: {money(prior?.value || 0, previous.data.snapshot?.base.moeda || currency)} · {(prior?.percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%</p>}
          </div>;
        })}
      </div>}
    </>}
  </CardContent></Card>;
}
