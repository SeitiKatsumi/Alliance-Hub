import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";

const recoveryContext = new AsyncLocalStorage<boolean>();

// A slow recovery must not consume a new database connection on every tick.
export function createMapRecoveryJob(work: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await recoveryContext.run(true, work);
    } finally {
      running = false;
    }
  };
}

export async function acquireMapFinancialLock(tx: { execute: (query: any) => Promise<any> }, biaId: string) {
  const key = `bia-financial:${biaId}`;
  if (recoveryContext.getStore()) {
    // Defer busy BIAs to a later cycle; never queue a background transaction
    // behind a user operation or another instance holding this same lock.
    const result = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`);
    if (result.rows[0]?.locked !== true) {
      throw Object.assign(new Error("Conciliação adiada: BIA em uso."), { code: "MAP_RECOVERY_BUSY" });
    }
  } else {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
  }
}
