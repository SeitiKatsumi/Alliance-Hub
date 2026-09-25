import { biaBrandDataUrl, buildBiaHeaderSvg, loadBiaBrandArtwork, renderBiaBrandCanvas } from "./bia-brand";
import { buildBiaMouFooterText } from "../../../shared/bia-document-footer";

export const biaPdfSections = [
  {id:"dados",label:"Resumo dos dados",description:"Identificação, objetivo, localização e valores da BIA."},
  {id:"condicoes",label:"Capitalização e integralização",description:"Instrumentos, parcelas, periodicidade, correção e detalhes do plano."},
  {id:"map",label:"MAP Inicial",description:"Participantes, funções, aportes e participações iniciais."},
  {id:"juridico",label:"Estrutura Jurídica",description:"Formalização, responsável, quadro societário e conta."},
  {id:"ativos",label:"Ativos Vinculados",description:"Cadastro e indicadores dos ativos, sem efeitos patrimoniais."},
  {id:"documentos",label:"Documentos",description:"Relação dos anexos informativos."},
  {id:"cpp",label:"Detalhamento das CPPs",description:"Composição das participações por natureza econômica."},
] as const;
export type BiaPdfSection = typeof biaPdfSections[number]["id"];

const footerText = (name:string, code:string|null) => buildBiaMouFooterText(name.trim() || "em estruturação", code || "");

export const biaSummaryFooterCss = (biaUrl:string, certifiedUrl?:string, headerUrl="", name="", date="", code:string|null=null) => `
  @page {
    @top-left { content: ""; width: 160mm; border-bottom: 1mm solid #d7bb7d; background: url(${JSON.stringify(headerUrl)}) 0 center / 125mm auto no-repeat; }
    @top-right { content: "RESUMO DA BIA\\A" ${JSON.stringify(date)}; white-space: pre-wrap; font: bold 10pt/1.7 Arial; color: #001d34; text-align: right; padding-right: 10mm; width: 107mm; border-bottom: 1mm solid #d7bb7d; }
    @top-left-corner { content: ""; border-bottom: 1mm solid #d7bb7d; }
    @top-right-corner { content: ""; border-bottom: 1mm solid #d7bb7d; }
    @bottom-center { content: ${JSON.stringify(footerText(name,code))}; box-sizing: border-box; width: 267mm; border-top: 0.25mm solid #dbc79e; font: 6.7pt/1.35 Arial; color: #001d34; text-align: left; overflow-wrap: anywhere; padding: 0 16mm 0 54mm; background: url(${JSON.stringify(biaUrl)}) 10mm center / auto 19mm no-repeat${certifiedUrl ? `, url(${JSON.stringify(certifiedUrl)}) 34mm center / auto 18mm no-repeat` : ""}; }
    @bottom-right { content: counter(page) " / " counter(pages); width: 16mm; font: 7pt Arial; color: #64748b; text-align: right; vertical-align: bottom; padding-bottom: 5mm; }
  }
`;

