import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { getMemberDirectoryDisplayName, memberSearchFilter } from '../lib/member-directory-query';
import { emptyBiaSetup } from '../../../shared/bia-setup';

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
    useQuery:()=>({data:[{nome:'Zélia'},{nome:'Álvaro'},{nome:'Ana & Filhos'},{nome:'Álvaro'}]}),MEMBER_DIRECTORY_QUERY_OPTIONS:{},getMemberDirectoryDisplayName,memberSearchFilter,Input:'input',Button:'button',Popover:Wrapper,PopoverTrigger:Wrapper,PopoverContent:Wrapper,Command:Wrapper,CommandEmpty:()=>null,CommandInput:()=>null,CommandItem:Wrapper,CommandList:Wrapper});
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
