import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import ts from "typescript";
import { formatBiaNumber, formatBiaPercent } from "../../../shared/bia-numbers";
import { biaPdfSections, biaSummaryPrintCss, biaSummaryFooterCss, printBiaSummary } from "../lib/print-bia-summary";
import { buildBiaMouFooterText } from "../../../shared/bia-document-footer";
const brandUrl="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";

test("resumo usa valores do MAP, mantém condições personalizadas e escapa texto do usuário",()=>{
  const source=readFileSync(new URL("./bia-review-summary.tsx",import.meta.url),"utf8");
  const ast=ts.createSourceFile("summary.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=ast.statements.find(ts.isFunctionDeclaration)!.getText(ast).replace(/^export /,"");
  const Component=new Function("React","Fragment","formatBiaNumber","formatBiaPercent",transformSync(fn,{loader:"tsx"}).code+";return BiaReviewSummary;")(React,React.Fragment,formatBiaNumber,formatBiaPercent);
  const form={nome_bia:'BIA <script>alert(1)</script>',moeda:"BRL",objetivo_alianca:"Renda",destinacao:"Residencial",localizacao:"São Paulo",observacoes:""};
  const map={valorOrigem:1500000,divisorMultiplicador:2.35897,estrutura:{modalidade:"recursos_proprios",totalCotas:120,integralizacao:{forma:"personalizado",quantidade:12,meses:0,primeiroVencimento:"2026-10-20",correcao:"IPCA",observacoes:"Entradas em janeiro e julho"}}};
  const html=renderToStaticMarkup(React.createElement(Component,{form,map}));
  for(const text of ["1.500.000,00","2,35897%","120,00000","Personalizada","20/10/2026","IPCA","Entradas em janeiro e julho","Não informado","prévia em estruturação"])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/<script>/);
});

