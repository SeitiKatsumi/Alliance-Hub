import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as built from '../../../shared/built-valuation';
import { PROPERTY_THESIS_OPTIONS } from '../../../shared/property-thesis';
import { formatPtBrMoneyInput } from '../lib/pt-br-money';

const fact=(valor:number)=>({valor,classificacao:'informada',fonte:'Contrato',data:'2026-01-01',verificacao:'nao_conferida',limitacao:''});
const input:any={titulo:'Alternativa de renda',finalidade:'Planejamento',dataBase:'2026-01-01',moeda:'BRL',categoria:'comercial',direito:'Propriedade',participacaoPercentual:50,tese:'BUY_AND_HOLD',contexto:'atual',condicoes:'',restricoes:'Nenhuma conhecida',condicaoAtual:'Ocupado',vistoria:'nao_realizada',caracteristicas:[],calculo:{metodo:'renda',receitaAnual:fact(90000),despesaAnual:fact(20000),perdasAnuais:fact(10000),taxaCapitalizacao:fact(6)},limitacoes:'Sem vistoria'};
const row={id:'11111111-1111-4111-8111-111111111111',casoId:'22222222-2222-4222-8222-222222222222',criadoEm:'2026-11-09',motivo:'cadastro',entrada:input,resultado:built.calculateBuiltCase(input)};
function components(options:{state?:any[];query?:any}={}) {
  let index=0;
  const source=readFileSync(new URL('./built-valuation-workbench.tsx',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
  const Button=({children,loading,loadingText,onClick,disabled,...props}:any)=>React.createElement('button',{...props,onClick,disabled:disabled||loading,'aria-busy':!!loading},children);
  const scope:any={React,useState:(initial:any)=>[options.state?.[index++]??initial,()=>{}],useEffect:()=>{},useId:()=>React.useId(),cloneElement:React.cloneElement,isValidElement:React.isValidElement,
    useQuery:()=>options.query||{data:{imovel:{moeda:'BRL'},analises:[row],documentos:[],revisoes:[],validacoes:[],desempenho:{status:'sem_registros_pagos',periodo:'Histórico disponível'}}},useQueryClient:()=>({}),
    BUILT_METHODS:built.BUILT_METHODS,BUILT_RESULT_LABELS:built.BUILT_RESULT_LABELS,BUILT_CATEGORY_LABELS:built.BUILT_CATEGORY_LABELS,BUILT_SCENARIO_LABELS:built.BUILT_SCENARIO_LABELS,FLOW_CATEGORIES:built.FLOW_CATEGORIES,INFORMATION_CLASSES:built.INFORMATION_CLASSES,PROPERTY_SPECIFIC_FIELDS:built.PROPERTY_SPECIFIC_FIELDS,builtCaseSchema:built.builtCaseSchema,builtValidationMessage:built.builtValidationMessage,PROPERTY_THESIS_OPTIONS,
    apiRequest:()=>{throw new Error('render não envia');},formatPtBrMoneyInput,Button,Input:(p:any)=>React.createElement('input',p),Textarea:(p:any)=>React.createElement('textarea',p)};
  return new Function(...Object.keys(scope),transformSync(source,{loader:'tsx'}).code+';return {BuiltStudyResult,BuiltValuationWorkbench,CalculationFields};')(...Object.values(scope));
}
test('tela real distingue métodos, alternativas, projeções, desempenho pago, adoção e revisão',()=>{
  const c=components({state:[input,row,row.casoId]});
  const html=renderToStaticMarkup(React.createElement(c.BuiltValuationWorkbench,{id:'own',canManage:true}));
  for(const label of ['Método BUILT','Alternativa de renda','Capitalização da renda','Valor condicionado','Venda isolada da participação','Salvar revisão documentada','Salvar como referência atual','Histórico desta alternativa','Desempenho registrado','Origem da informação'])assert.ok(html.includes(label),label);
  assert.match(html,/1\.000\.000,00/);assert.match(html,/500\.000,00/);assert.match(html,/sem liberar automaticamente/);
  assert.match(html,/type="file"/);assert.match(html,/até 750 KB/);assert.match(html,/disabled=""/);assert.match(html,/grid gap-4 sm:grid-cols-2/);
  const read=renderToStaticMarkup(React.createElement(components({state:[input,row,row.casoId]}).BuiltValuationWorkbench,{id:'own',canManage:false}));
  assert.doesNotMatch(read,/Nova análise|Calcular e salvar análise|Salvar revisão documentada|Salvar como referência/);assert.match(read,/fieldset disabled/);
});
test('todos os métodos renderizam campos próprios e o formulário conserva erro e carregamento',()=>{
  const c=components();
  for(const [metodo] of built.BUILT_METHODS){
    const code=readFileSync(new URL('./built-valuation-workbench.tsx',import.meta.url),'utf8');
    assert.ok(code.includes(metodo));
    const raw:any=metodo==='renda'?input.calculo:metodo==='custo'?{metodo,terreno:fact(0),reposicao:fact(1),depreciacaoFisica:fact(0),depreciacaoFuncional:fact(0),depreciacaoExterna:fact(0)}:metodo==='documental'?{metodo,valor:fact(10),natureza:'fiscal'}:metodo==='comparativo'?{metodo,area:fact(10),unidadeArea:'terreno_m2',comparaveis:[]}:{metodo,taxaDesconto:fact(10),margemEmpreendedor:fact(20),fluxos:[]};
    const html=renderToStaticMarkup(React.createElement(c.CalculationFields,{value:raw,onChange:()=>{}}));assert.match(html,/<select/);
  }
  assert.match(renderToStaticMarkup(React.createElement(components({query:{isError:true}}).BuiltValuationWorkbench,{id:'own',canManage:true})),/Tentar novamente/);
  assert.match(renderToStaticMarkup(React.createElement(components({query:{isLoading:true}}).BuiltValuationWorkbench,{id:'own',canManage:true})),/role="status"/);
  const source=readFileSync(new URL('./property-valuation.tsx',import.meta.url),'utf8');assert.match(source,/<BuiltValuationWorkbench id=\{id\} canManage=\{canManage\}/);
});
