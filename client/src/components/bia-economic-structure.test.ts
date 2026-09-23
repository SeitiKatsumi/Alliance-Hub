import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { formatBiaNumber, formatBiaPercent } from "../../../shared/bia-numbers";

const source=readFileSync(new URL("./bia-economic-structure.tsx",import.meta.url),"utf8");
test("BEI segue os blocos numerados de 1 a 8 sem entrada ou cálculo de CPP na etapa",()=>{
  const form=source.slice(source.indexOf("export function BiaEconomicStructureFields"));
  const headings=["1. Identificação da BIA","2. Valor de Origem","3. Forma de capitalização","4. Cotas Iniciais","5. Distribuição das Cotas Iniciais e Aportes de Capital","6. Forma de integralização","7. Divisor Multiplicador","8. Resumo da Base Econômica Inicial"];
  let previous=-1;
  for(const title of headings){const at=form.indexOf(title);assert.ok(at>previous,title);previous=at;}
  assert.doesNotMatch(form,/Cotas de Investimento|Parcela das CPPs destinada|Classificação do capital/);
  assert.match(form,/Aportes cadastrados/);assert.match(form,/Saldo a integralizar/);
  assert.match(form,/natureLabel\(t.Nome\)/);
  assert.match(form,/details.open=true/);
  assert.match(form,/data-testid="bei-capital-distribution"/);
  assert.match(form,/aria-hidden="true" className="hidden grid-cols-/);
  assert.match(form,/<span className="md:sr-only">Sócio Aliado<\/span>/);
  assert.match(form,/\[&\[open\]\]:w-full/);
});

test("MAP Inicial é relatório em tabela, com totais e naturezas, sem campos editáveis",()=>{
  const start=source.indexOf("export function EconomicMapPreview");
  const code=transformSync(source.slice(start,source.indexOf("type Composition",start)).replace("export function","function"),{loader:"tsx"}).code;
  const Component=new Function("React","formatBiaNumber","formatBiaPercent","natureLabel",code+";return EconomicMapPreview;")(React,formatBiaNumber,formatBiaPercent,(s:string)=>s.replace(/^CPP\s*(?:de\s+)?/i,""));
  const html=renderToStaticMarkup(React.createElement(Component,{map:{valorOrigem:100,divisorMultiplicador:3.25,participantes:[{memberId:"a",nome:"Sócio A",cargos:["Diretor","Capital"],cotasInvestimento:1,capitalComprometido:100,cppCapitalPercentual:96.75,mapPercentual:100,tipoCppCapital:{nome:"CPP Capital"},contribuicoes:[{cargo:"Diretor",indice:1.25,tipoCpp:{nome:"CPP Liderança"}},{cargo:"Capital",indice:2,tipoCpp:{nome:"CPP Liderança"}}]}]}}));
  assert.equal((html.match(/<table/g)||[]).length,2);
  assert.doesNotMatch(html,/<input|<select|<textarea/);
  assert.match(html,/96,75000%/);assert.match(html,/3,25000%/);assert.match(html,/100,00000%/);
  assert.match(html,/Diretor \/ Capital/);assert.match(html,/CPP Liderança/);
});