export const biaSummaryPrintCss = `
  @page { size: A4 landscape; margin: 30mm 15mm 37mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #142f43; background: #e9eef2; font: 12px/1.5 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report { max-width: 1123px; margin: 0 auto; padding: 28px 56px; background: white; box-shadow: 0 8px 36px #001d3214; }
  .report-masthead { max-width: 1123px; margin: 28px auto 0; padding: 0 56px; height: 30mm; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 20px; background: white; border-bottom: 3px solid #d7bb7d; }
  .report-masthead img { width: 472px; max-width: 65%; height: auto; }
  .report-masthead p { text-align: right; font-size: 11px; font-weight: bold; }
  .report-header { padding: 0 0 18px; background: white; color: #142f43; border-bottom: 1px solid #b9a36b; margin-bottom: 26px; break-inside: avoid; }
  .report-header h1 { font-size: 27px; line-height: 1.2; margin: 14px 0 8px; overflow-wrap: anywhere; }
  .report-meta { color: #526578; font-size: 10px; }
  .report-footer { display: flex; align-items: center; gap: 16px; max-width: 1123px; margin: 0 auto 28px; padding: 20px 56px; background: white; border-top: 1px solid #dbc79e; }
  .report-footer img { height: 18mm; width: auto; object-fit: contain; flex-shrink: 0; }
  .report-footer img:first-child { height: 19mm; }
  .report-footer p { flex: 1; color: #001d34; font-size: 9px; text-align: left; }
  .report-note { color: #526578; font-size: 10px; padding: 8px 0; border-top: 1px solid #dbe3e9; margin-top: 12px; }
  [data-pdf-section] { margin-bottom: 24px; }
  [data-pdf-section="dados"], [data-pdf-section="condicoes"] { break-inside: avoid; }
  [data-pdf-section="condicoes"] { padding-top: 8mm; }
  [data-pdf-section="condicoes"] h2 { margin-top: 0; }
  h2, summary { font-size: 15px; font-weight: bold; margin: 22px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #b9a36b; break-after: avoid; }
  summary { list-style: none; } summary::-webkit-details-marker { display: none; }
  h3 { font-size: 13px; break-after: avoid; }
  p { margin: 5px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  dl { display: grid; grid-template-columns: minmax(0, 34%) minmax(0, 1fr); margin: 0; }
  dt, dd { margin: 0; padding: 8px 12px; border-bottom: 1px solid #e5ebef; }
  dt { font-weight: bold; background: #f2f5f7; } dd { white-space: pre-wrap; overflow-wrap: anywhere; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 12px 0; font-size: 10px; line-height: 1.4; break-inside: avoid; }
  [data-pdf-asset] { break-inside: avoid; }
  .bia-brand-gallery { display: grid; grid-template-columns: 55mm 1fr; gap: 12mm; break-inside: avoid; }
  th, td { padding: 5px; border-bottom: 1px solid #dbe3e9; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  thead { display: table-header-group; background: #001d32; color: white; }
  tbody tr:nth-child(even) { background: #f3f6f8; }
  tfoot { display: table-row-group; font-weight: bold; background: #e8eef2; border-top: 2px solid #b9a36b; }
  tr { break-inside: avoid; } td span { display: block; font-size: 9px; color: #526578; }
  caption { text-align: left; font-size: 11px; color: #526578; margin-bottom: 7px; }
  [data-print-hide] { display: none; }
  .print-toolbar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: white; border-bottom: 1px solid #dbe3e9; color: #526578; }
  .print-toolbar button { border: 0; border-radius: 6px; padding: 12px 20px; background: #001d32; color: white; font: bold 13px Arial; cursor: pointer; }
  @media print { body { background: white; } .print-toolbar, .report-footer, .report-masthead { display: none; } .report { max-width: none; padding: 6mm 0 3mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; margin: 0; box-shadow: none; } }
  @media screen and (max-width: 650px) { .report, .report-masthead, .report-footer { margin: 0 12px; padding: 20px; } .report-footer { flex-wrap: wrap; } .report-footer p { flex-basis: 100%; } }
`;

