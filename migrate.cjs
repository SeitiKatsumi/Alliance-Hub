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
      console.log("Pasta migrations/ não encontrada — nenhuma migração aplicada.");
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
        console.log(`[skip] ${file} (já aplicado)`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), "utf-8");
      console.log(`[run ] ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [hash, Date.now()]
        );
        await client.query("COMMIT");
        console.log(`[ok  ] ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrações concluídas.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Erro nas migrações:", err);
  process.exit(1);
});
