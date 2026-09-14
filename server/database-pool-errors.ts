import type { Pool } from "pg";

// Handles only idle-client errors; query failures still reject to their callers.
export function observeDatabasePoolErrors(pool: Pick<Pool, "on">, name: string): void {
  pool.on("error", () => {
    console.error(`[postgres:${name}] Conexão ociosa interrompida; conexão descartada pelo pool.`);
  });
}
