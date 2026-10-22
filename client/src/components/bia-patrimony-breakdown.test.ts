import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
test("patrimônio automático mostra componentes, perda, ausência e pendências sem formulário manual",()=>{
 const source=readFileSync(new URL('./bia-patrimony-breakdown.tsx',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('export function')).replace('export function','function');
 const Component=new Function('React',transformSync(code,{loader:'tsx'}).code+';return BiaPatrimonyBreakdown;')(React);
 const estimate:any={value:-200,assets:100,cash:0,debt:300,partial:true,issues:['Dívida de ativo não informada'],calculatedAt:'2026-10-22T00:00:00Z'};
 const html=()=>renderToStaticMarkup(React.createElement(Component,{estimate,format:(value:number)=>String(value)}));
 assert.match(html(),/-200/);assert.match(html(),/Estimativa parcial/);assert.match(html(),/Caixa registrado/);assert.match(html(),/Dívida de ativo/);
 estimate.value=null;assert.match(html(),/Dados insuficientes/);estimate.value=0;assert.doesNotMatch(html(),/Dados insuficientes/);
 const dashboard=readFileSync(new URL('../pages/carteira.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(dashboard,/snapshotForm|snapshotMutation|Aguardando valor oficial|Registrar novo snapshot/);
 assert.match(dashboard,/if\(isError\)return/);assert.match(dashboard,/if\(isLoading\)return/);assert.match(dashboard,/refetchInterval:30000/);
});
