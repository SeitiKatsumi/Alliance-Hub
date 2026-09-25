import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {biaBrandNameLayout, buildBiaBrandSvg, buildBiaHeaderSvg, biaBrandDataUrl, downloadBiaBrandPng} from "./bia-brand";

const artwork=`data:image/png;base64,${readFileSync(new URL("../../public/branding/bia-brand-artwork.png",import.meta.url)).toString("base64")}`;
test("cabeçalho horizontal substitui apenas nome/código e mantém o código à esquerda",()=>{
  for(const name of ["Jardim das Acácias","Aliança São José & Irmãos", "Residencial "+"Águas Claras do Sul ".repeat(10),"W".repeat(200),"<script>alert('x')</script>"]){
    const svg=buildBiaHeaderSvg(name,"OFICIAL01",artwork);
    assert.match(svg,/width="2172" height="724"/);
    assert.match(svg,/<text x="560" y="425"[^>]*text-anchor="start">BIA-OFICIAL01<\/text>/);
    assert.match(svg,/clip-path="url\(#fixed-art\)"/);
    assert.doesNotMatch(svg,/<script>|CAPITAL PARTNERS 01|PA45H96MY/);
    assert.equal([...svg.matchAll(/dominant-baseline="middle">(.*?)<\/text>/g)].map(m=>m[1]).join(" "),name.trim().replace(/\s+/g," ").toLocaleUpperCase("pt-BR").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("'","&apos;"));
  }
  assert.match(buildBiaHeaderSvg("",null,artwork),/Código após salvar/);
  assert.notEqual(buildBiaHeaderSvg("Antigo",null,artwork),buildBiaHeaderSvg("Novo",null,artwork));
  assert.throws(()=>buildBiaHeaderSvg("Nome",null,"https://example.test/logo.png"));
});
test("marca preserva nome completo, acentos, identidade e código público, sem HTML executável",()=>{
  for(const name of ["Capital Partners 01","Aliança São José & Irmãos", "Residencial " + "Águas Claras do Sul ".repeat(10), "W".repeat(200), "<script>alert('x')</script>"]){
    const layout=biaBrandNameLayout(name);
    assert.equal(layout.lines.join(" "),name.trim().replace(/\s+/g," ").toLocaleUpperCase("pt-BR"));
    assert.ok(layout.fontSize>0 && layout.fontSize<=20);
    assert.ok(layout.fontSize*layout.lines.length*1.15<=36.001);
    assert.ok(layout.lines.every(line=>Array.from(line).length*layout.fontSize<=264.001));
    const svg=buildBiaBrandSvg(name,"RA56FHGGWY",artwork);
    assert.ok(svg.includes("BIA-RA56FHGGWY"));assert.ok(svg.includes("United by Trust."));
    assert.ok(svg.includes("Connected by Action."));assert.ok(svg.includes("Powered by"));
    assert.ok(svg.includes(artwork));assert.doesNotMatch(svg,/<script>|<filter/);
    assert.equal(decodeURIComponent(biaBrandDataUrl(svg).split(",")[1]),svg);
  }
  assert.match(buildBiaBrandSvg("Nome",null,artwork),/Código após salvar/);
  assert.doesNotMatch(buildBiaBrandSvg("",null,artwork),/BIA-undefined|BIA-null/);
  assert.notEqual(buildBiaBrandSvg("Nome antigo",null,artwork),buildBiaBrandSvg("Nome novo",null,artwork));
  assert.throws(()=>buildBiaBrandSvg("Nome",null,"https://example.test/logo.png"));
});

test("download PNG usa alta resolução e bloqueia nome/código ausentes antes de exportar",async()=>{
  await assert.rejects(downloadBiaBrandPng("data:image/svg+xml;x","BIA",null));
  await assert.rejects(downloadBiaBrandPng("data:image/svg+xml;x","","RA56FHGGWY"));
  const previousImage=Object.getOwnPropertyDescriptor(globalThis,"Image"),previousDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
  let clicked=false,decoded=false,drawn=false;
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{assert.ok(decoded);drawn=true;}}),toBlob:(fn:(b:Blob)=>void,type:string)=>{assert.equal(type,"image/png");fn(new Blob(["png"],{type}));}};
  const link={href:"",download:"",click:()=>{clicked=true;},remove(){}};
  try {
    Object.defineProperty(globalThis,"Image",{configurable:true,value:class {src="";async decode(){decoded=true;}}});
    Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:(tag:string)=>tag==="canvas"?canvas:link,body:{append(){}}}});
    await downloadBiaBrandPng(biaBrandDataUrl(buildBiaBrandSvg("Nome","RA56FHGGWY",artwork)),"Nome","RA56FHGGWY");
    assert.equal(canvas.width,1352);assert.equal(canvas.height,1412);assert.ok(clicked&&drawn);
    assert.equal(link.download,"marca-BIA-RA56FHGGWY.png");
    await downloadBiaBrandPng(biaBrandDataUrl(buildBiaHeaderSvg("Nome","RA56FHGGWY",artwork)),"Nome","RA56FHGGWY",true);
    assert.equal(canvas.width,4344);assert.equal(canvas.height,1448);
    assert.equal(link.download,"marca-BIA-RA56FHGGWY-horizontal.png");
  }finally{
    if(previousImage)Object.defineProperty(globalThis,"Image",previousImage);else Reflect.deleteProperty(globalThis,"Image");
    if(previousDocument)Object.defineProperty(globalThis,"document",previousDocument);else Reflect.deleteProperty(globalThis,"document");
  }
});

test("revisão usa consulta autorizada de rascunho sem substituir código por ID ou gravar imagem",()=>{
  const ui=readFileSync(new URL("../components/bia-brand-preview.tsx",import.meta.url),"utf8");
  assert.match(ui,/queryKey:\["\/api\/bias",id,"rascunho"\]/);
  assert.match(ui,/codigo_publico_indisponivel/);
  assert.match(ui,/!brand.url \|\| !name.trim\(\) \|\| !brand.code/);
  assert.match(ui,/Tentar carregar marca novamente/);
  assert.doesNotMatch(ui,/getBiaPublicRef|apiRequest\("(?:PUT|POST)|uploadBiaFiles|imagem_directus_id/);
});