// Clone the already-authorized review; omitted sections are removed, not merely hidden.
export function printBiaSummary(element: HTMLElement, name: string, sections: readonly BiaPdfSection[] = biaPdfSections.map(s=>s.id), certified=false, brandUrl="", code:string|null=null, context: "review" | "data" = "review"): boolean {
  if (!sections.length || !brandUrl.startsWith("data:image/svg+xml;")) return false;
  const popup = window.open("", "_blank", "width=1200,height=850");
  if (!popup) return false;
  popup.document.open();
  popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
  popup.document.close();
  popup.document.title = `Resumo da BIA - ${name || "Em estruturação"}`;
  const make = (tag:string,text="",className="") => {
    const node=popup.document.createElement(tag); node.textContent=text; node.className=className; return node;
  };
  popup.document.head.append(make("style",biaSummaryPrintCss));
  const toolbar=make("div","","print-toolbar");
  const button=popup.document.createElement("button");
  button.textContent="Imprimir / Salvar como PDF";
  button.disabled=true;
  button.onclick=()=>popup.print();
  const status=make("span","Carregando marcas para impressão…");
  status.setAttribute("role","status");
  toolbar.append(button,status);
  const report=make("main","","report"),header=make("header","","report-header");
  const date=new Date().toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"});
  header.append(make("h1",name || "BIA em estruturação"),make("p",context === "review" ? "RESUMO DA BIA • PRÉVIA EM ESTRUTURAÇÃO" : "DADOS DA BIA • CÓPIA PARA CONSULTA","report-meta"));
  const content=popup.document.importNode(element,true);
  content.querySelectorAll("[data-print-hide]").forEach(node=>node.remove());
  content.querySelectorAll<HTMLElement>("[data-pdf-section]").forEach(node=>{
    if (!sections.includes(node.dataset.pdfSection as BiaPdfSection)) node.remove();
  });
  const contentImages=Array.from(content.querySelectorAll<HTMLImageElement>("img"));
  content.querySelectorAll("details").forEach(detail=>{detail.open=true;});
  content.querySelectorAll<HTMLAnchorElement>('a[href^="/api/assets/"]').forEach(link=>{link.href=new URL(link.getAttribute('href')!,window.location.origin).href;});
  report.append(header,content,make("footer","Prévia para revisão. Não substitui MOU ou documentos assinados e não confirma aportes nem pagamentos.","report-note"));
  const footer=make("footer","","report-footer");
  const images:HTMLImageElement[]=[];
  const seal=(src:string,alt:string)=>{
    const img=popup.document.createElement("img");
    img.src=src;
    img.alt=alt; images.push(img); return img;
  };
  footer.append(seal(brandUrl,`Marca de ${name || "BIA em estruturação"}`));
  if(certified)footer.append(seal(new URL("/branding/certified-alliance-seal.png",window.location.origin).href,"BUILT Certified Alliance - Aliança Certificada"));
  footer.append(make("p",footerText(name,code)));
  const masthead=make("header","","report-masthead");
  const headerLogo=popup.document.createElement("img");
  headerLogo.alt=`Marca horizontal de ${name || "BIA em estruturação"}`;
  masthead.append(headerLogo,make("p",`RESUMO DA BIA\n${date}`));
  popup.document.body.append(toolbar,masthead,report,footer);
  // Wait for the supplied artwork; otherwise the first print can omit the seals.
  Promise.all([
    ...contentImages.map(img=>img.decode().then(()=>{
      if(img.src.startsWith("data:image/svg+xml;")) img.src=renderBiaBrandCanvas(img,popup.document.createElement("canvas"),img.naturalWidth*2,img.naturalHeight*2).toDataURL("image/png");
      return img.decode();
    })),
    ...images.map(img=>img.decode()),
    loadBiaBrandArtwork("/branding/bia-header-artwork.png").then(artwork=>{
      headerLogo.src=biaBrandDataUrl(buildBiaHeaderSvg(name,code,artwork));
      return headerLogo.decode();
    }),
  ]).then(()=>{
    // Chromium print margins omit embedded raster logos inside SVG backgrounds.
    const png=renderBiaBrandCanvas(images[0],popup.document.createElement("canvas")).toDataURL("image/png");
    const headerPng=renderBiaBrandCanvas(headerLogo,popup.document.createElement("canvas"),2172,724).toDataURL("image/png");
    popup.document.head.append(make("style",biaSummaryFooterCss(png,certified?images[1].src:undefined,headerPng,name,date,code)));
    button.disabled=false;
    status.textContent="Escolha Salvar como PDF no destino de impressão.";
    popup.requestAnimationFrame(()=>{popup.focus();popup.print();});
  }).catch(()=>{status.textContent="Não foi possível carregar as marcas. Feche esta janela e gere o PDF novamente.";});
  return true;
}
