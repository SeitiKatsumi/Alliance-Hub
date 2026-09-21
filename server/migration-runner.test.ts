import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";

test("executor de produção aplica MAP/aportes em ordem, preserva blocos SQL e rollback", async () => {
  const pg = new PGlite();
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = ["20260918_initial_contributions.sql", "20260918_initial_map.sql", "20260918_map_zero_versions.sql", "9999_drizzle.sql"];
  const executed: string[] = [];
  const client = {
    query: async (sql: string, params?: any[]) => params ? pg.query(sql, params) : (await pg.exec(sql)).at(-1),
    release() {},
  };
  const mockRequire = Object.assign((name: string) => {
    if (name === "pg") return { Pool: class { async connect() { return client; } async end() {} } };
    if (name === "path") return path;
    if (name === "fs/promises") return {
      readdir: async () => [...files],
      readFile: async (file: string) => {
        const name = path.basename(file);
        executed.push(name);
        if (name === "9999_drizzle.sql") return "CREATE TABLE migration_fixture (text_value text);\n--> statement-breakpoint\nINSERT INTO migration_fixture VALUES ('semi;colon'), ('it''s valid'); -- comment;\n";
        if (name === "9999_failure.sql") return "CREATE TABLE rollback_fixture (id int); DO $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$;";
        return readFile(file, "utf8");
      },
    };
    throw new Error(`Unexpected require: ${name}`);
  }, { main: null });
  try {
    await pg.exec(`CREATE TABLE bia_imovel_origens (id uuid PRIMARY KEY);
      CREATE TABLE bia_mou_aceites (bia_id text, membro_id text, mou_versao text,
      UNIQUE (bia_id, membro_id, mou_versao));`);
    const main = runInNewContext(await readFile(path.join(root, "migrate.cjs"), "utf8") + "\nmodule.exports.main;", {
      require: mockRequire, module: { exports: {} }, __dirname: root,
      process: { env: { DATABASE_URL: "isolated-test" } }, console: { log() {} },
    });
    await main();
    assert.deepEqual(executed, [files[1], files[0], files[2], files[3]]);
    assert.equal((await pg.query("SELECT * FROM migration_fixture")).rows.length, 2);
    assert.equal((await pg.query("SELECT * FROM __drizzle_migrations")).rows.length, 4);
    await main();
    assert.equal(executed.length, 4, "repetição não reaplica migrações");
    assert.equal((await pg.query("SELECT * FROM migration_fixture")).rows.length, 2);
    files.push("9999_failure.sql");
    await assert.rejects(main(), /fixture failure/);
    assert.equal((await pg.query("SELECT to_regclass('rollback_fixture') AS name")).rows[0].name, null);
    assert.equal((await pg.query("SELECT * FROM __drizzle_migrations")).rows.length, 4);
  } finally { await pg.close(); }
});
