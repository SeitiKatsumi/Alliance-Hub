const xml = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]!));

export type BiaBrandVariant = "square-dark" | "square-light";
export type BiaBrandExportKind = BiaBrandVariant | "whatsapp" | "header";

const brandFontFamily = "Bahnschrift, DIN Alternate, Arial Narrow, Arial, sans-serif";
// Size for legibility in the displayed mark. The 4x PNG export increases
// resolution only; dividing the text size by the export scale made it tiny.
const brandNameSize = 22;
const brandHeaderNameSize = 28;
const brandCodeSize = 13;
// Dominant original slogan pixels: #6a7984 on white; white at alpha 177/255
// on #011d33, composited as #b1bac1. Symbols retain their original colors.
const brandCopyColor = {light: "#6a7984", dark: "#b1bac1"};

// Preserve the approved condensed lettering exactly, rather than retyping
// these fixed phrases using a device-dependent replacement font.
function brandTagline(artwork: string, x: number, y: number, width: number, height: number) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="400 398 338 87" aria-label="United by Trust. Connected by Action."><image width="1138" height="665" href="${artwork}"/></svg>`;
}

function brandPoweredBy(artwork: string, x: number, y: number, width: number, height: number) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="360 550 146 40" aria-label="Powered by"><image width="1138" height="665" href="${artwork}"/></svg>`;
}

export function biaBrandDisplayName(name: string) {
  const normalized = name.trim().replace(/\s+/g," ");
  const withoutPrefix = normalized.replace(/^BIA(?:\s*[-–—:]\s*|\s+)(?=\S)/i,"");
  return (withoutPrefix || "NOME DA ALIANÇA").toLocaleUpperCase("pt-BR");
}

function brandTextLayout(name: string, maxChars: number, maxFont: number, maxWidth: number, maxHeight: number) {
  const text = biaBrandDisplayName(name);
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (last >= 0 && Array.from(`${lines[last]} ${word}`).length <= maxChars) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  const longest = Math.max(...lines.map(line => Array.from(line).length));
  const fontSize = Math.min(maxFont, maxHeight / (lines.length * 1.08), maxWidth / (longest * 0.58));
  return {lines,fontSize};
}

export function biaBrandNameLayout(name: string) {
  return brandTextLayout(name,24,brandNameSize,205,44);
}

function assertArtwork(artwork: string) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(artwork)) throw new Error("Arte da marca indisponível.");
}

const brandCode = (code: string | null) => code ? `BIA - ${code.trim()}` : "Código após salvar";

export function buildBiaBrandSvg(name: string, code: string | null, artwork: string, variant: BiaBrandVariant = "square-dark") {
  assertArtwork(artwork);
  const dark = variant === "square-dark";
  const background = dark ? "#011d33" : "#ffffff";
  const foreground = dark ? brandCopyColor.dark : brandCopyColor.light;
  const rule = dark ? "#ffffff" : "#d4bd7a";
  const {lines,fontSize} = biaBrandNameLayout(name);
  const start = 160 - ((lines.length - 1) * fontSize * 1.08) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="307" height="327" viewBox="0 0 307 327">
    <title>${xml(name.trim() || "Marca da BIA")}</title>
    <rect x="1" y="1" width="305" height="325" rx="18" fill="${background}" stroke="#011d33" stroke-width="1.5"/>
    <svg x="69" y="47" width="169" height="87" viewBox="360 60 418 216"><image width="1138" height="665" href="${artwork}"/></svg>
    <g fill="${foreground}" font-family="${brandFontFamily}" font-stretch="condensed" style="font-variation-settings:'wdth' 75" text-anchor="middle">
      ${lines.map((line,i)=>`<text x="153.5" y="${start + i * fontSize * 1.08}" font-size="${fontSize}" dominant-baseline="middle">${xml(line)}</text>`).join("")}
      <path d="M75 185H232 M75 234H232" stroke="${rule}" stroke-width="0.9"/>
      <text x="153.5" y="307" fill="${foreground}" font-size="${brandCodeSize}">${xml(brandCode(code))}</text>
    </g>
    ${brandTagline(artwork,89,194,129,34)}
    ${brandPoweredBy(artwork,84,249,56,16)}
    <svg x="163" y="245" width="75" height="27" viewBox="584 538 192 68"><image width="1138" height="665" href="${artwork}"/></svg>
  </svg>`;
}

export function buildBiaWhatsappSvg(name: string, code: string | null, artwork: string) {
  assertArtwork(artwork);
  const {lines,fontSize} = brandTextLayout(name,22,brandNameSize,190,36);
  const start = 190 - ((lines.length - 1) * fontSize * 1.08) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="344" height="344" viewBox="0 0 344 344">
    <title>${xml(name.trim() || "Ícone da BIA para WhatsApp")}</title>
    <rect width="344" height="344" fill="white"/>
    <circle cx="172" cy="172" r="168" fill="#d4bd7a"/>
    <circle cx="172" cy="172" r="156" fill="#011d33"/>
    <circle cx="172" cy="172" r="150" fill="none" stroke="#d4bd7a" stroke-width="3"/>
    <svg x="84" y="69" width="176" height="91" viewBox="360 60 418 216"><image width="1138" height="665" href="${artwork}"/></svg>
    <g fill="${brandCopyColor.dark}" font-family="${brandFontFamily}" font-stretch="condensed" style="font-variation-settings:'wdth' 75" text-anchor="middle">
      ${lines.map((line,i)=>`<text x="172" y="${start + i * fontSize * 1.08}" font-size="${fontSize}" dominant-baseline="middle">${xml(line)}</text>`).join("")}
      <path d="M91 211H253" stroke="#d4bd7a" stroke-width="1.5"/>
      <text x="172" y="279" font-size="${brandCodeSize}">${xml(brandCode(code))}</text>
    </g>
    ${brandPoweredBy(artwork,97,228,63,18)}
    <svg x="181" y="222" width="76" height="27" viewBox="584 538 192 68"><image width="1138" height="665" href="${artwork}"/></svg>
  </svg>`;
}

