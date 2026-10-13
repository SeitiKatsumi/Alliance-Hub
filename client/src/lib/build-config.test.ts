import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("build mantém React, aliases e proxies sem plugins do editor legado", () => {
  const config = readFileSync("vite.config.ts", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(config.includes("plugins: [react()]"));
  assert.ok(config.includes('"@shared"'));
  assert.ok(config.includes('"/api"'));
  assert.ok(config.includes('"/auth"'));
  assert.doesNotMatch(config, /@replit\/|REPL_ID/);
  assert.ok(!Object.keys(pkg.devDependencies).some(name => name.startsWith("@replit/")));
  assert.ok(!existsSync(".replit"));
  assert.ok(existsSync("HISTORICO_TECNICO.md"));
});
