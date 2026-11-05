import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { transformSync } from "esbuild";

test("Nova ação aparece uma vez na Agenda integrada e mantém o formulário existente", () => {
  const source=readFileSync(new URL("./agenda.tsx",import.meta.url),"utf8");
  const ast=ts.createSourceFile("agenda.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let header:ts.JsxElement|undefined;
  function visit(node:ts.Node) {
    if(ts.isJsxElement(node) && node.openingElement.getText(ast).includes('data-testid="agenda-calendar-toolbar"'))header=node;
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(header);
  const icon=()=>null;let opened=0;const openCreate=()=>opened++;
  const passthrough=({children}:any)=>React.createElement(React.Fragment,null,children);
  let dashboardOpen=false;
  const scope={React,Button:'button',Plus:icon,BarChart3:icon,ChevronLeft:icon,ChevronRight:icon,openCreate,
    calendarTitle:'novembro de 2026',changeCalendarPeriod:()=>{},goToToday:()=>{},
    setDashboardOpen:(value:boolean)=>{dashboardOpen=value;},GoogleCalendarConnection:()=>null,
    googleFrom:'2026-11-01',googleTo:'2026-12-06',setGoogleEntries:()=>{},
    viewMode:'calendario',calendarDisplay:'mes',setCalendarDisplay:()=>{},setViewMode:()=>{},
    Label:passthrough,Select:passthrough,SelectTrigger:passthrough,SelectValue:()=>null,SelectContent:passthrough,SelectItem:passthrough,statusFilter:'todas',setStatusFilter:()=>{},
  };
  const render=new Function(...Object.keys(scope),transformSync(`return (${header.getText(ast)});`,{loader:"tsx"}).code);
  function nodes(el:any):any[]{return el&&typeof el==='object'?[el,...React.Children.toArray(el.props?.children).flatMap(nodes)]:[];}
  for(const embedded of [true,false]) {
    const tree=render(...Object.values(scope));
    const html=renderToStaticMarkup(tree);
    assert.equal((html.match(/btn-nova-acao-agenda/g)||[]).length,1);
    assert.equal(html.includes("Início / Agenda"),false,'toolbar única não duplica cabeçalho da página');
    const button=nodes(tree).find((child:any)=>child.props?.["data-testid"]==="btn-nova-acao-agenda") as any;
    assert.equal(button.props.onClick,openCreate);button.props.onClick();
    nodes(tree).find(n=>n.props?.['data-testid']==='btn-agenda-dashboard').props.onClick();
    assert.equal(dashboardOpen,true);
    assert.equal(nodes(tree).find(n=>n.type===scope.GoogleCalendarConnection).props.compact,true);
  }
  assert.equal(opened,2);
  assert.match(source,/function openCreate\(\)\s*\{\s*openCreateAt\(\);/);
  const createAt=source.slice(source.indexOf("  function openCreateAt("),source.indexOf("  function openCreate()"));
  assert.match(createAt,/setDialogOpen\(true\)/);
  const dashboard=source.slice(source.indexOf('<Dialog open={dashboardOpen}'),source.indexOf('<Dialog open={dialogOpen}'));
  assert.match(dashboard,/agenda-status-dashboard/);
  assert.match(dashboard,/counts\[status\]/,'mesma base de contadores dentro do diálogo');
});