export const biaBrandDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function buildBiaHeaderSvg(name: string, code: string | null, artwork: string) {
  assertArtwork(artwork);
  const {lines,fontSize} = brandTextLayout(name,13,brandHeaderNameSize,150,64);
  const start = 75 - ((lines.length - 1) * fontSize * 1.05) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="151" viewBox="0 0 832 151">
    <title>${xml(name.trim() || "Cabeçalho da BIA")}</title>
    <rect width="832" height="151" fill="white"/>
    <svg x="15" y="23" width="198" height="102" viewBox="360 60 418 216"><image width="1138" height="665" href="${artwork}"/></svg>
    <path d="M242 24V126 M427 24V126 M692 24V126" stroke="#d4bd7a" stroke-width="1.5"/>
    <g fill="${brandCopyColor.light}" font-family="${brandFontFamily}" font-stretch="condensed" style="font-variation-settings:'wdth' 75" text-anchor="start">
      ${lines.map((line,i)=>`<text x="269" y="${start+i*fontSize*1.05}" font-size="${fontSize}" dominant-baseline="middle">${xml(line)}</text>`).join("")}
      <text x="269" y="124" font-size="${brandCodeSize}">${xml(brandCode(code))}</text>
    </g>
    ${brandTagline(artwork,455,45,220,57)}
    ${brandPoweredBy(artwork,721,39,65,18)}
    <svg x="721" y="69" width="91" height="32" viewBox="584 538 192 68"><image width="1138" height="665" href="${artwork}"/></svg>
  </svg>`;
}

export async function loadBiaBrandArtwork(path = "/branding/bia-brand-artwork.png"): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Não foi possível carregar a arte da marca.");
  const blob = await response.blob();
  if (blob.type !== "image/png") throw new Error("Arte da marca inválida.");
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("Não foi possível ler a arte da marca."));
    reader.readAsDataURL(blob);
  });
}

export function renderBiaBrandCanvas(image: CanvasImageSource, canvas=document.createElement("canvas"), width=1228, height=1308) {
  canvas.width=width; canvas.height=height;
  const context=canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu gerar o PNG.");
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

const exportSpecs: Record<BiaBrandExportKind,{width:number;height:number;suffix:string}> = {
  "square-dark": {width:1228,height:1308,suffix:"quadrada-azul"},
  "square-light": {width:1228,height:1308,suffix:"quadrada-clara"},
  whatsapp: {width:1376,height:1376,suffix:"whatsapp"},
  header: {width:3328,height:604,suffix:"cabecalho"},
};

export async function downloadBiaBrandPng(svgUrl: string, name: string, code: string | null, kind: BiaBrandExportKind = "square-dark") {
  if (!name.trim() || !code || !svgUrl.startsWith("data:image/svg+xml;")) throw new Error("Salve a BIA e aguarde o código oficial antes de baixar a marca.");
  const image = new Image(); image.src=svgUrl; await image.decode();
  const spec=exportSpecs[kind];
  const canvas = renderBiaBrandCanvas(image,undefined,spec.width,spec.height);
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Não foi possível gerar o PNG.")),"image/png"));
  const url=URL.createObjectURL(blob), link=document.createElement("a");
  link.href=url; link.download=`marca-BIA-${code.replace(/[^a-z0-9-]/gi,"")}-${spec.suffix}.png`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
