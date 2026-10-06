import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {biaBrandDisplayName, biaBrandNameLayout, buildBiaBrandSvg, buildBiaHeaderSvg, buildBiaWhatsappSvg, biaBrandDataUrl, downloadBiaBrandPng, type BiaBrandExportKind} from "./bia-brand";

const artwork = (name: string) => `data:image/png;base64,${readFileSync(new URL(`../../public/branding/${name}`,import.meta.url)).toString("base64")}`;
const darkArtwork=artwork("bia-brand-artwork.png");
const lightArtwork=artwork("bia-seal.png");

test("nome da marca remove somente o prefixo BIA e ganha o tamanho do modelo aprovado",()=>{
  assert.equal(biaBrandDisplayName("BIA Quintas Top View 7"),"QUINTAS TOP VIEW 7");
  assert.equal(biaBrandDisplayName("BIA - Quintas Top View 7"),"QUINTAS TOP VIEW 7");
  assert.equal(biaBrandDisplayName("Bianca Residence"),"BIANCA RESIDENCE");
  const layout=biaBrandNameLayout("BIA Quintas Top View 7");
  assert.equal(layout.lines.join(" "),"QUINTAS TOP VIEW 7");
  assert.ok(layout.fontSize>=19 && layout.fontSize<=22);
});

test("Bahnschrift e tamanhos da referência são usados em todas as versões",()=>{
  const variants=[
    buildBiaBrandSvg("BIA Aliança","ABC123",darkArtwork),
    buildBiaBrandSvg("BIA Aliança","ABC123",lightArtwork,"square-light"),
    buildBiaWhatsappSvg("BIA Aliança","ABC123",darkArtwork),
    buildBiaHeaderSvg("BIA Aliança","ABC123",lightArtwork),
  ];
  for(const [index,svg] of variants.entries()){
    assert.match(svg,/font-family="Bahnschrift, DIN Alternate, Arial Narrow, Arial, sans-serif"/);
    assert.match(svg,/font-stretch="condensed"/);
    assert.match(svg,/viewBox="360 550 146 40" aria-label="Powered by"/);
    assert.doesNotMatch(svg,/<text[^>]*>(United by Trust\.|Connected by Action\.|Powered by)<\/text>/);
    assert.match(svg,new RegExp(`font-size="${index===3?28:22}"[^>]*>ALIANÇA</text>`));
    assert.match(svg,/font-size="11">BIA - ABC123<\/text>/);
  }
  const longName="BIA Aliança de Desenvolvimento Imobiliário e Participações Internacionais";
  assert.equal(biaBrandNameLayout(longName).lines.join(" "),biaBrandDisplayName(longName));
  assert.ok(biaBrandNameLayout(longName).fontSize<=22);
  assert.match(buildBiaBrandSvg('BIA A & B <C>',"ABC123",darkArtwork),/A &amp; B &lt;C&gt;/);
});

test("slogan mantém a tipografia original da arte nas marcas verticais e horizontal",()=>{
  for(const svg of [buildBiaBrandSvg("BIA Aliança","ABC",darkArtwork),buildBiaBrandSvg("BIA Aliança","ABC",lightArtwork,"square-light"),buildBiaHeaderSvg("BIA Aliança","ABC",lightArtwork)]){
    assert.match(svg,/viewBox="400 398 338 87" aria-label="United by Trust. Connected by Action."/);
  }
});

test("nome e código usam a mesma cor do slogan sem recolorir os símbolos",()=>{
  const variants=[
    [buildBiaBrandSvg("BIA Aliança","ABC",darkArtwork),"#b1bac1",darkArtwork],
    [buildBiaBrandSvg("BIA Aliança","ABC",lightArtwork,"square-light"),"#6a7984",lightArtwork],
    [buildBiaWhatsappSvg("BIA Aliança","ABC",darkArtwork),"#b1bac1",darkArtwork],
    [buildBiaHeaderSvg("BIA Aliança","ABC",lightArtwork),"#6a7984",lightArtwork],
  ];
  for(const [svg,color,source] of variants){
    assert.ok(svg.includes(`<g fill="${color}" font-family=`));
    const textGroup=svg.match(/<g [\s\S]*?<\/g>/)![0];
    assert.match(textGroup,/>ALIANÇA<\/text>/);
    assert.match(textGroup,/>BIA - ABC<\/text>/);
    for(const [,override] of textGroup.matchAll(/<text[^>]* fill="([^"]+)"/g))assert.equal(override,color);
    assert.ok(svg.includes(source));
  }
});

