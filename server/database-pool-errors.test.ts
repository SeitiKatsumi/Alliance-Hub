import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { observeDatabasePoolErrors } from "./database-pool-errors";

test("idle database errors are handled without leaking connection details or issuing queries", async (t) => {
  const pool = new Pool(); // No connection is opened by construction or emit.
  const log = t.mock.method(console, "error", () => {});
  const query = t.mock.method(pool, "query", () => { throw new Error("Unexpected query"); });
  try {
    assert.throws(() => pool.emit("error", new Error("offline")), /offline/);
    observeDatabasePoolErrors(pool, "test");
    assert.doesNotThrow(() => pool.emit("error", new Error("postgres://user:secret@host/db")));
    assert.equal(log.mock.callCount(), 1);
    assert.match(String(log.mock.calls[0].arguments[0]), /postgres:test/);
    assert.doesNotMatch(JSON.stringify(log.mock.calls), /secret|postgres:\/\//);
    assert.equal(query.mock.callCount(), 0);
  } finally {
    await pool.end();
  }
});