test("exportação filtra seções e aguarda selos; certificação segue a BIA, sem alterar dados",async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
  const previousFetch=globalThis.fetch, previousReader=Object.getOwnPropertyDescriptor(globalThis,"FileReader");
  try {
    globalThis.fetch=async input=>{assert.equal(input,"/branding/bia-header-artwork.png");return {ok:true,blob:async()=>new Blob(["png"],{type:"image/png"})} as Response;};
    Object.defineProperty(globalThis,"FileReader",{configurable:true,value:class {result="data:image/png;base64,TEST";onload?:()=>void;readAsDataURL(){this.onload?.();}}});
    Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>null}});
    assert.equal(printBiaSummary({} as HTMLElement,"Teste",undefined,false,brandUrl),false);
    let printed=0;const details=[{open:false},{open:false}];const appended:any[]=[];
    const nodes=biaPdfSections.map(s=>({dataset:{pdfSection:s.id},removed:false,remove(){this.removed=true;}}));
    const hidden={removed:false,remove(){this.removed=true;}};
    const created:any[]=[];
    let failImage=false;
    const original={} as HTMLElement;
    const popup={document:{open(){},write(){},close(){},title:"",head:{append(){}},body:{append(...nodes:any[]){appended.push(...nodes);}},createElement:(tag:string)=>{const node={tag,width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=>"data:image/png;base64,TEST",append(){},setAttribute(){},decode:()=>failImage?Promise.reject(new Error("image unavailable")):Promise.resolve()};created.push(node);return node;},importNode:(node:HTMLElement,deep:boolean)=>{assert.equal(node,original);assert.equal(deep,true);return {querySelectorAll:(selector:string)=>selector==="details"?details:selector==="[data-print-hide]"?[hidden]:nodes};}},focus(){},print(){printed++;},requestAnimationFrame:(fn:()=>void)=>fn()};
    Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>popup,location:{origin:"https://example.test"}}});
    assert.equal(printBiaSummary(original,"Teste",undefined,false,brandUrl,"OFICIAL01"),true);
    assert.equal(printed,0); // no printing before the image decode completes
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(printed,1);assert.ok(details.every(d=>d.open));assert.equal(appended.length,4);
    assert.equal(appended[1].className,"report-masthead");
    assert.equal(appended[3].className,"report-footer");
    assert.equal(created.filter(n=>n.tag==="img")[0].src,brandUrl);
    assert.match(decodeURIComponent(created.filter(n=>n.tag==="img")[1].src),/BIA-OFICIAL01/);
    assert.ok(created.some(n=>n.tag==="canvas" && n.width===2172 && n.height===724));
    assert.ok(created.some(n=>n.tag==="p" && n.textContent===buildBiaMouFooterText("Teste","OFICIAL01")));
    created.length=0;
    assert.equal(printBiaSummary(original,"Teste",["map"],true,brandUrl),true);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(created.filter(n=>n.tag==="img").length,3);
    assert.ok(created.some(n=>n.alt==="BUILT Certified Alliance - Aliança Certificada"));
    assert.equal(popup.document.title,"Resumo da BIA - Teste");
    assert.ok(hidden.removed);
    for(let mask=1;mask<16;mask++){
      const chosen=biaPdfSections.filter((_,i)=>mask & (1<<i)).map(s=>s.id);
      nodes.forEach(n=>{n.removed=false;});
      assert.equal(printBiaSummary(original,"Teste",chosen,false,brandUrl),true);
      await new Promise(resolve=>setImmediate(resolve));
      nodes.forEach(n=>assert.equal(n.removed,!chosen.includes(n.dataset.pdfSection)));
    }
    const count=printed;
    assert.equal(printBiaSummary(original,"Teste",[],false,brandUrl),false);
    assert.equal(printBiaSummary(original,"Teste"),false);
    assert.equal(printed,count);
    created.length=0;failImage=true;
    assert.equal(printBiaSummary(original,"Teste",undefined,false,brandUrl),true);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(printed,count);
    assert.ok(created.some(n=>n.textContent?.startsWith("Não foi possível carregar as marcas")));
    assert.ok(created.find(n=>n.tag==="button").disabled);
    assert.match(biaSummaryPrintCss,/\.report-header \{[^}]*background: white/);
    const footerCss=biaSummaryFooterCss("bia.png","certified.png","built.png","Aliança São José", "24/09/2026");
    assert.match(footerCss,/@bottom-center[^}]*bia.png/);
    assert.match(footerCss,/@bottom-center[^}]*certified.png/);
    assert.match(footerCss,/@top-left[^}]*built.png/);
    assert.match(footerCss,/@top-right[^}]*24\/09\/2026/);
    assert.match(footerCss,/@bottom-center[^}]*Aliança São José/);
    assert.match(footerCss,/counter\(page\)/);
    assert.doesNotMatch(biaSummaryFooterCss("bia.png"),/certified.png/);
    assert.match(biaSummaryPrintCss,/size: A4 landscape/);
    assert.match(footerCss,/width: 267mm/);
    assert.match(biaSummaryPrintCss,/\[data-pdf-section="condicoes"\] \{ padding-top: 8mm/);
    assert.match(biaSummaryPrintCss,/\[data-pdf-section="condicoes"\] h2 \{ margin-top: 0/);
    assert.match(biaSummaryPrintCss,/margin: 30mm 15mm 37mm/);
    assert.match(footerCss,/@top-left[^}]*125mm auto no-repeat/);
    assert.match(biaSummaryPrintCss,/\.report-masthead img \{ width: 472px/);
    assert.match(biaSummaryPrintCss,/table-layout: fixed/);
    assert.ok(readFileSync(new URL("../../public/branding/bia-header-artwork.png",import.meta.url)).length>0);
    const page=readFileSync(new URL("../pages/bia-nova.tsx",import.meta.url),"utf8");
    assert.match(page,/step===3 && <BiaPdfDialog[^>]+disabled=\{busy \|\| !preview.map\}/);
    assert.match(page,/certified=\{form.selo_certified_alliance===true\}/);
    assert.match(page,/brandCode=\{brand.code\}/);
    const dialog=readFileSync(new URL("./bia-pdf-dialog.tsx",import.meta.url),"utf8");
    assert.match(dialog,/DialogTrigger/);assert.match(dialog,/Salvar resumo em PDF/);
    assert.match(dialog,/disabled=\{disabled \|\| !sections.length \|\| !brandUrl\}/);
    assert.match(dialog,/modelFive \|\| s.id==="dados" \|\| s.id==="map"/);
  } finally {
    globalThis.fetch=previousFetch;
    if(previousReader)Object.defineProperty(globalThis,"FileReader",previousReader);else Reflect.deleteProperty(globalThis,"FileReader");
    if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");
  }
});

test("resumo e MOU compartilham o texto original do rodapé, sem inventar código na prévia",()=>{
  const expected="Esta página integra o MoU Padrão BUILT vinculado à BIA São José & Irmãos / OFICIAL01 e deve ser interpretada em conjunto com o documento completo, seus anexos, registros formais, deliberações internas e instrumentos jurídicos específicos da respectiva Aliança.";
  assert.equal(buildBiaMouFooterText("BIA São José & Irmãos", "OFICIAL01"),expected);
  assert.ok(biaSummaryFooterCss("bia.png",undefined,"header.png","BIA São José & Irmãos","24/09/2026","OFICIAL01").includes(JSON.stringify(expected)));
  assert.match(biaSummaryFooterCss("bia.png"),/BIA em estruturação e deve/);
  assert.doesNotMatch(biaSummaryFooterCss("bia.png"),/undefined|null/);
  const routes=readFileSync(new URL("../../../server/routes.ts",import.meta.url),"utf8");
  assert.match(routes,/return buildBiaMouFooterText\(String\(bia\?\.nome_bia \|\| "selecionada"\), String\(bia\?\.codigo_publico \|\| biaId\)\)/);
});
