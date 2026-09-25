import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Dados da BIA preserva autorização, fonte oficial e exportações sem gravação",()=>{
  const page=readFileSync(new URL("../pages/bia-detalhe.tsx",import.meta.url),"utf8");
  const data=readFileSync(new URL("./bia-data-dialog.tsx",import.meta.url),"utf8");
  assert.match(page,/canViewBiaConfiguration && <BiaDataDialog bia=\{bia\}/);
  assert.doesNotMatch(page,/BiaSetupPanel/);
  assert.match(data,/open && <BiaDataContent/);
  assert.match(data,/bia\.codigo_publico\?\.trim\(\) \|\| null/);
  assert.match(data,/canExport = !!code && !!bia\.nome_bia\.trim\(\)/);
  assert.match(data,/disabled=\{!canExport/);
  for(const label of ["Resumo","Marcas","MAP Inicial","Salvar resumo em PDF","Salvar marcas em PDF","Baixar PNG vertical","Baixar PNG horizontal"]) assert.ok(data.includes(label),label);
  assert.match(data,/BiaMapHistory biaId=\{bia.id\} initialOnly/);
  assert.match(data,/BiaReviewSummary form=\{form\} map=\{bia.map_inicial\} consultation/);
  assert.match(data,/bia.selo_certified_alliance===true/);
  assert.doesNotMatch(data,/apiRequest|useMutation|localStorage|PUT|POST|getBiaPublicRef|calculateInitialMap/);
});
