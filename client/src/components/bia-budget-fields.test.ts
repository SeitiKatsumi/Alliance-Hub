import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import ts from 'typescript';
import * as budget from '../../../shared/bia-budget';
import {emptyBiaSetup} from '../../../shared/bia-setup';
const source=readFileSync(new URL('./bia-budget-fields.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('budget.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)).map(n=>n.getText(ast).replace('export function','function')).join('\n');
const dialog=({children}:any)=>React.createElement(React.Fragment,null,children);
const scope={React,...budget,AlertDialog:dialog,AlertDialogTrigger:dialog,AlertDialogContent:dialog,AlertDialogHeader:dialog,AlertDialogTitle:dialog,AlertDialogDescription:dialog,AlertDialogFooter:dialog,AlertDialogCancel:'button',AlertDialogAction:'button',Input:'input',Button:'button',css:'',card:'',uid:()=>String(Math.random()),amount:(n:number)=>Number.isFinite(n)?n:null,BiaNumberInput:({label,value,onChange}:any)=>React.createElement('input',{'aria-label':label,value:Number.isFinite(value)?value:'',onChange})};
const {BiaBudgetFields,BiaBudgetSummary}=new Function(...Object.keys(scope),transformSync(functions,{loader:'tsx'}).code+';return {BiaBudgetFields,BiaBudgetSummary};')(...Object.values(scope));
function nodes(node:any):any[]{if(!node || typeof node!=='object')return [];return Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];}

test('campo de meses não limita nem recorta prazos maiores que 120',()=>{
  let value=emptyBiaSetup();
  const render=()=>BiaBudgetFields({value,moeda:'BRL',onChange:(v:any)=>{value=v;}});
  for(const meses of [220,360,1200,10001]){
    const input=nodes(render()).find(n=>n.type==='input'&&n.props.type==='number');
    assert.equal(input.props.max,undefined);assert.equal(input.props.min,1);assert.equal(input.props.step,1);
    input.props.onChange({target:{value:String(meses)}});
    assert.equal(value.orcamento?.meses,meses);assert.equal(budget.biaBudgetSchema.parse(value.orcamento).meses,meses);
  }
  for(const details of [true,false])assert.match(renderToStaticMarkup(BiaBudgetSummary({value,moeda:'BRL',details})),/Prazo preservado/);
});

test('remoção exige confirmação na tela, preserva outros itens e permite remover o último pagamento',()=>{
  let value=emptyBiaSetup(),writes=0;
  const render=(disabled=false)=>BiaBudgetFields({value,moeda:'BRL',disabled,onChange:(v:any)=>{value=v;writes++;}});
  const buttons=(tree:any,label:string)=>nodes(tree).filter(n=>n.type==='button'&&n.props.children===label);
  for(const label of ['Adicionar investimento','Adicionar investimento','Adicionar despesa'])buttons(render(),label)[0].props.onClick();
  value.orcamento!.fontes.push({id:'fonte-legada',descricao:'Recurso preservado',tipo:'Aporte',valor:100,mes:'2026-10',situacao:'Estimada',destinacao:'Livre',observacoes:'Dado anterior'});
  for(let i=0;i<2;i++)buttons(render(),'Adicionar pagamento')[0].props.onClick();
  const original=structuredClone(value),before=writes;
  const tree=render();
  assert.equal(buttons(tree,'Cancelar')[0].props.onClick,undefined);
  assert.equal(writes,before,'abrir/cancelar não altera o orçamento');
  assert.doesNotMatch(source,/window\.confirm/,'não depende de confirmação nativa do navegador');
  buttons(tree,'Confirmar remoção')[1].props.onClick();
  assert.deepEqual(value.orcamento!.capex[0].pagamentos,[original.orcamento!.capex[0].pagamentos[0],original.orcamento!.capex[0].pagamentos[2]]);
  assert.deepEqual(value.orcamento!.capex[1],original.orcamento!.capex[1]);
  assert.deepEqual(value.orcamento!.opex,original.orcamento!.opex);assert.deepEqual(value.orcamento!.fontes,original.orcamento!.fontes);
  const current=structuredClone(value);
  for(const action of buttons(render(true),'Confirmar remoção')){assert.equal(action.props.disabled,true);action.props.onClick();}
  assert.deepEqual(value,current,'confirmação fora do fieldset também respeita consulta/bloqueio');
  buttons(render(),'Confirmar remoção')[0].props.onClick();buttons(render(),'Confirmar remoção')[0].props.onClick();
  assert.deepEqual(value.orcamento!.capex[0].pagamentos,[]);assert.equal(value.orcamento!.capex.length,2);
  assert.doesNotThrow(()=>budget.biaBudgetSchema.parse(value.orcamento));
  buttons(render(),'Confirmar remoção')[0].props.onClick();assert.deepEqual(value.orcamento!.capex,[original.orcamento!.capex[1]]);
  buttons(render(),'Confirmar remoção')[2].props.onClick();assert.deepEqual(value.orcamento!.opex,[]);
  assert.deepEqual(value.orcamento!.fontes,original.orcamento!.fontes,'remoções de CAPEX/OPEX não apagam fontes legadas');
  assert.doesNotMatch(renderToStaticMarkup(render()),/Adicionar origem|Remover origem|3\. Origem dos recursos|Recurso preservado/);
});

