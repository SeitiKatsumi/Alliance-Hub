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
    // Tabela de controle de migrations
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

    const sqlFiles = files.filter(f => f.endsWith(".sql")).sort();

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

      // Drizzle usa "--> statement-breakpoint" para separar statements.
      // Dividimos por esse marcador e filtramos blocos que são só whitespace.
      const statements = raw
        .split("--> statement-breakpoint")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`[migrate] start ${file} (${statements.length} statements)`);
      await client.query("BEGIN");
      try {
        for (const stmt of statements) {
          if (stmt.trim()) {
            await client.query(stmt);
          }
        }
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

main().catch(err => {
  console.error("[migrate] ERRO:", err.message);
  process.exit(1);
});
