import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interfaceCopy,translateInterface} from './interface-language';
import europeanPortuguese from './interface-catalog-pt-pt.json';
import { interfaceText } from './interface-locale-runtime';
test('Português de Portugal mantém o texto comum e os dados interpolados, com vocabulário e formatação próprios',()=>{
  assert.equal(translateInterface('Salvar preferências','pt-PT'),'Guardar preferências');
  assert.equal(translateInterface('Alterar senha','pt-PT'),'Alterar palavra-passe');
  assert.equal(translateInterface('Salvar preferências','pt-BR'),'Salvar preferências');
  assert.equal(translateInterface('Gestão Financeira','pt-PT'),'Gestão Financeira');
  assert.equal(translateInterface('Nome do usuário sem chave de tradução','pt-PT'),'Nome do usuário sem chave de tradução');
  assert.equal(interfaceText('pt-PT').locale,'pt-PT');
  for(const [source,target] of Object.entries(europeanPortuguese)) {
    assert.deepEqual(source.match(/\{\d+\}/g),target.match(/\{\d+\}/g));
    assert.equal(translateInterface(source,'pt-PT'),target);
  }
});
test('curated interface languages preserve data, fallback and every translated key',()=>{
  for(const [source,pair] of Object.entries(interfaceCopy)){
    assert.equal(pair.length,2);assert.ok(pair.every(text=>text.trim().length>0));
    assert.equal(translateInterface(source,'pt-BR'),source);
    assert.equal(translateInterface(source,'en'),pair[0]);
    assert.equal(translateInterface(source,'es'),pair[1]);
  }
  assert.equal(translateInterface('Nome de pessoa ou documento original','en'),'Nome de pessoa ou documento original');
  for(const file of ['../components/platform-preferences.tsx','../components/appearance-settings.tsx']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    for(const match of source.matchAll(/t\('([^']+)'\)/g)) assert.ok(interfaceCopy[match[1]],`Missing translation: ${match[1]}`);
  }
});

test('official taxonomies have translations; custom language entries, codes and source labels survive', async () => {
  const {taxonomyTerms,taxonomyLabel,canonicalProfileLanguage} = await import('./interface-taxonomy');
  const catalog = JSON.parse(readFileSync(new URL('./interface-catalog.json',import.meta.url),'utf8'));
  for(const key of taxonomyTerms) {
    assert.ok(catalog[key]?.every((s: string)=>s.trim()), key);
  }
  const en = (s: string) => taxonomyLabel(s,'en');
  assert.equal(en('Projetos de arquitetura'),'Architectural design');
  assert.equal(en('Desenvolver imóveis para venda (Inclui o caso de construir uma casa para vender)'),'Develop properties for sale (including building a house to sell)');
  assert.equal(taxonomyLabel('Liderança Técnica','es'),'Liderazgo técnico');
  assert.equal(canonicalProfileLanguage('English',en),'Inglês');
  assert.equal(canonicalProfileLanguage('Língua da comunidade',en),'Língua da comunidade');
  assert.equal(en('Minha empresa'),'Minha empresa');
});

test('brand names, BIA steps and computed Aura labels follow the language contract',()=>{
  for(const language of ['en','es','pt-PT','pt-BR'] as const) assert.equal(translateInterface('Asaas',language),'Asaas');
  for(const [source,english] of [['Curto prazo','Short term'],['Técnica e liderança','Technical expertise and leadership'],['Baixa','Low'],['Convite para Diretor de Aliança','Invitation to become an alliance director']]) {
    assert.equal(translateInterface(source,'en'),english);
  }
  assert.equal(translateInterface('Aguardar novas avaliações antes de recomendar uma aplicabilidade predominante por núcleo.','en').includes('Aguardar'),false);
});
