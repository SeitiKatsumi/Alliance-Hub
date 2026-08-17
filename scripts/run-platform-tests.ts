import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["client/src", "server", "shared"];

const collectTests = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectTests(absolute);
  if (!entry.isFile() || !/\.test\.tsx?$/.test(entry.name)) return [];
  return [path.relative(root, absolute).replace(/\\/g, "/")];
});

const tests = roots.flatMap((directory) => collectTests(path.join(root, directory))).sort();
if (tests.length === 0) {
  console.error("Nenhum arquivo de teste encontrado.");
  process.exit(1);
}

console.log(`Executando ${tests.length} arquivos de teste:\n${tests.map((test) => `- ${test}`).join("\n")}\n`);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
