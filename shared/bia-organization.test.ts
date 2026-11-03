import test from 'node:test';
import assert from 'node:assert/strict';
import { biaOrganization } from './bia-organization';

test('organograma mantém os cargos reais, papéis simultâneos e quatro núcleos', () => {
  const chart = biaOrganization({diretor_alianca:'a', aliado_built:{id:'a'}, autor_bia:'b', diretor_nucleo_tecnico:{cadastro_geral_id:'c'}, diretor_execucao:'d', diretor_comercial:'e', diretor_capital:'f', socios_guardioes:'["a","c"]', socios_multiplicadores:['a','f','g','g'], terceiros:'h,h'});
  assert.equal(chart.director?.id, 'a');
  assert.equal(chart.advisor?.id, 'a');
  assert.equal(chart.director?.guardian, true);
  assert.equal(chart.director?.multiplier, true);
  assert.equal(chart.author?.id, 'b');
  assert.deepEqual(chart.branches.map(b=>b.person?.id), ['c','d','e','f']);
  assert.deepEqual(chart.participants.map(p=>p.id), ['g','h']);
  assert.equal(chart.branches[3].person?.multiplier, true);
});

test('cargos vazios não recebem participantes pela profissão nem condições presumidas', () => {
  const chart = biaOrganization({diretor_alianca:'a', aliado_built:'b', diretor_execucao:'', socios_guardioes:['engenheiro'], nucleos_alianca:['engenheiro']});
  assert.equal(chart.director?.guardian, false);
  assert.equal(chart.advisor?.multiplier, false);
  assert.equal(chart.branches.length, 4);
  assert.ok(chart.branches.every(b=>b.person===null));
  assert.deepEqual(chart.participants.map(p=>p.id), ['engenheiro']);
  assert.ok(chart.branches.every(b=>b.members.length===0));
});

test('agrupa somente participantes da BIA pelas contribuições oficiais, sem inferir pela profissão', () => {
  const chart=biaOrganization({diretor_nucleo_tecnico:'d',socios_guardioes:['a'],socios_multiplicadores:['b','c']},[
    {id:'d',segmento:'Projetos de arquitetura',tipos_alianca:['Alianças de Projeto']},
    {id:'a',segmento:'Arquitetura de interiores',ramo_atuacao:'Arquitetura',tipos_alianca:['Alianças de Projeto']},
    {id:'b',ramo_atuacao:'Advogado'},
    {id:'c',segmento:'Investimentos',tipos_alianca:['Alianças de Aporte Financeiro','Alianças de Projeto']},
    {id:'fora',tipos_alianca:['Alianças de Projeto']},
  ]);
  assert.deepEqual(chart.branches[0].members.map(p=>p.id),['a','c']);
  assert.deepEqual(chart.branches[3].members.map(p=>p.id),['c']);
  assert.deepEqual(chart.participants.map(p=>p.id),['b']);
  assert.deepEqual(chart.branches[0].person?.activity,[]);
  assert.deepEqual(chart.branches[0].members[0].activity,['Arquitetura de interiores','Arquitetura']);
  assert.equal(chart.branches[0].members[0].guardian,true);
  assert.equal(chart.branches[0].person?.guardian,false);
});

test('seleção moderna vazia não recupera área antiga; legado e JSON continuam legíveis', () => {
  const chart=biaOrganization({socios_multiplicadores:['a','b','c','d']},[
    {id:'a',tipos_alianca:[],tipo_alianca:'Alianças de Projeto',nucleos_alianca:['Núcleo Técnico']},
    {id:'b',tipos_alianca:'["Alianças de Fornecimento"]'},
    {id:'c',nucleos_alianca:'["Núcleo de Capital"]'},
    {id:'d',nucleos_alianca:[],nucleo_alianca:'Núcleo Técnico'},
  ]);
  assert.deepEqual(chart.branches[0].members,[]);
  assert.deepEqual(chart.branches[1].members.map(p=>p.id),['b']);
  assert.deepEqual(chart.branches[3].members.map(p=>p.id),['c']);
  assert.deepEqual(chart.participants.map(p=>p.id),['a','d']);
});

test('diretores com vários cargos não viram subordinados nem mostram ramo em outros cargos', () => {
  const chart=biaOrganization({diretor_alianca:'a',diretor_comercial:'a',aliado_built:'a',autor_bia:'a',socios_guardioes:['a'],socios_multiplicadores:['a']},[
    {id:'a',segmento:'Vendas',tipos_alianca:['Alianças de Vendas e Locação']},
  ]);
  assert.deepEqual(chart.director?.activity,[]);
  assert.deepEqual(chart.advisor?.activity,[]);
  assert.deepEqual(chart.branches.flatMap(b=>b.members),[]);
  assert.deepEqual(chart.participants,[]);
  assert.equal(chart.director?.guardian,true);
  assert.equal(chart.director?.multiplier,true);
});

test('modelo é somente leitura e não concede acessos ou altera o cadastro', () => {
  const bia=Object.freeze({socios_guardioes:Object.freeze(['a']), terceiros:'b'});
  const chart=biaOrganization(bia);
  assert.equal(chart.director,null);
  assert.deepEqual(chart.participants.map(p=>p.id),['a','b']);
  assert.deepEqual(bia,{socios_guardioes:['a'],terceiros:'b'});
});
