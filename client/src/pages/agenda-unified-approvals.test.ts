import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {transformSync} from "esbuild";
import {AgendaPendingAlerts,NativeApprovalStatus} from "../components/agenda-pending-alerts";
import {additionalApprovalAlerts,agendaAlertDestination,type AgendaPendingAlert} from "../lib/agenda-alerts";

test("lista existente reúne lembretes com MOU/diretoria, contador e ações sem segundo painel", async()=>{
  const source=readFileSync(new URL('./comunidade.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('comunidade.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let block='';
  function visit(n:ts.Node){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='div'&&n.openingElement.getText(ast).includes('rounded-2xl')&&n.getText(ast).includes('Histórico de Aprovações')){block=n.getText(ast);return;}ts.forEachChild(n,visit);}visit(ast);
  assert.ok(block);
  const items:AgendaPendingAlert[]=['1','2'].map(id=>({id,source_type:'aporte_reminder',source_id:id,group:'pendencias',category:'financeiro',title:`Pagar aporte ${id}`,description:'BIA de teste',priority:'media',status:'pendente',action_required:true,active:true,href:`/bias/bia?tab=capital&capital=financeiro&paymentFlow=${id}`}));
  const actions:any[]=[],navigation:string[]=[];
  const Button=({children,...props}:any)=>React.createElement('button',props,children);
  const scope:any={React,AgendaPendingAlerts,NativeApprovalStatus,agendaAlertDestination,Button,Ticket:()=>null,CheckCircle:()=>null,XCircle:()=>null,Trash2:()=>null,
    nativeApprovalLoading:false,nativeApprovalUnavailable:false,retryNativeApprovals:()=>actions.push('retry-native'),
    mostrarHistoricoAprovacoes:false,totalAprovacoesPendentes:4,aprovacoesHistorico:[],aprovacoesExibidas:[],mouRevisoesError:false,
    mouRevisoesFiltradas:[{id:'bia',bia_nome:'BIA de teste',map_revisao:2}],diretorSolicitacoesPendentes:[{id:'d',papel:'Diretor',diretor_membro_id:'m',bia_nome:'BIA de teste'}],socioSolicitacoesPendentes:[],
    additionalApprovals:additionalApprovalAlerts(items,[]),pendingApprovalAlerts:{isLoading:false,isError:false,refetch:()=>actions.push('retry')},
    MOU_REVIEW_LABEL:'Ler e aceitar MOU',user:{membro_directus_id:'m'},revisarMouMutation:{isPending:false,mutate:(v:any)=>actions.push(v)},responderDiretoriaMutation:{isPending:false,mutate:(v:any)=>actions.push(v)},
    setNotificacoesTab:()=>{},setMostrarHistoricoAprovacoes:()=>{},navigate:(url:string)=>navigation.push(url),
  };
  const render=(patch={})=>{const values={...scope,...patch};return new Function(...Object.keys(values),transformSync(`return (${block})`,{loader:'tsx'}).code)(...Object.values(values));};
  const tree=render(),html=renderToStaticMarkup(tree);
  assert.equal((html.match(/Aprovações Pendentes/g)||[]).length,1);
  assert.match(html,/4 itens/);for(const item of items)assert.ok(html.includes(item.title));
  assert.match(html,/Ler e aceitar/);assert.match(html,/btn-aceitar-diretoria-d/);assert.match(html,/btn-recusar-diretoria-d/);
  assert.match(html,/Ver lançamento/);assert.doesNotMatch(html,/Ver detalhes/);
  assert.doesNotMatch(html,/Nenhuma aprovação|Pendências ativas/);
  function nodes(el:any):any[]{return el&&typeof el==='object'?[el,...React.Children.toArray(el.props?.children).flatMap(nodes)]:[];}
  nodes(tree).find(n=>n.props?.['data-testid']==='btn-aceitar-diretoria-d').props.onClick();
  assert.deepEqual(actions,[{id:'d',decisao:'aceitar'}]);
  const rows=nodes(tree).find(n=>n.type===AgendaPendingAlerts);rows.props.onOpen(items[0]);assert.equal(navigation[0],items[0].href);
  const empty={mouRevisoesFiltradas:[],diretorSolicitacoesPendentes:[],additionalApprovals:[],totalAprovacoesPendentes:0};
  const loading=renderToStaticMarkup(render({...empty,pendingApprovalAlerts:{isLoading:true,isError:false}}));
  assert.match(loading,/Carregando alertas/);assert.doesNotMatch(loading,/Nenhuma aprovação/);
  const error=renderToStaticMarkup(render({...empty,pendingApprovalAlerts:{isLoading:false,isError:true}}));
  assert.match(error,/Não foi possível atualizar/);assert.doesNotMatch(error,/Nenhuma aprovação/);
  const delayed=renderToStaticMarkup(render({...empty,nativeApprovalLoading:true,totalAprovacoesPendentes:1}));
  assert.match(delayed,/Carregando aprovações/);assert.match(delayed,/1 item/);
  assert.doesNotMatch(delayed,/Ver detalhes|Nenhuma aprovação|btn-aceitar-diretoria/);
  const missing=render({...empty,nativeApprovalUnavailable:true,totalAprovacoesPendentes:1});
  assert.match(renderToStaticMarkup(missing),/Não foi possível carregar algumas aprovações/);
  assert.doesNotMatch(renderToStaticMarkup(missing),/Ver detalhes|Nenhuma aprovação/);
  nodes(missing).find(n=>n.type===NativeApprovalStatus).props.onRetry();assert.equal(actions.at(-1),'retry-native');
  const polling=renderToStaticMarkup(render({nativeApprovalLoading:false}));
  assert.match(polling,/btn-aceitar-diretoria-d/);assert.doesNotMatch(polling,/Carregando aprovações/);
  const history=renderToStaticMarkup(render({...empty,mostrarHistoricoAprovacoes:true}));
  assert.match(history,/Histórico de Aprovações/);assert.doesNotMatch(history,/Pagar aporte/);
});
