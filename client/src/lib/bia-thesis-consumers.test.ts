import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { biaBusinessTypeLabel, buildBiaThesisAllocation } from "../../../shared/bia-business-type";
import { STRATEGIC_CELL_BUSINESS_TYPES } from "../../../shared/strategic-cells";

function functionsFrom(path: string, names: string[]) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.push(node.getText(ast).replace(/^export /, ""));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(found.length, names.length);
  return transformSync(found.join("\n"), {loader: "tsx"}).code;
}

test("gráfico renderiza todas as teses, nomes completos e percentuais da base autorizada", () => {
  const wrapper = ({children}: any) => React.createElement("div", null, children);
  const scope = {React, Card: wrapper, CardContent: wrapper, ResponsiveContainer: wrapper, PieChart: wrapper, Pie: () => null, Cell: () => null, Tooltip: () => null, EmptyChart: () => null, CHART_COLORS: ["blue"], fmt: String, fmtPercent: (v: number) => `${v.toFixed(2)}%`};
  const Chart = new Function(...Object.keys(scope), functionsFrom("client/src/pages/painel.tsx", ["PieDistributionCard"]) + ";return PieDistributionCard;")(...Object.values(scope));
  const data = buildBiaThesisAllocation(STRATEGIC_CELL_BUSINESS_TYPES.map(([,code]) => ({business_type_code: code, invested: 100})));
  const html = renderToStaticMarkup(React.createElement(Chart, {title: "Alocação por tese de interesse", data}));
  for (const item of data) assert.ok(html.includes(item.name), item.name);
  assert.equal((html.match(/7,69%|7\.69%/g) || []).length, 13);
  assert.doesNotMatch(html, /class="truncate"/);
  const panel = readFileSync("client/src/pages/painel.tsx", "utf8");
  assert.match(panel, /buildBiaThesisAllocation\(bias\.map/);
  assert.match(panel, /invested: n\(b\.investimento_usuario_valor\)/);
  assert.match(panel, /title="Alocação por tese de interesse" data=\{alocacaoPorTese\}/);
});

test("MOU novo e placeholders compatíveis usam tese e destinação independentes", () => {
  const code = functionsFrom("server/routes.ts", ["mouValue", "buildBiaMouAtivoTexto", "buildBiaMouEnderecoCompleto", "biaMouAtivoCampos", "substituirBiaMouPlaceholders"]);
  const {build, replace} = new Function("biaBusinessTypeLabel", code + ";return {build:buildBiaMouAtivoTexto,replace:substituirBiaMouPlaceholders};")(biaBusinessTypeLabel);
  const bia = {nome_bia: "Teste", business_type_code: "SHORT_STAY", objetivo_alianca: "Venda", destinacao: "Residencial"};
  assert.match(build(bia), /tese de interesse: Explorar locação por temporada/);
  assert.doesNotMatch(build(bia), /Venda/);
  assert.equal(replace("[Tese de interesse]|[Objetivo da Aliança]|[Destinação]", bia), "Explorar locação por temporada|Explorar locação por temporada|Residencial");
  assert.match(build({objetivo_alianca: "Renda", destinacao: "Residencial"}), /tese de interesse: não informada/);
  for (const file of ["server/assets/bia-mou-padrao.txt", "server/assets/mou-padrao/mou-padrao-built.txt"]) {
    const rendered = replace(readFileSync(file, "utf8"), bia);
    assert.match(rendered, /Explorar locação por temporada/);
    assert.doesNotMatch(rendered, /\[Tese de interesse\]|\[Objetivo da Aliança\]/);
  }
});
