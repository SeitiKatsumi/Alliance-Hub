import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { getMemberDirectoryDisplayName, memberSearchFilter } from '../lib/member-directory-query';
import { emptyBiaSetup, LEGAL_TYPES, LEGAL_STATES } from '../../../shared/bia-setup';

function component(file:string,name:string,scope:Record<string,unknown>) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n) && n.name?.text===name)!;
  return new Function(...Object.keys(scope),transformSync(fn.getText(ast).replace(/^export /,''),{loader:'tsx'}).code+`;return ${name};`)(...Object.values(scope));
}
test('legal name search keeps editable names, alphabetical suggestions and explicit invite action',()=>{
  const source=readFileSync(new URL('./bia-legal-person-field.tsx',import.meta.url),'utf8');
  const Wrapper=({children}:any)=>React.createElement('div',null,children);
  const Field=component('./bia-legal-person-field.tsx','BiaLegalPersonField',{React,useId:React.useId,useState:React.useState,
    useQuery:()=>({data:[{nome:'Zélia'},{nome:'Álvaro'},{nome:'Ana & Filhos'},{nome:'Álvaro'}]}),MEMBER_DIRECTORY_QUERY_OPTIONS:{},getMemberDirectoryDisplayName,memberSearchFilter,Input:'input',Textarea:'textarea',Button:'button',Popover:Wrapper,PopoverTrigger:Wrapper,PopoverContent:Wrapper,Command:Wrapper,CommandEmpty:()=>null,CommandInput:()=>null,CommandItem:Wrapper,CommandList:Wrapper});
  const html=renderToStaticMarkup(React.createElement(Field,{label:'Administrador',value:'Nome externo',onChange:()=>{}}));
  assert.match(html,/role="combobox"/);assert.match(html,/Nome externo/);
  assert.ok(html.indexOf('Álvaro')<html.indexOf('Zélia'));assert.equal(html.match(/Álvaro/g)?.length,1);
  assert.match(html,/Ana &amp; Filhos/);assert.match(html,/Não está na rede\? Convidar/);
  const readonly=renderToStaticMarkup(React.createElement(Field,{label:'Responsável jurídico',value:'Nome',disabled:true,onChange:()=>{}}));
  assert.match(readonly,/disabled=""/);assert.doesNotMatch(readonly,/Convidar/);
  assert.match(source,/apiRequest\("POST","\/api\/meu-convite",\{tipo:"unificado",force:false\}\)/);
  assert.match(source,/onClick=\{generate\}/);assert.match(source,/if\(disabled \|\| busy\)return/);
  assert.doesNotMatch(source,/useEffect|\/api\/bias\/.*(?:convite|participante)/);
});
test('legal summary and PDF distinguish OAB from legacy CPF and escape names',()=>{
  const Summary=component('./bia-setup-fields.tsx','BiaSetupSummary',{React,Fragment:React.Fragment,ASSET_METRICS:[],AssetTotals:()=>null});
  const value=emptyBiaSetup();Object.assign(value.juridico,{oabResponsavel:'SP 123456',documentoResponsavel:'12345678901',responsavel:'João <script>'});
  const html=renderToStaticMarkup(React.createElement(Summary,{value,moeda:'BRL'}));
  assert.match(html,/OAB do responsável jurídico<\/dt><dd[^>]*>SP 123456/);
  assert.match(html,/CPF\/CNPJ do responsável \(legado\)<\/dt><dd[^>]*>12345678901/);
  assert.match(html,/João &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});

test('legal examples never fill values and partner count follows added/removed forms',()=>{
  const Field=component('./bia-setup-fields.tsx','BiaLegalFields',{React,useRef:()=>({current:false}),useEffect:()=>{},css:'',LEGAL_TYPES,LEGAL_STATES,EMPTY_BIA_INFO:{},Input:'input',Textarea:'textarea',Button:'button',BiaNumberInput:({placeholder}:any)=>React.createElement('input',{placeholder}),BiaLegalPersonField:()=>null,BiaInformationFields:()=>null,window:{confirm:()=>true},crypto:{randomUUID:()=> 'new-person'}});
  let value=emptyBiaSetup();value.juridico.modalidade='societaria';
  const render=()=>Field({value,onChange:(v:any)=>{value=v;}});
  const nodes=(node:any):any[]=>!node || typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
  const button=(label:string)=>nodes(render()).find(n=>n.type==='button' && n.props.children===label);
  let html=renderToStaticMarkup(render());assert.match(html,/Total de sócios: <strong>0/);assert.match(html,/Ex.: 100.000,00/);assert.equal(value.juridico.capitalSocial,null);assert.equal(value.juridico.objeto,'');
  button('Adicionar sócio formal').props.onClick();html=renderToStaticMarkup(render());assert.match(html,/Total de sócios: <strong>1/);assert.match(html,/1 sem nome preenchido/);
  value.juridico.socios[0].nome='Maria';html=renderToStaticMarkup(render());assert.doesNotMatch(html,/sem nome preenchido/);
  button('Remover sócio formal').props.onClick();assert.equal(value.juridico.socios.length,0);
});

test('trade name defaults to BIA name once, preserves existing/manual values and read-only state',()=>{
  let initialized={current:{tradeName:false,object:false}},effect=()=>{},value=emptyBiaSetup(),writes=0;
  const Field=component('./bia-setup-fields.tsx','BiaLegalFields',{React,useRef:()=>initialized,useEffect:(fn:()=>void)=>{effect=fn;},css:'',LEGAL_TYPES,LEGAL_STATES,EMPTY_BIA_INFO:{},Input:'input',Textarea:'textarea',Button:'button',BiaNumberInput:()=>null,BiaLegalPersonField:()=>null,BiaInformationFields:()=>null});
  const render=(biaName='BIA São José & Filhos',disabled=false)=>{Field({value,biaName,disabled,onChange:(next:any)=>{value=next;writes++;}});effect();};
  value.juridico.info.razao_social='Empresa já cadastrada';
  render(' ');assert.equal(writes,0);render();assert.equal(value.juridico.info.nome_fantasia,'BIA São José & Filhos');assert.equal(value.juridico.info.razao_social,'Empresa já cadastrada');
  render();assert.equal(writes,1);
  value.juridico.info.nome_fantasia='Personalizado';render('Outro nome da BIA');assert.equal(value.juridico.info.nome_fantasia,'Personalizado');
  value.juridico.info.nome_fantasia='';render();assert.equal(value.juridico.info.nome_fantasia,'','permite limpar manualmente sem preencher a cada tecla');
  initialized={current:{tradeName:false,object:false}};value.juridico.info.nome_fantasia='Nome salvo';render();assert.equal(value.juridico.info.nome_fantasia,'Nome salvo');
  initialized={current:{tradeName:false,object:false}};value.juridico.info.nome_fantasia='';render('BIA',true);assert.equal(value.juridico.info.nome_fantasia,'');render('BIA');assert.equal(value.juridico.info.nome_fantasia,'BIA');
  assert.doesNotMatch(readFileSync(new URL('./bia-information-fields.tsx',import.meta.url),'utf8'),/Usar nome da BIA/);
  assert.match(readFileSync(new URL('./bia-setup-panel.tsx',import.meta.url),'utf8'),/!query.isError && revision<0/);
});

test('corporate object defaults exactly as requested, independently of name, and stays editable',()=>{
  const expected='Administração de bens próprios, incluindo imóveis, veículos, participações societárias e outros ativos patrimoniais, gestão de ativos e investimentos.';
  let initialized={current:{tradeName:false,object:false}},effect=()=>{},value=emptyBiaSetup();
  const Field=component('./bia-setup-fields.tsx','BiaLegalFields',{React,useRef:()=>initialized,useEffect:(fn:()=>void)=>{effect=fn;},css:'',LEGAL_TYPES,LEGAL_STATES,EMPTY_BIA_INFO:{},Input:'input',Textarea:'textarea',Button:'button',BiaNumberInput:()=>null,BiaLegalPersonField:()=>null,BiaInformationFields:()=>null});
  const render=(biaName='',disabled=false)=>{const tree=Field({value,biaName,disabled,onChange:(next:any)=>{value=next;}});effect();return tree;};
  value.juridico.modalidade='contratual';render();assert.equal(value.juridico.objeto,'');
  value.juridico.modalidade='societaria';render('',true);assert.equal(value.juridico.objeto,'');
  render('BIA Exemplo');assert.equal(value.juridico.objeto,expected);assert.equal(value.juridico.info.nome_fantasia,'BIA Exemplo');
  assert.match(renderToStaticMarkup(render()),/<textarea[^>]*rows="4"[^>]*>Administração/);
  value.juridico.objeto='Texto editado';render();assert.equal(value.juridico.objeto,'Texto editado');
  value.juridico.objeto='';render();assert.equal(value.juridico.objeto,'');
  initialized={current:{tradeName:false,object:false}};value.juridico.objeto='Objeto já cadastrado';render();assert.equal(value.juridico.objeto,'Objeto já cadastrado');
});
