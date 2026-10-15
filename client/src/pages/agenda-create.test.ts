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
    if(ts.isJsxElement(node) && node.openingElement.getText(ast).includes("sm:items-start"))header=node;
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(header);
  const render=new Function("React","Button","Plus","CalendarDays","embedded","openCreate",transformSync(`return (${header.getText(ast)});`,{loader:"tsx"}).code);
  const icon=()=>null;let opened=0;const openCreate=()=>opened++;
  for(const embedded of [true,false]) {
    const tree=render(React,"button",icon,icon,embedded,openCreate);
    const html=renderToStaticMarkup(tree);
    assert.equal((html.match(/btn-nova-acao-agenda/g)||[]).length,1);
    assert.equal(html.includes("Início / Agenda"),!embedded);
    const button=React.Children.toArray(tree.props.children).find((child:any)=>child.props?.["data-testid"]==="btn-nova-acao-agenda") as any;
    assert.equal(button.props.onClick,openCreate);button.props.onClick();
  }
  assert.equal(opened,2);
  assert.match(source,/function openCreate\(\)\s*\{[^}]*setDialogOpen\(true\)/);
});
