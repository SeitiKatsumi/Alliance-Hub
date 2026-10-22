import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { BIA_PHASES } from "../../../shared/bia-phase";

test("checklist mostra condições e nomes pendentes sem a orientação genérica antiga",()=>{
  const source=readFileSync(new URL("./bia-phase-controls.tsx",import.meta.url),"utf8");
  const code=source.slice(source.indexOf("export function BiaPhaseProgressSummary"),source.indexOf("export function BiaPhaseControls")).replace("export function","function");
  const Component=new Function("React","BIA_PHASES",transformSync(code,{loader:"tsx"}).code+";return BiaPhaseProgressSummary;")(React,BIA_PHASES);
  const progress:any={phase:"em_captacao",nextPhase:"em_execucao",mode:"automatic",ready:false,checks:[{id:"map",label:"MAP Inicial válido",met:true},{id:"mou",label:"MOU aceito",met:false,detail:"Falta o aceite de: Sebastian Bernal"}]};
  const html=()=>renderToStaticMarkup(React.createElement(Component,{progress}));
  assert.match(html(),/Próxima fase: Em execução/);assert.match(html(),/Sebastian Bernal/);assert.match(html(),/Concluído/);assert.match(html(),/Pendente/);assert.doesNotMatch(html(),/aguardando avanço/);
  progress.ready=true;assert.match(html(),/aguardando avanço automático/);
  assert.doesNotMatch(source,/As fases avançam após|Receber receita não aprova/);
  assert.match(source,/progress.isError \?/);assert.match(source,/refetchInterval:open\?30000:false/);assert.match(source,/AbortSignal.timeout/);
});
