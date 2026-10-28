import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildInitialOnboardingProfileFields} from './initial-onboarding';

test('segmentos múltiplos não são cortados nem confundidos com telefone',()=>{
  const segmento='Consultoria e serviços financeiros; '.repeat(20).trim();
  const fields=buildInitialOnboardingProfileFields({telefone:'+351 912 345 678'}, {segmento});
  assert.ok(segmento.length>255);
  assert.equal(fields.segmento,segmento);
  assert.equal(fields.telefone,'+351912345678');
  const sql=readFileSync(new URL('../scripts/directus-segmento-text.sql',import.meta.url),'utf8');
  assert.match(sql,/ALTER TABLE public\.cadastro_geral ALTER COLUMN segmento TYPE text/);
  assert.match(sql,/current_database\(\) <> 'appbuiltalliances_directus'/);
  assert.doesNotMatch(sql,/\b(?:DELETE|TRUNCATE|DROP)\b/i);
});
