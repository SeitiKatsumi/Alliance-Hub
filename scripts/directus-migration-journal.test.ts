import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const journal = readFileSync(new URL('./directus-migration-journal.sql', import.meta.url), 'utf8');

test('diário preserva versões, exclusões e transações sem registrar rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE SCHEMA built_legacy;
      CREATE TABLE built_legacy.cadastro_geral(id text PRIMARY KEY, nome text);
      CREATE TABLE public.test_flow(id integer PRIMARY KEY, valor numeric);
      INSERT INTO built_legacy.cadastro_geral VALUES ('existing', 'Original');`);
    await db.exec(journal);
    await db.exec(`BEGIN;
      UPDATE built_legacy.cadastro_geral SET nome='Novo' WHERE id='existing';
      INSERT INTO test_flow VALUES(1,12.34);
      COMMIT;
      BEGIN; UPDATE test_flow SET valor=99; ROLLBACK;
      DELETE FROM built_legacy.cadastro_geral WHERE id='existing';`);
    const {rows} = await db.query<any>('SELECT * FROM built_migration.changes ORDER BY id');
    assert.equal(rows.length, 3);
    assert.equal(rows[0].before_row.nome, 'Original');
    assert.equal(rows[0].after_row.nome, 'Novo');
    assert.equal(rows[0].transaction_id, rows[1].transaction_id);
    assert.equal(rows[1].after_row.valor, 12.34);
    assert.equal(rows[2].operation, 'DELETE');
    assert.equal(rows[2].before_row.nome, 'Novo');
    assert.equal(rows[2].after_row, null);
    await assert.rejects(db.exec('DELETE FROM built_migration.changes'), /explicit recovery/);
    await assert.rejects(db.exec('TRUNCATE test_flow'), /explicit recovery/);
    assert.equal((await db.query('SELECT * FROM test_flow')).rows.length, 1);
    // Prove before-images can recover a removed row and a previous value in the clone.
    await db.query('INSERT INTO built_legacy.cadastro_geral SELECT * FROM jsonb_populate_record(NULL::built_legacy.cadastro_geral,$1::jsonb)', [JSON.stringify(rows[2].before_row)]);
    await db.query('UPDATE built_legacy.cadastro_geral SET nome=$1 WHERE id=$2', [rows[0].before_row.nome, rows[0].before_row.id]);
    assert.deepEqual((await db.query('SELECT * FROM built_legacy.cadastro_geral')).rows, [{id:'existing',nome:'Original'}]);
  } finally { await db.close(); }
});

test('diário é transacional, privado e não reaplica instalação sobre existente', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE public.fixture (id int PRIMARY KEY);');
    await db.exec(journal);
    await assert.rejects(db.exec(journal), /already exists/);
    await db.exec('ROLLBACK');
    await db.exec(`CREATE ROLE fixture_writer;
      GRANT USAGE ON SCHEMA public TO fixture_writer;
      GRANT INSERT ON fixture TO fixture_writer;
      SET ROLE fixture_writer;
      INSERT INTO fixture VALUES (1);`);
    await assert.rejects(db.query('SELECT * FROM built_migration.changes'), /permission denied/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM built_migration.changes')).rows.length, 1);
  } finally { await db.close(); }
});

test('consolidação lê somente backup verificado e não altera fonte nem inicia app', () => {
  const source = readFileSync(new URL('./directus-migration-consolidate.py',import.meta.url),'utf8');
  assert.match(source, /--consolidate-offline/);
  assert.match(source, /backup\.digest\(path\) != entry\['sha256'\]/);
  assert.match(source, /actual != expected/);
  assert.match(source, /'--network', 'none'/);
  assert.match(source, /consolidated-offline-runtime-pending/);
  assert.doesNotMatch(source, /srv-captain|DATABASE_URL|docker', '(?:rm|restart)'|\b(?:unlink|rmtree)\b/);
});
