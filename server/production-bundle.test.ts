import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";

test("bundle CommonJS de produção incorpora p-limit e inicializa o limitador sem interop ESM", async () => {
  const script = fs.readFileSync("script/build.ts", "utf8");
  const literal = script.match(/const allowlist = (\[[\s\S]*?\]);/)?.[1];
  assert.ok(literal, "Allowlist real do build não encontrada");
  const allowlist: string[] = JSON.parse(literal.replace(/,\s*\]/, "]"));
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})].filter(dep => !allowlist.includes(dep));
  const output = buildSync({
    stdin: { contents: 'import pLimit from "p-limit"; export const limit = pLimit(2);', resolveDir: process.cwd() },
    platform: "node", format: "cjs", target: "node20", bundle: true, external, write: false,
  }).outputFiles[0].text;
  assert.doesNotMatch(output, /require\(["']p-limit["']\)/, "p-limit ESM não pode ficar externo no runner CommonJS");
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output)(createRequire(import.meta.url), module, module.exports);
  const { limit } = module.exports;
  assert.equal(typeof limit, "function");
  let active = 0, peak = 0;
  await Promise.all([1, 2, 3, 4].map(() => limit(async () => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; })));
  assert.equal(peak, 2);
});
