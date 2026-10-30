import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { biaHasSalesThesis } from "../../../shared/bia-sales-analysis";

test("Capital oculta aba e conteúdo sem tese de venda, inclusive URL direta e acesso negado", () => {
  const source = readFileSync(new URL("./nucleo-capital.tsx", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("export default function NucleoCapitalPage"), source.indexOf("function FinanceiroBia("))
    .replace("export default function", "function");
  const block = ({children, ...props}: any) => React.createElement("div", {"data-testid":props["data-testid"], className:props.className}, children);
  const scope = { React, useState:React.useState, useEffect:()=>{}, biaHasSalesThesis,
    normalizeCapitalTab:(v:string)=>["banco","financeiro","analises"].includes(v)?v:"banco",
    Banknote:()=>null, Wallet:()=>null, BarChart3:()=>null, Landmark:()=>null,
    Tabs:block, TabsList:block, TabsTrigger:block, TabsContent:block,
    BancoBiaPage:()=>React.createElement("p",null,"banco-renderizado"), FinanceiroBia:()=>null,
    ResultadosPage:()=>React.createElement("p",null,"analises-renderizadas"), confirmDiscardChanges:()=>true };
  const Component = new Function(...Object.keys(scope), transformSync(body,{loader:"tsx"}).code + ";return NucleoCapitalPage;")(...Object.values(scope));
  const render = (bia:any, access?:any) => renderToStaticMarkup(React.createElement(Component,{bia,access,activeTab:"analises",embedded:true}));
  assert.match(render({objetivo_alianca:"FLIPPING"}), /tab-capital-analises/);
  assert.match(render({objetivo_alianca:"FLIPPING"}), /analises-renderizadas/);
  for(const bia of [undefined, {}, {objetivo_alianca:"SHORT_STAY"}]) {
    const html=render(bia); assert.doesNotMatch(html,/tab-capital-analises|analises-renderizadas|sm:grid-cols-3/); assert.match(html,/banco-renderizado/);
  }
  assert.doesNotMatch(render({objetivo_alianca:"FLIPPING"},{banco:"view",analises:"none"}),/tab-capital-analises|analises-renderizadas/);
  const detail=readFileSync(new URL("./bia-detalhe.tsx",import.meta.url),"utf8");
  assert.match(detail,/<NucleoCapitalPage\s+bia=\{bia\}/);
});
