import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inventorySource,inventory} from './directus-migration-inventory';

test('inventário registra dependências sem copiar conteúdo sensível',()=>{
  const result=inventorySource('server/example.ts', `directusFetch("cadastro_geral");\nfetch(DIRECTUS_URL+'/files');\nconst token = 'private-example';\nfetch('/items/fluxo_caixa');`);
  assert.deepEqual(result.literalCollections,['cadastro_geral','fluxo_caixa']);
  assert.equal(result.references[1].kind,'files');
  assert.doesNotMatch(JSON.stringify(result),/private-example/);
  const all=inventory(process.cwd());
  assert.ok(all.collections.includes('cadastro_geral'));
  assert.ok(all.collections.includes('fluxo_caixa'));
  assert.equal(all.cutoverReady,false);
});

test('ensaio de backup é explícito, isolado e não apaga fontes ou cópias',()=>{
  const source=readFileSync(new URL('./directus-migration-backup.py',import.meta.url),'utf8');
  assert.match(source,/default_transaction_read_only=on/);
  assert.match(source,/--backup-and-rehearse/);
  assert.match(source,/'--network', 'none'/);
  assert.match(source,/exist_ok=False/);
  assert.match(source,/--single-transaction/);
  assert.match(source,/manual-only-no-expiry/);
  assert.doesNotMatch(source,/\b(?:rmtree|unlink|DROP DATABASE|TRUNCATE)\b|docker', '(?:rm|volume|system)'/);
  const startup=readFileSync(new URL('../start.sh',import.meta.url),'utf8');
  assert.doesNotMatch(startup,/directus-migration/);
});
