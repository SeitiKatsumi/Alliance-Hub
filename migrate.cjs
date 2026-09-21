/* eslint-disable @typescript-eslint/no-var-requires */
const { Pool } = require("pg");
const { readdir, readFile } = require("fs/promises");
const path = require("path");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não definida");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at BIGINT
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    let files;
    try {
      files = await readdir(migrationsDir);
    } catch {
      console.log("[migrate] Pasta migrations/ não encontrada — nenhuma migration aplicada.");
      return;
    }

    // A base do MAP precisa existir antes dos aportes, inclusive em banco novo.
    const orderName = file => file === "20260918_initial_map.sql" ? "20260918_0_initial_map.sql" : file;
    const sqlFiles = files.filter(f => f.endsWith(".sql")).sort((a, b) => orderName(a).localeCompare(orderName(b)));

    for (const file of sqlFiles) {
      const hash = file.replace(".sql", "");

      const exists = await client.query(
        "SELECT id FROM __drizzle_migrations WHERE hash = $1",
        [hash]
      );
      if (exists.rows.length > 0) {
        console.log(`[migrate] skip  ${file} (já aplicado)`);
        continue;
      }

      const raw = await readFile(path.join(migrationsDir, file), "utf-8");
      console.log(`[migrate] start ${file}`);
      await client.query("BEGIN");
      try {
        // PostgreSQL interpreta o arquivo inteiro: DO $$, funções, comentários e strings.
        // O separador Drizzle é um comentário SQL e não precisa ser removido.
        await client.query(raw);
        await client.query(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [hash, Date.now()]
        );
        await client.query("COMMIT");
        console.log(`[migrate] ok    ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Erro ao aplicar ${file}: ${err.message}`);
      }
    }

    console.log("[migrate] Todas as migrations aplicadas com sucesso.");
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main().catch(err => {
  console.error("[migrate] ERRO:", err.message);
  process.exit(1);
});

module.exports = { main };
