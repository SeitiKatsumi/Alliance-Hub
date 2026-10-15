import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interfaceCopy,translateInterface} from './interface-language';
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
