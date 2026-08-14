import assert from "node:assert/strict";
import test from "node:test";
import { acceptQuotaTransfer } from "./quota-transfer";

test("aceitar transferencia altera somente o status da transferencia", async () => {
  const calls: Array<{ id: string; patch: unknown }> = [];
  const result = await acceptQuotaTransfer("transfer-1", async (id, patch) => {
    calls.push({ id, patch });
    return { id, ...patch };
  });

  assert.deepEqual(calls, [{ id: "transfer-1", patch: { status: "aceita" } }]);
  assert.deepEqual(result, { id: "transfer-1", status: "aceita" });
});
