const xml = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]!));

export function biaBrandNameLayout(name: string) {
  const text = name.trim().replace(/\s+/g," ").toLocaleUpperCase("pt-BR") || "NOME DA BIA";
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (last >= 0 && Array.from(`${lines[last]} ${word}`).length <= 32) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  const longest = Math.max(...lines.map(line => Array.from(line).length));
  const fontSize = Math.min(20, 36 / (lines.length * 1.15), 264 / longest);
  return {lines, fontSize};
}

// The embedded original artwork supplies both logos; only name/code are variable.
export function buildBiaBrandSvg(name: string, code: string | null, artwork: string) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(artwork)) throw new Error("Arte da marca indisponível.");
  const {lines,fontSize} = biaBrandNameLayout(name);
  const start = 172 - ((lines.length - 1) * fontSize * 1.15) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="338" height="353" viewBox="0 0 338 353">
    <title>${xml(name.trim() || "Marca da BIA")}</title>
    <rect width="338" height="353" fill="white"/>
    <rect x="12" y="10" width="316" height="335" rx="11" fill="#001d32"/>
    <svg x="85" y="60" width="170" height="88" viewBox="360 60 418 216"><image width="1138" height="665" href="${artwork}"/></svg>
    <g fill="white" font-family="Arial Narrow, Arial, sans-serif" text-anchor="middle">
      ${lines.map((line,i)=>`<text x="169" y="${start + i * fontSize * 1.15}" font-size="${fontSize}" dominant-baseline="middle">${xml(line)}</text>`).join("")}
      <path d="M88 191H251 M88 241H251" stroke="#82949e" stroke-width="0.7"/>
      <text x="169" y="211" font-size="15">United by Trust.</text>
      <text x="169" y="229" font-size="15">Connected by Action.</text>
      <text x="117" y="270" font-size="12">Powered by</text>
      <text x="169" y="334" font-size="9">${xml(code ? `BIA-${code}` : "Código após salvar")}</text>
    </g>
    <svg x="177" y="253" width="77" height="27" viewBox="584 538 192 68"><image width="1138" height="665" href="${artwork}"/></svg>
  </svg>`;
}

export const biaBrandDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Preserve the supplied horizontal artwork except its two example identity fields.
export function buildBiaHeaderSvg(name: string, code: string | null, artwork: string) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(artwork)) throw new Error("Arte da marca indisponível.");
  const {lines} = biaBrandNameLayout(name);
  const fontSize = Math.min(100, 112 / (lines.length * 1.15), 700 / (0.55 * Math.max(...lines.map(line=>Array.from(line).length))));
  const start = 333 - ((lines.length - 1) * fontSize * 1.15) / 2;
  const label = code ? `BIA-${code}` : "Código após salvar";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2172" height="724" viewBox="0 0 2172 724">
    <title>${xml(name.trim() || "Marca da BIA")}</title>
    <rect width="2172" height="724" fill="white"/>
    <defs><clipPath id="fixed-art"><path clip-rule="evenodd" d="M0 0H2172V724H0Z M540 260H1285V450H540Z"/></clipPath></defs>
    <image width="2172" height="724" href="${artwork}" clip-path="url(#fixed-art)"/>
    <g fill="#062341" font-family="Arial Narrow, Arial, sans-serif">
      ${lines.map((line,i)=>`<text x="560" y="${start+i*fontSize*1.15}" font-size="${fontSize}" textLength="${Math.min(700,Array.from(line).length*fontSize*0.55)}" lengthAdjust="spacingAndGlyphs" font-weight="bold" text-anchor="start" dominant-baseline="middle">${xml(line)}</text>`).join("")}
      <text x="560" y="425" font-size="38" textLength="${Math.min(700,Array.from(label).length*38*0.65)}" lengthAdjust="spacingAndGlyphs" text-anchor="start">${xml(label)}</text>
    </g>
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

export function renderBiaBrandCanvas(image: CanvasImageSource, canvas=document.createElement("canvas"), width=1352, height=1412) {
  canvas.width=width; canvas.height=height;
  const context=canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não conseguiu gerar o PNG.");
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

export async function downloadBiaBrandPng(svgUrl: string, name: string, code: string | null) {
  if (!name.trim() || !code || !svgUrl.startsWith("data:image/svg+xml;")) throw new Error("Salve a BIA e aguarde o código oficial antes de baixar a marca.");
  const image = new Image(); image.src=svgUrl; await image.decode();
  const canvas = renderBiaBrandCanvas(image);
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Não foi possível gerar o PNG.")),"image/png"));
  const url=URL.createObjectURL(blob), link=document.createElement("a");
  link.href=url; link.download=`marca-BIA-${code.replace(/[^a-z0-9-]/gi,"")}.png`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