test('orçamento abre diretamente, só altera dados ao editar e preserva consulta sem escrita',()=>{
  let value=emptyBiaSetup(),writes=0;
  const render=(disabled=false)=>BiaBudgetFields({value,moeda:'BRL',disabled,onChange:(v:any)=>{value=v;writes++;}});
  const before=structuredClone(value);render();assert.equal(writes,0);assert.deepEqual(value,before);
  const initial=renderToStaticMarkup(render());
  assert.doesNotMatch(initial,/Adicionar orçamento/);assert.match(initial,/Mês inicial/);assert.match(initial,/Adicionar investimento/);assert.match(initial,/Adicionar despesa/);
  assert.equal(value.orcamento,undefined);render(true);assert.equal(writes,0);
  for(const label of ['Adicionar investimento','Adicionar despesa'])nodes(render()).find(n=>n.type==='button'&&n.props.children===label).props.onClick();
  assert.equal(value.orcamento?.meses,12);assert.equal(value.orcamento?.moeda,'BRL');
  assert.equal(value.orcamento!.capex[0].pagamentos.length,1);assert.equal(value.orcamento!.opex[0].valorMensal,null);
  assert.deepEqual(value.orcamento!.fontes,[]);
  const snapshot=structuredClone(value),html=renderToStaticMarkup(render(true));assert.match(html,/<fieldset disabled=""/);assert.deepEqual(value,snapshot);
  assert.match(html,/Salvar|Pagamentos previstos/);assert.doesNotMatch(html,/Origem dos recursos|Adicionar origem|Remover origem/);
  const editable=renderToStaticMarkup(render());
  assert.match(editable,/Preenchimento opcional/);
  assert.doesNotMatch(editable,/Pendências e avisos|Informe o mês inicial do planejamento|OPEX não informado/);
  assert.doesNotThrow(()=>budget.biaBudgetSchema.parse(value.orcamento),'linhas incompletas continuam válidas para salvar');
  assert.match(renderToStaticMarkup(BiaBudgetSummary({value,moeda:'BRL'})),/Pendências e avisos/,'relatório detalhado preserva ressalvas sobre a projeção');
  const stored=structuredClone(value);render();assert.deepEqual(value,stored,'abrir não substitui orçamento existente');
  const lists=nodes(render()).filter(n=>n.type==='ul');
  assert.deepEqual(lists.map(n=>n.props['aria-label']),['Investimentos CAPEX','Despesas OPEX']);
  for(const list of lists){
    const rows=nodes(list).filter(n=>n.type==='li');assert.equal(rows.length,1);
    const details=nodes(rows[0]).find(n=>n.type==='details');assert.equal(details.props.open,undefined,'detalhes recolhidos por padrão');
    assert.ok(nodes(rows[0]).some(n=>n.type==='input'&&n.props.placeholder));
  }
  nodes(lists[0]).find(n=>n.type==='input'&&n.props.placeholder).props.onChange({target:{value:'Investimento revisado'}});
  assert.equal(value.orcamento!.capex[0].descricao,'Investimento revisado');
  assert.deepEqual({...value.orcamento!.capex[0],descricao:stored.orcamento!.capex[0].descricao},stored.orcamento!.capex[0]);
  assert.deepEqual(value.orcamento!.opex,stored.orcamento!.opex);
  value=emptyBiaSetup();nodes(render()).find(n=>n.type==='input'&&n.props.type==='month').props.onChange({target:{value:'2026-11'}});
  assert.equal(value.orcamento?.inicio,'2026-11');assert.deepEqual(value.orcamento?.capex,[]);
});
test('resumo para tela/PDF escapa texto, mantém ausência, moeda e seções sem efeitos financeiros',()=>{
  const value=emptyBiaSetup();value.orcamento=budget.emptyBiaBudget('BRL');value.orcamento.capex.push({id:'a',descricao:'<script>privado</script>',valor:1,situacao:'Estimativa',ativoId:'',ativoNome:'',pagamentos:[]});
  const html=renderToStaticMarkup(BiaBudgetSummary({value,moeda:'USD',valorOrigem:NaN}));
  assert.match(html,/data-pdf-section="orcamento"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|NaN/);assert.match(html,/Não há conversão automática/);
  const creation=readFileSync(new URL('../pages/bia-nova.tsx',import.meta.url),'utf8');
  assert.match(creation,/step===5 && <BiaBudgetFields/);assert.match(creation,/step===6 && <BiaPdfDialog/);assert.match(creation,/step<7/);
  assert.match(creation,/label:"CAPEX e OPEX",errors:\[\],optional:true/);
  assert.match(creation,/Opcional — pode preencher depois/);
  const saveButton=creation.slice(creation.indexOf('onClick={()=>save(true)}')-280,creation.indexOf('onClick={()=>save(true)}'));
  assert.doesNotMatch(saveButton,/budgetPreview|orcamento/,'avisos do orçamento não bloqueiam ativação');
  const edit=readFileSync(new URL('../pages/bias.tsx',import.meta.url),'utf8');assert.match(edit,/"ativos", "orcamento", "revisao"/);
  const pdf=readFileSync(new URL('../lib/print-bia-summary.ts',import.meta.url),'utf8');assert.match(pdf,/id:"orcamento",label:"CAPEX e OPEX"/);assert.match(pdf,/\[data-pdf-section="orcamento"\] table \{ break-inside: auto/);
  const api=readFileSync(new URL('../../../server/bia-setup.ts',import.meta.url),'utf8');assert.match(api,/'configuracao_bia','edit'/);assert.match(api,/parseBiaSetup\(req.body\?\.dados,current.dados\)/);
});
