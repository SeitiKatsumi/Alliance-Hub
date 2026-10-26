import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import ts from 'typescript';
import * as domain from '../../../shared/bia-setup';
import { missingPatrimonyFields, setupPatrimonyAsset, assetCorrectionFields } from '../../../shared/bia-patrimony';

const source=readFileSync(new URL('./bia-setup-fields.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('assets.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['BiaAssetFields','AssetTotals','BiaSetupSummary'].includes(n.name?.text || '')).map(n=>n.getText(ast).replace(/^export /,'')).join('\n')+'\n'+readFileSync(new URL('./bia-asset-patrimony-fields.tsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export function/g,'function');
const wrap=({children}:any)=>React.createElement(React.Fragment,null,children);
let id=0;
const scope={React,Fragment:React.Fragment,...domain,useEffect:(effect:()=>void)=>effect(),useRef:(value:any)=>({current:value}),useState:(value:any)=>[value,()=>{}],useQuery:()=>({data:[]}),css:'',Input:'input',Button:'button',EMPTY_BIA_INFO:{},crypto:{randomUUID:()=>String(++id)},Dialog:wrap,DialogTrigger:wrap,DialogContent:wrap,DialogHeader:wrap,DialogTitle:wrap,DialogDescription:wrap,DialogClose:wrap,BiaBudgetSummary:()=>null,BiaInformationFields:()=>React.createElement('p',null,'Formulário de imóvel'),BiaNumberInput:({label,value,onChange}:any)=>React.createElement('input',{'aria-label':label,value:Number.isFinite(value)?value:'',onChange})};
const testLocation={search:''};
const fieldScope={...scope,assetCorrectionFields,missingPatrimonyFields,setupPatrimonyAsset,window:{location:testLocation},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}};
const {BiaAssetFields,BiaSetupSummary}=new Function(...Object.keys(fieldScope),transformSync(functions,{loader:'tsx'}).code+';return {BiaAssetFields,BiaSetupSummary};')(...Object.values(fieldScope));
const nodes=(n:any):any[]=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];

test('correction highlights only missing fields of the selected asset and clears as edited',()=>{
  const value=domain.emptyBiaSetup();
  value.ativos=[domain.biaSetupSchema.parse({...value,ativosIndefinidos:false,ativos:[{id:'target',nome:'Casa',situacao:'',info:{},indicadores:{}}]}).ativos[0]];
  const render=()=>renderToStaticMarkup(BiaAssetFields({value,moeda:'BRL',onChange:()=>{}}));
  const marked=()=>[...render().matchAll(/data-patrimony-field="([^"]+)" class="[^"]*ring-amber-500/g)].map(m=>m[1]);
  try {
    assert.deepEqual(marked(),[]);
    testLocation.search='?asset=another';assert.deepEqual(marked(),[]);
    testLocation.search='?asset=target';assert.deepEqual(marked(),['situacao','valorReferencia']);
    value.ativos[0].situacao='Em análise';assert.deepEqual(marked(),['valorReferencia']);
    value.ativos[0].situacao='Adquirido';assert.deepEqual(marked(),['valorReferencia','participacaoBiaPercentual','dividaSaldo']);
    Object.assign(value.ativos[0],{valorReferencia:100,participacaoBiaPercentual:100,dividaSaldo:0});assert.deepEqual(marked(),[]);
    value.ativos[0].participacaoBiaPercentual=101;assert.deepEqual(marked(),['participacaoBiaPercentual']);
    value.ativos[0].situacao='Alienado';assert.deepEqual(marked(),[]);
  } finally {testLocation.search='';}
});

test('structure editor saves without a manual reason and preserves revision and failure handling',async()=>{
  const panel=readFileSync(new URL('./bia-setup-panel.tsx',import.meta.url),'utf8');
  const parsed=ts.createSourceFile('panel.tsx',panel,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const editor=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='SetupEditor')!.getText(parsed).replace(/^export /,'');
  const value=domain.emptyBiaSetup(),states:any[]=[value,3,'',false,'ativos',JSON.stringify(value)],requests:any[]=[];
  let cursor=0,editable=true,fail=false;
  const mocks={...scope,useState:()=>{const index=cursor++;return [states[index],(v:any)=>states[index]=v];},useEffect:()=>{},useUnsavedChanges:()=>{},BiaAssetFields:()=>null,BiaLegalFields:()=>null,BiaBudgetFields:()=>null,useQuery:()=>({data:{editavel:editable,participantes:[],historico:[]},refetch:async()=>{}}),apiRequest:async(...args:any[])=>{requests.push(args);if(fail)throw new Error('Conflito de revisão');return {json:async()=>({revisao:4})};}};
  const run=new Function(...Object.keys(mocks),transformSync(editor,{loader:'tsx'}).code+';return SetupEditor;')(...Object.values(mocks));
  const render=(readOnly=false)=>{cursor=0;return run({biaId:'bia-test',moeda:'BRL',members:{},readOnly});};
  const save=(readOnly=false)=>nodes(render(readOnly)).find(n=>n.type==='button'&&n.props.children==='Salvar alteração');
  assert.doesNotMatch(renderToStaticMarkup(render()),/Motivo da alteração/);
  assert.equal(save().props.disabled,false);
  assert.equal(save(true),undefined);editable=false;assert.equal(save(),undefined);editable=true;
  states[3]=true;assert.equal(save().props.disabled,true);states[3]=false;
  await save().props.onClick();
  assert.deepEqual(requests[0],['PUT','/api/bias/bia-test/estrutura',{dados:value,motivo:'Atualização pelo editor da estrutura da BIA.',revisaoEsperada:3}]);
  assert.equal(states[1],4);assert.equal(states[3],false);
  fail=true;await save().props.onClick();assert.equal(states[2],'Conflito de revisão');assert.equal(states[1],4);assert.equal(states[3],false);
  assert.equal(requests[1][2].revisaoEsperada,4);
  const portalCalls:any[]=[];
  const portalMocks={...mocks,createPortal:(child:any,container:any)=>{portalCalls.push({child,container});return child;}};
  const portalEditor=new Function(...Object.keys(portalMocks),transformSync(editor,{loader:'tsx'}).code+';return SetupEditor;')(...Object.values(portalMocks));
  const container={};cursor=0;portalEditor({biaId:'bia-test',moeda:'BRL',members:{},actionContainer:container});
  assert.equal(portalCalls[0].container,container);assert.equal(portalCalls[0].child.props.children,'Salvar alteração');
  editable=false;cursor=0;portalEditor({biaId:'bia-test',moeda:'BRL',members:{},actionContainer:container});assert.equal(portalCalls[1].child,false);
  const page=readFileSync(new URL('../pages/bias.tsx',import.meta.url),'utf8');
  assert.match(page,/actionContainer=\{page\?setupActionContainer:null\}/);assert.match(page,/ref=\{setSetupActionContainer\} hidden=/);
});

test('asset choice creates only the selected form and preserves other assets and read-only guards',()=>{
  let value=domain.emptyBiaSetup(),writes=0;
  const render=(disabled=false)=>BiaAssetFields({value,moeda:'BRL',disabled,onChange:(v:any)=>{value=v;writes++;}});
  const choice=(label:string,disabled=false)=>nodes(render(disabled)).find(n=>n.type==='button'&&n.props.children===label);
  render();assert.equal(writes,0);assert.equal(choice('Adicionar ativo').props.onClick,undefined);
  const actions=nodes(render()).find(n=>n.type==='div'&&n.props.className==='flex flex-wrap gap-3');
  assert.ok(actions && nodes(actions).some(n=>n.props?.children==='Adicionar da Carteira'));
  assert.ok(nodes(actions).some(n=>n.props?.children==='Adicionar ativo'));
  choice('Consórcio',true).props.onClick();assert.equal(writes,0);
  choice('Imóvel').props.onClick();assert.equal(value.ativos[0].tipo,'imovel');assert.match(renderToStaticMarkup(render()),/Formulário de imóvel/);
  const property=structuredClone(value.ativos[0]);
  choice('Consórcio').props.onClick();assert.equal(value.ativos[1].tipo,'consorcio');assert.equal(value.ativos[1].consorcio?.valorCarta,null);
  assert.equal(renderToStaticMarkup(render()).match(/Formulário de imóvel/g)?.length,1);
  const consortium=()=>nodes(render()).filter(n=>n.type==='article')[1];
  const genericLabels=['Nome do ativo','Situação','Titular formal','Data de vínculo','Valor de referência (BRL)'];
  for(const label of genericLabels){
    assert.ok(renderToStaticMarkup(nodes(render()).filter(n=>n.type==='article')[0]).includes(label));
    assert.ok(!renderToStaticMarkup(consortium()).includes(label));
  }
  for(const [placeholder,input] of [['Ex.: 2352','002352'],['Ex.: HS Consórcios','HS <script>'],['Ex.: 220','220'],['Ex.: 10','10']])nodes(consortium()).find(n=>n.type==='input'&&n.props.placeholder===placeholder).props.onChange({target:{value:input}});
  for(const [label,input] of [['Valor da carta — ativo 2',1000000],['Parcela até a contemplação — ativo 2',2795]])nodes(consortium()).find(n=>n.props.label===label).props.onChange(input);
  assert.deepEqual(value.ativos[1].consorcio,{cota:'002352',administradora:'HS <script>',valorCarta:1000000,prazoMeses:220,parcelaAteContemplacao:2795,diaVencimento:10});
  assert.deepEqual(value.ativos[0],property);assert.equal(value.orcamento,undefined);assert.equal(domain.assetTotals(value).valorReferencia,null);
  const previousFields={nome:'Cadastro anterior',situacao:'Em análise' as const,titular:'Titular anterior',dataVinculo:'2026-09-28',valorReferencia:123};
  Object.assign(value.ativos[1],previousFields);
  const invalidDay=()=>nodes(consortium()).find(n=>n.type==='input'&&n.props.placeholder==='Ex.: 10');
  invalidDay().props.onChange({target:{value:'32'}});
  assert.doesNotThrow(()=>nodes(consortium()).find(n=>n.props.label==='Valor da carta — ativo 2').props.onChange(0),'invalid input must remain correctable');
  invalidDay().props.onChange({target:{value:'10'}});assert.doesNotThrow(()=>domain.biaSetupSchema.parse(value));
  for(const [key,expected] of Object.entries(previousFields))assert.equal((value.ativos[1] as any)[key],expected,'hidden data must survive edits');
  const html=renderToStaticMarkup(BiaSetupSummary({value,moeda:'BRL'}));
  assert.match(html,/data-pdf-section="ativos"/);assert.match(html,/Cota: 002352/);assert.match(html,/HS &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(html,/Prazo \(meses\): 220/);assert.match(html,/2\.795,00/);assert.match(html,/Dia do vencimento mensal: 10/);assert.match(html,/Valor da carta: R\$\s*0,00/);
  assert.equal(choice('Consórcio',true).props.disabled,true);
  assert.match(readFileSync(new URL('../pages/bia-nova.tsx',import.meta.url),'utf8'),/BiaAssetFields disabled=\{busy \|\| concluding\}/);
  assert.match(readFileSync(new URL('./bia-setup-panel.tsx',import.meta.url),'utf8'),/BiaAssetFields disabled=\{busy \|\| readOnly \|\| !query.data.editavel\}/);
});

test('undefined asset remains selectable and clears only the BIA selection',()=>{
  let value=domain.emptyBiaSetup(),writes=0;
  const render=(disabled=false)=>BiaAssetFields({value,moeda:'BRL',disabled,onChange:(v:any)=>{value=v;writes++;}});
  const add=(label:string)=>nodes(render()).find(n=>n.type==='button'&&n.props.children===label).props.onClick();
  const checkbox=(disabled=false)=>nodes(render(disabled)).find(n=>n.type==='input'&&n.props.type==='checkbox');
  assert.equal(checkbox().props.disabled,false);
  add('Imóvel');add('Consórcio');
  value.ativos[0].carteiraImovelId='portfolio-example';
  const previous=structuredClone(value),oldValue=value;
  assert.equal(checkbox().props.disabled,false);
  assert.equal(checkbox(true).props.disabled,true);
  const before=writes;
  checkbox(true).props.onChange({target:{checked:true}});assert.equal(writes,before);
  checkbox().props.onChange({target:{checked:true}});
  assert.equal(value.ativosIndefinidos,true);assert.deepEqual(value.ativos,[]);
  assert.deepEqual(value,{...previous,ativosIndefinidos:true,ativos:[]});
  assert.deepEqual(oldValue,previous,'original asset records must not be mutated');
  assert.doesNotThrow(()=>domain.biaSetupSchema.parse(value));
  checkbox().props.onChange({target:{checked:false}});
  assert.equal(value.ativosIndefinidos,false);assert.deepEqual(value.ativos,[]);
  checkbox().props.onChange({target:{checked:true}});add('Consórcio');
  assert.equal(value.ativosIndefinidos,false);assert.equal(value.ativos.length,1);
  checkbox().props.onChange({target:{checked:false}});assert.equal(value.ativos.length,1);
});
