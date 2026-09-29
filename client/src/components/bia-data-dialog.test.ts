import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {transformSync} from "esbuild";
import {formatBiaNumber,formatBiaPercent} from "../../../shared/bia-numbers";
import {governanceRoles,governanceLabel} from "../../../shared/bia-setup";

test("novo PDF nas duas entradas usa somente revisão autorizada e preserva PDF histórico",()=>{
  const source=readFileSync(new URL('./bia-map-history.tsx',import.meta.url),'utf8');
  const economic=readFileSync(new URL('./bia-economic-structure.tsx',import.meta.url),'utf8');
  const mapScope={React,formatBiaNumber,formatBiaPercent,governanceRoles,governanceLabel,natureLabel:(n:string)=>n.replace(/^CPP\s*(?:de\s+)?/i,'')};
  const EconomicMapPreview=new Function(...Object.keys(mapScope),transformSync(economic.slice(economic.indexOf('export function EconomicMapPreview'),economic.indexOf('type Composition')).replace('export function','function'),{loader:'tsx'}).code+';return EconomicMapPreview;')(...Object.values(mapScope));
  const version={id:'v1',tipo:'zero',numero:2,revisao_base:2,criado_em:'2026-09-25T21:43:10Z',autor:{name:'Autor histórico'},motivo:'Revisão <teste>',hash:'hash-preservado',snapshot:{biaName:'BIA histórica',base:{moeda:'BRL',modelo_calculo:5,valor_origem:1000000,divisor_multiplicador:4.5,estrutura_economica:{totalCotas:5,modalidade:'consorcio',instrumentos:[],integralizacao:{quantidade:240,forma:'parcelado',primeiroVencimento:'2026-10-20',meses:1,correcao:'IGP-M'}},participantes:[{participantId:'p',memberId:'m',nome:'Pessoa <teste>',tipo:'guardiao',cotasInvestimento:5,capitalComprometido:1000000,cppCapitalPercentual:95.5,mapPercentual:100,cargos:['Aliado BUILT'],contribuicoes:[{cargo:'Aliado BUILT',indice:4.5,tipoCpp:{nome:'CPP Origem'}},{cargo:'Contribuição individual',indice:0}]}]},rows:[{memberId:'m',name:'Pessoa <teste>',value:1000000,percent:100}]}};
  const original=structuredClone(version),prints:any[]=[],errors:string[]=[];
  function components({fetching=false,failed=false,code='OFICIAL',type='zero',artError=false}={}){
    let query=0;
    const responses=[{data:[version]},{data:{...version,tipo:type},isFetching:fetching,isError:failed},{},{data:'art',isError:artError}];
    const scope={React,EconomicMapPreview,formatBiaPercent,label:(v:any)=>`MAP Inicial — revisão ${v.numero}`,money:(n:number,c:string)=>n.toLocaleString('pt-BR',{style:'currency',currency:c}),useState:(v:any)=>[v,(v:any)=>errors.push(v)],useRef:()=>({current:{}}),useMemo:(fn:any)=>fn(),useQuery:()=>responses[query++],Card:'div',CardHeader:'div',CardTitle:'h2',CardContent:'div',Button:'button',apiRequest:()=>{throw Error('não deve gravar/buscar durante exportação');},loadBiaBrandArtwork:()=>'',buildBiaBrandSvg:()=>'<svg/>',biaBrandDataUrl:()=> 'data:image/svg+xml;test',printBiaSummary:(...args:any[])=>{prints.push(args);return false;}};
    const compiled=transformSync(source.slice(source.indexOf('export function BiaMapVersionReport')).replaceAll('export function','function'),{loader:'tsx'}).code;
    const result=new Function(...Object.keys(scope),compiled+';return {BiaMapVersionReport,BiaMapHistory};')(...Object.values(scope));
    return {...result,tree:result.BiaMapHistory({biaId:'bia',initialOnly:true,pdfCode:code})};
  }
  function nodes(n:any):any[]{return !n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];}
  const first=components();
  const html=renderToStaticMarkup(React.createElement(first.BiaMapVersionReport,{version}));
  for(const value of ['<table','Governança','CPP Total','hash-preservado','95,50000%','Pessoa &lt;teste&gt;','Revisão &lt;teste&gt;'])assert.ok(html.includes(value),value);
  assert.doesNotMatch(html,/Contribuição individual|<teste>/);
  const button=(tree:any)=>nodes(tree).find(n=>n.type==='button'&&n.props.children==='Gerar novo PDF do MAP Inicial');
  button(first.tree).props.onClick();assert.equal(prints.length,1);assert.equal(prints[0][1],'BIA histórica');assert.deepEqual(prints[0][2],['dados','map','cpp']);assert.equal(prints[0][6],'map');assert.match(errors.at(-1)!,/pop-ups/);
  for(const props of [{fetching:true},{failed:true},{code:''},{type:'atual'},{artError:true}]){const b=button(components(props).tree);assert.equal(b.props.disabled,true);b.props.onClick();}
  assert.equal(prints.length,1);assert.deepEqual(version,original);
  assert.ok(nodes(first.tree).some(n=>n.type==='a'&&n.props.href==='/api/bias/bia/map/versoes/v1/pdf'));
  const legacy={...version,snapshot:{...version.snapshot,base:{...version.snapshot.base,modelo_calculo:3}}};
  const oldHtml=renderToStaticMarkup(React.createElement(first.BiaMapVersionReport,{version:legacy}));assert.match(oldHtml,/Composição histórica/);assert.doesNotMatch(oldHtml,/CIs|CPP de Capital/);
  for(const path of ['./bia-data-dialog.tsx','../pages/bias.tsx'])assert.match(readFileSync(new URL(path,import.meta.url),'utf8'),/BiaMapHistory biaId=\{bia.id\} initialOnly pdfCode=/);
  assert.doesNotMatch(source,/calculateInitialMap|useMutation|"POST"|"PUT"/);
});

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
