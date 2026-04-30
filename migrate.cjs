/* eslint-disable @typescript-eslint/no-var-requires */
const { Pool } = require("pg");
const { readdir, readFile } = require("fs/promises");
const path = require("path");

/**
 * Divide um arquivo SQL em statements individuais.
 * Suporta dois formatos:
 *   1. Drizzle: separados por "--> statement-breakpoint"
 *   2. Plain SQL: separados por ";" no final da linha
 */
function splitStatements(sql) {
  if (sql.includes("--> statement-breakpoint")) {
    return sql
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // Plain SQL: divide por ponto-e-vírgula, preservando strings
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== "\\") inString = false;
    } else if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === ";") {
      const stmt = current.trim();
      if (stmt.length > 0) statements.push(stmt + ";");
      current = "";
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last.length > 0) statements.push(last);

  return statements.filter(s => {
    // Remove blocos que são só comentários
    const stripped = s.replace(/--[^\n]*/g, "").trim();
    return stripped.length > 0;
  });
}

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
      const statements = splitStatements(raw);

      console.log(`[migrate] start ${file} (${statements.length} statements)`);
      await client.query("BEGIN");
      try {
        for (const stmt of statements) {
          await client.query(stmt);
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