test("marcas quadradas preservam as duas cores aprovadas sem repetir BIA no nome",()=>{
  for(const variant of ["square-dark","square-light"] as const){
    const source=variant === "square-dark" ? darkArtwork : lightArtwork;
    const svg=buildBiaBrandSvg("BIA Quintas Top View 7","CVJKVYQQKZ",source,variant);
    assert.match(svg,/width="307" height="327"/);
    assert.ok(svg.includes(source));
    assert.match(svg,/>QUINTAS TOP VIEW 7<\/text>/);
    assert.doesNotMatch(svg,/>BIA QUINTAS TOP VIEW 7<\/text>/);
    assert.match(svg,/>BIA - CVJKVYQQKZ<\/text>/);
    assert.doesNotMatch(svg,/<script>|<filter/);
    assert.equal(decodeURIComponent(biaBrandDataUrl(svg).split(",")[1]),svg);
  }
  assert.match(buildBiaBrandSvg("Nome",null,darkArtwork),/Código após salvar/);
  assert.throws(()=>buildBiaBrandSvg("Nome",null,"https://example.test/logo.png"));
});

test("ícone do WhatsApp e cabeçalho usam os recortes oficiais em composição vetorial",()=>{
  const whatsapp=buildBiaWhatsappSvg("BIA Quintas Top View 7","CVJKVYQQKZ",darkArtwork);
  assert.match(whatsapp,/width="344" height="344"/);
  assert.ok(whatsapp.includes(darkArtwork));
  assert.match(whatsapp,/>QUINTAS TOP VIEW 7<\/text>/);
  assert.match(whatsapp,/<circle cx="172" cy="172" r="150"/);
  assert.doesNotMatch(whatsapp,/<rect x="69" y="254"/);
  const header=buildBiaHeaderSvg("BIA Quintas Top View 7","CVJKVYQQKZ",lightArtwork);
  assert.match(header,/width="832" height="151"/);
  assert.ok(header.includes(lightArtwork));
  assert.match(header,/>BIA - CVJKVYQQKZ<\/text>/);
  assert.doesNotMatch(header,/>BIA QUINTAS TOP VIEW 7<\/text>/);
  assert.throws(()=>buildBiaWhatsappSvg("Nome",null,"data:image/jpeg;base64,TEST"));
  assert.throws(()=>buildBiaHeaderSvg("Nome",null,"https://example.test/logo.png"));
});

test("downloads exportam cada formato em alta resolução e com nome distinto",async()=>{
  await assert.rejects(downloadBiaBrandPng("data:image/svg+xml;x","BIA",null));
  await assert.rejects(downloadBiaBrandPng("data:image/svg+xml;x","","RA56FHGGWY"));
  const previousImage=Object.getOwnPropertyDescriptor(globalThis,"Image"),previousDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
  let clicked=0,decoded=false,drawn=false;
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{assert.ok(decoded);drawn=true;}}),toBlob:(fn:(b:Blob)=>void,type:string)=>{assert.equal(type,"image/png");fn(new Blob(["png"],{type}));}};
  const link={href:"",download:"",click:()=>{clicked++;},remove(){}};
  try {
    Object.defineProperty(globalThis,"Image",{configurable:true,value:class {src="";async decode(){decoded=true;}}});
    Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:(tag:string)=>tag==="canvas"?canvas:link,body:{append(){}}}});
    const cases: Array<[BiaBrandExportKind,string,number,number,string]> = [
      ["square-dark",buildBiaBrandSvg("Nome","RA56FHGGWY",darkArtwork),1228,1308,"marca-BIA-RA56FHGGWY-quadrada-azul.png"],
      ["square-light",buildBiaBrandSvg("Nome","RA56FHGGWY",lightArtwork,"square-light"),1228,1308,"marca-BIA-RA56FHGGWY-quadrada-clara.png"],
      ["whatsapp",buildBiaWhatsappSvg("Nome","RA56FHGGWY",darkArtwork),1376,1376,"marca-BIA-RA56FHGGWY-whatsapp.png"],
      ["header",buildBiaHeaderSvg("Nome","RA56FHGGWY",lightArtwork),3328,604,"marca-BIA-RA56FHGGWY-cabecalho.png"],
    ];
    for(const [kind,svg,width,height,filename] of cases){
      await downloadBiaBrandPng(biaBrandDataUrl(svg),"Nome","RA56FHGGWY",kind);
      assert.equal(canvas.width,width);assert.equal(canvas.height,height);assert.equal(link.download,filename);
    }
    assert.equal(clicked,4);assert.ok(drawn);
  }finally{
    if(previousImage)Object.defineProperty(globalThis,"Image",previousImage);else Reflect.deleteProperty(globalThis,"Image");
    if(previousDocument)Object.defineProperty(globalThis,"document",previousDocument);else Reflect.deleteProperty(globalThis,"document");
  }
});

test("revisão usa consulta autorizada sem substituir código por ID ou gravar imagem",()=>{
  const ui=readFileSync(new URL("../components/bia-brand-preview.tsx",import.meta.url),"utf8");
  assert.match(ui,/queryKey:\["\/api\/bias",id,"rascunho"\]/);
  assert.match(ui,/codigo_publico_indisponivel/);
  assert.match(ui,/!brand.url \|\| !name.trim\(\) \|\| !brand.code/);
  assert.match(ui,/Tentar carregar marca novamente/);
  assert.doesNotMatch(ui,/getBiaPublicRef|apiRequest\("(?:PUT|POST)|uploadBiaFiles|imagem_directus_id/);
});
