export const biaPdfSections = [
  {id:"dados",label:"Resumo dos dados",description:"Identificação, objetivo, localização e valores da BIA."},
  {id:"condicoes",label:"Capitalização e integralização",description:"Instrumentos, parcelas, periodicidade, correção e detalhes do plano."},
  {id:"map",label:"MAP Inicial",description:"Participantes, funções, aportes e participações iniciais."},
  {id:"cpp",label:"Detalhamento das CPPs",description:"Composição das participações por natureza econômica."},
] as const;
export type BiaPdfSection = typeof biaPdfSections[number]["id"];

export const biaSummaryPrintCss = `
  @page { size: A4 landscape; margin: 14mm; @bottom-right { content: counter(page) " / " counter(pages); font: 9px Arial; color: #64748b; } }
  * { box-sizing: border-box; }
  body { margin: 0; color: #142f43; background: #e9eef2; font: 12px/1.5 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report { max-width: 1120px; margin: 28px auto; padding: 42px; background: white; box-shadow: 0 8px 36px #001d3214; }
  .report-header { padding: 25px 28px; background: #001d32; color: white; border-bottom: 4px solid #b9a36b; margin-bottom: 26px; break-inside: avoid; }
  .brand { font-size: 13px; letter-spacing: 3px; font-weight: bold; color: #dccca4; }
  .report-header h1 { font-size: 27px; line-height: 1.2; margin: 14px 0 8px; overflow-wrap: anywhere; }
  .report-meta { color: #d3e0e8; font-size: 10px; }
  .report-note { color: #526578; font-size: 10px; padding: 12px 0; border-top: 1px solid #dbe3e9; margin-top: 24px; }
  [data-pdf-section] { margin-bottom: 24px; }
  [data-pdf-section="dados"], [data-pdf-section="condicoes"] { break-inside: avoid; }
  h2, summary { font-size: 15px; font-weight: bold; margin: 22px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #b9a36b; break-after: avoid; }
  summary { list-style: none; } summary::-webkit-details-marker { display: none; }
  h3 { font-size: 13px; break-after: avoid; }
  p { margin: 5px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  dl { display: grid; grid-template-columns: 220px 1fr; margin: 0; }
  dt, dd { margin: 0; padding: 8px 12px; border-bottom: 1px solid #e5ebef; }
  dt { font-weight: bold; background: #f2f5f7; } dd { white-space: pre-wrap; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; line-height: 1.4; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #dbe3e9; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  thead { display: table-header-group; background: #001d32; color: white; }
  tbody tr:nth-child(even) { background: #f3f6f8; }
  tfoot { display: table-row-group; font-weight: bold; background: #e8eef2; border-top: 2px solid #b9a36b; }
  tr { break-inside: avoid; } td span { display: block; font-size: 9px; color: #526578; }
  caption { text-align: left; font-size: 11px; color: #526578; margin-bottom: 7px; }
  [data-print-hide] { display: none; }
  .print-toolbar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: white; border-bottom: 1px solid #dbe3e9; color: #526578; }
  .print-toolbar button { border: 0; border-radius: 6px; padding: 12px 20px; background: #001d32; color: white; font: bold 13px Arial; cursor: pointer; }
  @media print { body { background: white; } .print-toolbar { display: none; } .report { max-width: none; padding: 0; margin: 0; box-shadow: none; } }
  @media screen and (max-width: 650px) { .report { margin: 12px; padding: 20px; overflow-x: auto; } dl { grid-template-columns: 140px 1fr; } }
`;

// Clone the already-authorized review; omitted sections are removed, not merely hidden.
export function printBiaSummary(element: HTMLElement, name: string, sections: readonly BiaPdfSection[] = biaPdfSections.map(s=>s.id)): boolean {
  if (!sections.length) return false;
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
  const button=make("button","Imprimir / Salvar como PDF");
  button.onclick=()=>popup.print();
  toolbar.append(button,make("span","Escolha Salvar como PDF no destino de impressão."));
  const report=make("main","","report"),header=make("header","","report-header");
  header.append(make("div","BUILT / ALLIANCES","brand"),make("h1",name || "BIA em estruturação"),make("p",`RESUMO DA BIA  •  PRÉVIA EM ESTRUTURAÇÃO  •  ${new Date().toLocaleDateString("pt-BR")}`,"report-meta"));
  const content=popup.document.importNode(element,true);
  content.querySelectorAll("[data-print-hide]").forEach(node=>node.remove());
  content.querySelectorAll<HTMLElement>("[data-pdf-section]").forEach(node=>{
    if (!sections.includes(node.dataset.pdfSection as BiaPdfSection)) node.remove();
  });
  content.querySelectorAll("details").forEach(detail=>{detail.open=true;});
  report.append(header,content,make("footer","Prévia para revisão. Não substitui MOU ou documentos assinados e não confirma aportes nem pagamentos.","report-note"));
  popup.document.body.append(toolbar,report);
  popup.requestAnimationFrame(()=>{popup.focus();popup.print();});
  return true;
}
