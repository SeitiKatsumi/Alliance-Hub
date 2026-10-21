import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDirectusBiaCommunitySync } from "../server/bia-community-directus";

if (!process.argv.includes("--apply")) throw new Error("Use --apply somente com autorização para associar as BIAs existentes.");
if (!process.env.DATABASE_URL || !process.env.DIRECTUS_TOKEN) throw new Error("Configuração da integração ausente.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  const service = createDirectusBiaCommunitySync(drizzle(pool), {
    url: process.env.DIRECTUS_URL || "http://127.0.0.1:8055", token: process.env.DIRECTUS_TOKEN,
    communityCollection: async () => process.env.DIRECTUS_COMMUNITY_COLLECTION || "Comunidade",
  });
  const result = await service.reconcile();
  console.log(JSON.stringify(result));
  if (result.failed.length) process.exitCode = 1;
} finally { await pool.end(); }
