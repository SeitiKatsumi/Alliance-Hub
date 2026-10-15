import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {transformSync} from 'esbuild';
import {calculateInitialMap, type InitialMapParticipantInput} from '../../../shared/member-portfolio';
import {validateInitialClassifications} from '../../../shared/initial-contributions';
import {formatBiaPercent} from '../../../shared/bia-numbers';
import {BIA_PARTICIPANT_ROLE_LABELS} from '../../../shared/bia-access';

const source=readFileSync(new URL('./bia-role-composition.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('fields.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='BiaExistingCompositionFields')!.getText(ast).replace('export function','function');
const numberInput=({label,value,onChange,disabled}:any)=>React.createElement('input',{'aria-label':label,value:Number.isFinite(value)?value:'',disabled,onChange});
const types=[{id:'capital',Nome:'Capital'},{id:'origem',Nome:'Origem'}];
function fixture(byValue=true,byRole=false,overrides:any={}) {
  const participant:InitialMapParticipantInput={participantId:'member:a',memberId:'a',nome:'Sócio Exemplo',tipo:'guardiao',cargos:['Autor da Oportunidade','Aliado BUILT'],indiceContribuicao:0,pesoCapital:100,
    ...(byValue?{capitalComprometido:12345.67891,naturezaCapital:'caixa' as const,tipoCppCapital:{id:'capital',nome:'Capital'}}:{}),
    ...(byRole?{modeloCalculo:4 as const,contribuicoes:[{cargo:'Autor da Oportunidade',indice:0},{cargo:'Aliado BUILT',indice:2,tipoCpp:{id:'origem',nome:'Origem'}}]}:{})};
  let participants=structuredClone(overrides.participants || [participant]);
  let writes=0;
  const query={data:types,isPending:false,isError:false,refetch:()=>{},...overrides.query};
  const scope={React,useQuery:()=>query,Input:'input',Button:'button',BiaNumberInput:numberInput,formatBiaPercent,roles:Object.values(BIA_PARTICIPANT_ROLE_LABELS),window:{confirm:()=>true}};
  const Field=new Function(...Object.keys(scope),transformSync(fn,{loader:'tsx'}).code+';return BiaExistingCompositionFields;')(...Object.values(scope));
  function render() {
    let preview:any;
    try {const calculation=calculateInitialMap(12345.67891,participants);if(byValue)validateInitialClassifications(calculation.participantes);preview={calculation,error:null};}
    catch(error:any){preview={calculation:null,error:error.message};}
    return Field({participants,onChange:(next:any)=>{writes++;participants=next;},members:[{id:'a',nome:'Sócio Exemplo'}],valorOrigem:12345.67891,onValueChange:()=>{},byValue,byRole,preview,...overrides});
  }
  return {render,get participants(){return participants;},get writes(){return writes;}};
}
function elements(node:any):any[]{if(!node || typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(elements);return [node,...elements(node.props?.children)];}

test('abrir modelos por peso, aporte e função não altera IDs, classificações, índices ou precisão',()=>{
  for(const [byValue,byRole] of [[false,false],[true,false],[true,true]]){
    const f=fixture(byValue,byRole),before=structuredClone(f.participants),calculation=calculateInitialMap(12345.67891,before);
    const html=renderToStaticMarkup(f.render());f.render();
    assert.equal(f.writes,0);assert.deepEqual(f.participants,before);assert.deepEqual(calculateInitialMap(12345.67891,f.participants),calculation);
    for(const text of ['Dados econômicos','Participantes e aportes','Governança e Divisor Multiplicador','Resumo da Base Econômica Inicial'])assert.ok(html.includes(text));
    assert.doesNotMatch(html,/Total de CIs|Forma de capitalização|Quantidade de parcelas/);
    assert.equal((html.match(/Sócio Aliado<select/g)||[]).length,1);
    assert.ok(html.includes(byRole?'DM da função (%)':'DM da pessoa (%)'));
    assert.ok(!html.includes('<details open=""'),'composição completa inicia recolhida');
  }
});

test('funções legadas não dividem DM e edição de índice não toca capital ou classificações',()=>{
  const f=fixture(),before=structuredClone(f.participants[0]);
  let nodes=elements(f.render());
  nodes.find(n=>n.type==='input'&&n.props.placeholder)?.props.onChange({target:{value:'Aliado BUILT,'}});
  assert.equal(elements(f.render()).find(n=>n.type==='input'&&n.props.placeholder).props.value,'Aliado BUILT,');
  nodes.find(n=>n.type==='input'&&n.props.placeholder)?.props.onChange({target:{value:'Aliado BUILT, Diretor de Aliança'}});
  assert.equal(f.participants[0].indiceContribuicao,0);
  nodes=elements(f.render());nodes.find(n=>n.props?.label==='DM da pessoa — Sócio Exemplo').props.onChange(1.12345);
  assert.equal(f.participants[0].indiceContribuicao,1.12345);
  assert.equal(f.participants[0].capitalComprometido,before.capitalComprometido);
  assert.deepEqual(f.participants[0].tipoCppCapital,before.tipoCppCapital);assert.equal(f.participants[0].contribuicoes,undefined);
});

test('modelo por função altera somente o índice escolhido e mantém o zero explícito',()=>{
  const f=fixture(true,true),before=structuredClone(f.participants[0]);
  elements(f.render()).find(n=>n.props?.label==='DM — Sócio Exemplo — Aliado BUILT').props.onChange(3.12345);
  assert.equal(f.participants[0].contribuicoes![0].indice,0);assert.equal(f.participants[0].contribuicoes![1].indice,3.12345);
  assert.deepEqual(f.participants[0].contribuicoes![1].tipoCpp,before.contribuicoes![1].tipoCpp);
  assert.equal(f.participants[0].capitalComprometido,before.capitalComprometido);
});

test('substituição confirmada preserva o comportamento próprio de cada modelo',()=>{
  for(const byRole of [false,true]){
    const f=fixture(true,byRole),before=structuredClone(f.participants[0]);
    elements(f.render()).find(n=>n.type==='select'&&n.props.value==='a').props.onChange({target:{value:'b'}});
    assert.equal(f.participants[0].memberId,'b');
    assert.deepEqual(f.participants[0].cargos,before.cargos);
    if(byRole){assert.ok(Number.isNaN(f.participants[0].capitalComprometido));assert.equal(f.participants[0].tipoCppCapital,undefined);assert.ok(f.participants[0].contribuicoes!.every(c=>Number.isNaN(c.indice)&&!c.tipoCpp));}
    else {assert.equal(f.participants[0].capitalComprometido,before.capitalComprometido);assert.deepEqual(f.participants[0].tipoCppCapital,before.tipoCppCapital);assert.equal(f.participants[0].indiceContribuicao,before.indiceContribuicao);}
  }
});

test('ausência não é zero; classificação pendente abre detalhes e falha do catálogo preserva registro',()=>{
  const f=fixture();const p={...f.participants[0],indiceContribuicao:NaN,tipoCppCapital:undefined};
  const html=renderToStaticMarkup(fixture(true,false,{participants:[p]}).render());
  assert.match(html,/<details[^>]*open=""/);assert.match(html,/Pendente/);assert.doesNotMatch(html,/0,00000%|R\$\s*0,00/);
  const unavailable=fixture(true,false,{query:{data:undefined,isError:true}});const before=structuredClone(unavailable.participants);
  const errorHtml=renderToStaticMarkup(unavailable.render());assert.match(errorHtml,/Tentar novamente/);assert.match(errorHtml,/Capital \(registrado\)/);assert.deepEqual(unavailable.participants,before);assert.equal(unavailable.writes,0);
});

test('consulta desabilita o formulário e os caminhos compartilham apresentação sem mudar API de salvamento',()=>{
  assert.match(renderToStaticMarkup(fixture(true,false,{readOnly:true}).render()),/^<fieldset disabled=""/);
  const calculator=readFileSync(new URL('../pages/bias-calculadora.tsx',import.meta.url),'utf8');
  const edit=readFileSync(new URL('../pages/bias.tsx',import.meta.url),'utf8');
  assert.match(calculator,/if \(!creationTeam\) return <BiaExistingCompositionFields/);
  assert.match(calculator,/snapshot.modeloCalculo === 5 \? <BiaEconomicStructureFields[^\n]+: <BiaExistingCompositionFields/);
  assert.match(calculator,/mode === "dm" \? "Salvar DM" : "Salvar revisão da BEI"/);
  assert.match(calculator,/revisaoEsperada: base.revisao/);assert.match(calculator,/snapshot.historicoLegado \? "map-zero-legado" : "map-inicial"/);
  assert.match(calculator,/setEstrutura\(snapshot.estrutura\);[^\n]+setReviewed\(false\)/);
  assert.match(edit,/<BiaMapZero biaId=\{bia.id\} readOnly=\{readOnly\}/);
});
