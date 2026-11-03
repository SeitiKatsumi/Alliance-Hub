import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { AGENDA_ALERTS_REFRESH_MS, normalizeAgendaAlertsView, agendaAlertDestination } from "../lib/agenda-alerts";
import { activeAgendaAlertCount } from "../../../server/agenda-alerts";

test("cartão e links antigos abrem a mesma área existente de aprovações", async () => {
  const source=readFileSync(new URL("./agenda-alertas.tsx",import.meta.url),"utf8");
  const ast=ts.createSourceFile("agenda-alertas.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const code=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join("\n").replace("export default function","function");
  const items=["aporte1","aporte2"].map(id=>({id,source_type:"aporte_reminder",source_id:id,group:"pendencias" as const,category:"financeiro",title:`Pagar aporte ${id}`,description:"BIA de teste",priority:"media" as const,status:"pendente",action_required:true,active:true,href:`/agenda-alertas?view=agenda&task=${id}`}));
  const navigation:string[]=[];let search="?view=resumo&section=convites",writes=0;
  const passthrough=({children}:any)=>React.createElement(React.Fragment,null,children);
  const ConvitesPage=()=>React.createElement("div",null,"Aprovações pendentes");
  const scope={React,AGENDA_ALERTS_REFRESH_MS,normalizeAgendaAlertsView,agendaAlertDestination,
    useAuth:()=>({user:{role:"admin"}}),useEffect:()=>{},useSearch:()=>search,
    useLocation:()=>["/agenda-alertas",(href:string)=>navigation.push(href)],hasEmployeeModuleAccess:()=>true,
    useQuery:(options:any)=>({data:options.queryKey[0].endsWith("resumo")?{pending_count:activeAgendaAlertCount(items),pending_display:2,agenda:{today_count:0,overdue_count:7,preview:[]},alerts:{preview:items},updates:{preview:[]}}:items,isLoading:false,isError:false,refetch:()=>{}}),
    apiRequest:async()=>{writes++;},invalidateAgendaAlertQueries:async()=>{},queryClient:{},
    AlertTriangle:()=>null,BellRing:()=>null,CalendarDays:()=>null,ChevronRight:()=>null,Clock3:()=>null,History:()=>null,ListChecks:()=>null,
    AgendaPage:()=>null,ConvitesPage,Button:passthrough,Badge:passthrough,ModuleInfo:()=>null,
  };
  const Page=new Function(...Object.keys(scope),transformSync(code,{loader:"tsx"}).code+";return AgendaAlertasPage;")(...Object.values(scope));
  function nodes(element:any):any[]{if(!element||typeof element!=="object")return[];return[element,...React.Children.toArray(element.props?.children).flatMap(nodes)];}
  const summary=Page();
  const card=nodes(summary).find(n=>n.props?.["data-testid"]==="agenda-pending-summary-link");
  assert.equal(card?.type,"button");assert.equal(card.props.type,"button");
  assert.match(renderToStaticMarkup(card),/Ver pendências/);
  card.props.onClick();
  assert.equal(navigation.at(-1),"/agenda-alertas?view=alertas","não herda a seção de convites");
  search="?view=alertas";
  for(const path of ["?view=alertas","?view=alertas&section=convites"]) {
    search=path;
    const alerts=Page();
    const list=nodes(alerts).find(n=>n.type===ConvitesPage);
    assert.equal(list.props.embedded,true);
    const html=renderToStaticMarkup(alerts);
    assert.match(html,/Aprovações pendentes/);
    assert.doesNotMatch(html,/Tipos de alertas|Convites e chamadas/);
  }
  assert.equal(writes,0,"abrir pendência não paga, aceita nem marca lembrete como resolvido");
});
