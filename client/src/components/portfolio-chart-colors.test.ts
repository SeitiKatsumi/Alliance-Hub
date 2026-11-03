import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import ts from "typescript";
import { DASHBOARD_CHART_COLORS } from "../lib/dashboard-chart-colors";
import { portfolioComposition } from "../../../shared/portfolio-composition";

test("composição, distribuições e barras do Início usam a mesma paleta nas séries e legendas", () => {
  const source=readFileSync(new URL("./portfolio-composition.tsx",import.meta.url),"utf8");
  const code=source.replace(/^import .*;\r?\n/gm,"").replace(/export function/g,"function");
  const wrapper=({children}:any)=>React.createElement("g",null,children);
  const Cell=({fill}:any)=>React.createElement("rect",{fill});
  const Component=new Function("React","portfolioComposition","colors","PieChart","Pie","Cell","ResponsiveContainer","Tooltip",transformSync(code,{loader:"tsx"}).code+";return PortfolioComposition;")(React,portfolioComposition,DASHBOARD_CHART_COLORS,wrapper,wrapper,Cell,wrapper,()=>null);
  const html=renderToStaticMarkup(React.createElement(Component,{properties:[{id:"1",tipo:"Casa",ocupacao:"vazio"},{id:"2",tipo:"Apartamento",ocupacao:"ocupado"}]}));
  for(const color of DASHBOARD_CHART_COLORS.slice(0,2)){
    assert.match(html,new RegExp(`fill="${color}"`));
    assert.match(html,new RegExp(`background-color:${color}`));
  }
  const panel=readFileSync(new URL("../pages/painel.tsx",import.meta.url),"utf8");
  const ast=ts.createSourceFile("painel.tsx",panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const bindings:any[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(ast)==="Bar") {
      const props=node.attributes.properties.filter(ts.isJsxAttribute);
      const key=props.find(p=>p.name.getText(ast)==="dataKey")?.initializer;
      const fill=props.find(p=>p.name.getText(ast)==="fill")?.initializer;
      if(key&&ts.isStringLiteral(key)&&fill&&ts.isJsxExpression(fill)&&fill.expression){
        bindings.push([key.text,new Function("CHART_COLORS",`return ${fill.expression.getText(ast)}`)(DASHBOARD_CHART_COLORS)]);
      }
    }
    ts.forEachChild(node,visit);
  };visit(ast);
  assert.deepEqual(bindings,[["investimento",DASHBOARD_CHART_COLORS[0]],["receita",DASHBOARD_CHART_COLORS[1]]]);
  // The financial donut uses this same palette for both data cells and labels.
  const distribution=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="PieDistributionCard")!;
  const Distribution=new Function("React","CHART_COLORS","Card","CardContent","ResponsiveContainer","PieChart","Pie","Cell","Tooltip","EmptyChart","fmtPercent",transformSync(distribution.getText(ast),{loader:"tsx"}).code+";return PieDistributionCard;")(React,DASHBOARD_CHART_COLORS,wrapper,wrapper,wrapper,wrapper,wrapper,Cell,()=>null,()=>null,(v:number)=>`${v}%`);
  const distributionHtml=renderToStaticMarkup(React.createElement(Distribution,{title:"Destinação",data:[{name:"Residencial",value:80,percent:80},{name:"Comercial",value:20,percent:20}]}));
  for(const color of DASHBOARD_CHART_COLORS.slice(0,2)) {
    assert.match(distributionHtml,new RegExp(`fill="${color}"`));
    assert.match(distributionHtml,new RegExp(`background-color:${color}`));
  }
});
