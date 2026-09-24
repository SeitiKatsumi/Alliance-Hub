import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import ts from "typescript";
import { formatBiaNumber, formatBiaPercent } from "../../../shared/bia-numbers";
import { biaPdfSections, printBiaSummary } from "../lib/print-bia-summary";

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

test("exportação clona a revisão e abre os detalhes sem salvar, concluir ou alterar o formulário",()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
  try {
    Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>null}});
    assert.equal(printBiaSummary({} as HTMLElement,"Teste"),false);
    let printed=0;const details=[{open:false},{open:false}];const appended:any[]=[];
    const nodes=biaPdfSections.map(s=>({dataset:{pdfSection:s.id},removed:false,remove(){this.removed=true;}}));
    const hidden={removed:false,remove(){this.removed=true;}};
    const original={} as HTMLElement;
    const popup={document:{open(){},write(){},close(){},title:"",head:{append(){}},body:{append(...nodes:any[]){appended.push(...nodes);}},createElement:()=>({append(){}}),importNode:(node:HTMLElement,deep:boolean)=>{assert.equal(node,original);assert.equal(deep,true);return {querySelectorAll:(selector:string)=>selector==="details"?details:selector==="[data-print-hide]"?[hidden]:nodes};}},focus(){},print(){printed++;},requestAnimationFrame:(fn:()=>void)=>fn()};
    Object.defineProperty(globalThis,"window",{configurable:true,value:{open:()=>popup}});
    assert.equal(printBiaSummary(original,"Teste"),true);
    assert.equal(printed,1);assert.ok(details.every(d=>d.open));assert.equal(appended.length,2);
    assert.equal(popup.document.title,"Resumo da BIA - Teste");
    assert.ok(hidden.removed);
    for(let mask=1;mask<16;mask++){
      const chosen=biaPdfSections.filter((_,i)=>mask & (1<<i)).map(s=>s.id);
      nodes.forEach(n=>{n.removed=false;});
      assert.equal(printBiaSummary(original,"Teste",chosen),true);
      nodes.forEach(n=>assert.equal(n.removed,!chosen.includes(n.dataset.pdfSection)));
    }
    const count=printed;
    assert.equal(printBiaSummary(original,"Teste",[]),false);
    assert.equal(printed,count);
    const page=readFileSync(new URL("../pages/bia-nova.tsx",import.meta.url),"utf8");
    assert.match(page,/step===3 && <BiaPdfDialog[^>]+disabled=\{busy \|\| !preview.map\}/);
    const dialog=readFileSync(new URL("./bia-pdf-dialog.tsx",import.meta.url),"utf8");
    assert.match(dialog,/DialogTrigger/);assert.match(dialog,/Salvar resumo em PDF/);
    assert.match(dialog,/disabled=\{disabled \|\| !sections.length\}/);
    assert.match(dialog,/modelFive \|\| s.id==="dados" \|\| s.id==="map"/);
  } finally {if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");}
});
