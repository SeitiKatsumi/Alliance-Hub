import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { acquireMapFinancialLock, createMapRecoveryJob } from "./map-recovery-job";

const dialect = new PgDialect();

test("an unfinished recovery cannot accumulate a second execution", async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let executions = 0;
  const run = createMapRecoveryJob(async () => { executions++; await blocked; });
  const first = run();
  await run();
  await run();
  assert.equal(executions, 1);
  release();
  await first;
  await run();
  assert.equal(executions, 2);
});

test("a busy BIA defers recovery and permits the next tick to retry", async () => {
  let available = false;
  let work = 0;
  const statements: string[] = [];
  const tx = { execute: async (query: any) => {
    const statement = dialect.sqlToQuery(query);
    statements.push(statement.sql);
    assert.deepEqual(statement.params, ["bia-financial:test-bia"]);
    return { rows: [{ locked: available }] };
  } };
  const run = createMapRecoveryJob(async () => {
    await acquireMapFinancialLock(tx, "test-bia");
    work++;
  });
  await assert.rejects(run(), { code: "MAP_RECOVERY_BUSY" });
  assert.equal(work, 0);
  available = true;
  await run();
  assert.equal(work, 1);
  assert.ok(statements.every(query => query.includes("pg_try_advisory_xact_lock")));
});

test("normal financial operations keep their blocking lock outside recovery", async () => {
  const statements: string[] = [];
  const tx = { execute: async (query: any) => {
    statements.push(dialect.sqlToQuery(query).sql);
    return { rows: [{ locked: true }] };
  } };
  const run = createMapRecoveryJob(async () => { await acquireMapFinancialLock(tx, "test-bia"); });
  await run();
  await acquireMapFinancialLock(tx, "test-bia");
  assert.match(statements[0], /pg_try_advisory_xact_lock/);
  assert.match(statements[1], /SELECT pg_advisory_xact_lock/);
});

test("database failures also release the recovery guard", async () => {
  let attempts = 0;
  const run = createMapRecoveryJob(async () => {
    attempts++;
    if (attempts === 1) throw new Error("database unavailable");
  });
  await assert.rejects(run(), /database unavailable/);
  await run();
  assert.equal(attempts, 2);
});
