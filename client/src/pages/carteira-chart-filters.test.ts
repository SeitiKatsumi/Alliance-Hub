import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import ts from "typescript";
import { selectPortfolio } from "../../../shared/portfolio-selection";
import { portfolioDashboardFromApi } from "../../../shared/portfolio-dashboard";

test("filtros dos blocos compactos alimentam métricas, composição e chave/URL do histórico", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("carteira.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const panel = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "CarteiraDashboardPanel")!;
  // Keep the real panel/branches; replace hooks and unrelated widgets only.
  const componentNames = new Set<string>();
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[A-Z]/.test(node.tagName.getText(ast))) componentNames.add(node.tagName.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(panel);
  const properties = [{id:"p1",nome:"Casa 1",valor_pago:100,valor_aquisicao_brl:100}, {id:"p2",nome:"Casa 2",valor_pago:700,valor_aquisicao_brl:700}];
  const alliances = [{id:"b1",nome:"Aliança 1",cpp_contributed_brl:20,cpp_remaining_brl:30}, {id:"b2",nome:"Aliança 2",cpp_contributed_brl:80,cpp_remaining_brl:10}];
  const states: any[] = []; let stateIndex=0, captured:any, request:any;
  const scope:any = {React, selectPortfolio, portfolioDashboardFromApi,
    useState:(initial:any) => { const index=stateIndex++; if (!(index in states)) states[index]=initial; return [states[index],(value:any)=>{states[index]=value;}]; },
    useEffect:()=>{},useMemo:(fn:any)=>fn(),useRef:(value:any)=>({current:value}),useLocation:()=>["/",()=>{}],useToast:()=>({toast:()=>{}}),useAuth:()=>({user:{role:"membro"}}),
    useMutation:()=>({mutate:()=>{},isPending:false}),
    useQuery:(options:any)=> { if(options.queryKey[0]==="/api/carteira/resumo") return {data:{imoveis:properties,aliancas:alliances,dashboard:portfolioDashboardFromApi(properties,alliances)},refetch:()=>{}};
      if(options.queryKey[0]==="/api/carteira/evolucao") request=options;
      return {}; },
    portfolioPropertyRegions:()=>[],canAccess:()=>false,queryClient:{},
    apiRequest:async (_method:string,url:string)=>({json:async()=>({url})}),
  };
  const noop=()=>null;
  for(const name of componentNames) scope[name]=noop;
  scope.PortfolioPatrimonyDashboard=(props:any)=>{captured=props;return null;};
  const Component = new Function(...Object.keys(scope),transformSync(panel.getText(ast).replace("export function","function"),{loader:"tsx"}).code+";return CarteiraDashboardPanel;")(...Object.values(scope));
  const render=(props:any)=>{stateIndex=0;renderToStaticMarkup(React.createElement(Component,{compact:true,...props}));return captured;};
  const before=render({showAlliances:false});
  assert.deepEqual(before.propertyFilter.items,properties);
  assert.equal(before.allianceFilter,undefined);
  before.propertyFilter.onChange("p2");
  const selected=render({showAlliances:false});
  assert.equal(selected.propertyFilter.value,"p2");
  assert.deepEqual(selected.properties,[properties[1]]);
  assert.equal(selected.metrics.acquisition.value,700);
  assert.equal(request.queryKey[2],"p2");
  return request.queryFn().then((body:any)=>{
    assert.equal(new URL(body.url,"http://localhost").searchParams.get("propertyId"),"p2");
    const cpp=render({alliancesOnly:true});
    assert.equal(cpp.showProperties,false); assert.equal(cpp.propertyFilter,undefined);
    assert.deepEqual(cpp.allianceFilter.items,alliances);
    cpp.allianceFilter.onChange("b2");
    const oneAlliance=render({alliancesOnly:true});
    assert.equal(oneAlliance.allianceFilter.value,"b2");
    assert.equal(oneAlliance.metrics.cppContributed.value,80);
    assert.equal(oneAlliance.metrics.cppRemaining.value,10);
    assert.equal(request.queryKey[2],"");assert.equal(request.queryKey[3],"b2");
    // Losing access resets the stale selection to the authorized aggregate.
    properties.pop();alliances.pop();
    assert.equal(render({showAlliances:false}).propertyFilter.value,"");
    assert.equal(render({alliancesOnly:true}).allianceFilter.value,"");
  });
});
