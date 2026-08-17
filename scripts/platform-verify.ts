import fs from "node:fs";
import path from "node:path";
import { PLATFORM_FUNCTIONAL_MODULES } from "../client/src/data/platform-functional-report";

interface ContractModule {
  id: string;
  doc: string;
  frontendFiles: string[];
  backendFiles: string[];
  apiPrefixes: string[];
  tests: string[];
}

interface PlatformContract {
  version: number;
  modules: ContractModule[];
  crossCutting: Array<{ id: string; modules: string[] }>;
}

const root = process.cwd();
const failures: string[] = [];
const contractPath = path.join(root, "docs/platform/platform-contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as PlatformContract;

const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const duplicateValues = (values: string[]) => values.filter((value, index) => values.indexOf(value) !== index);
const contractIds = contract.modules.map((module) => module.id);
const functionalIds = PLATFORM_FUNCTIONAL_MODULES.map((module) => module.id);

for (const duplicate of new Set(duplicateValues(contractIds))) failures.push(`Modulo duplicado no contrato: ${duplicate}`);
for (const duplicate of new Set(duplicateValues(functionalIds))) failures.push(`Modulo funcional duplicado: ${duplicate}`);
for (const id of functionalIds) if (!contractIds.includes(id)) failures.push(`Modulo funcional sem contrato: ${id}`);
for (const id of contractIds) if (!functionalIds.includes(id)) failures.push(`Contrato sem modulo funcional: ${id}`);

const featureIds = PLATFORM_FUNCTIONAL_MODULES.flatMap((module) => module.features.map((feature) => feature.id));
for (const duplicate of new Set(duplicateValues(featureIds))) failures.push(`Funcionalidade duplicada: ${duplicate}`);

for (const module of contract.modules) {
  for (const file of [module.doc, ...module.frontendFiles, ...module.backendFiles, ...module.tests]) {
    if (!exists(file)) failures.push(`[${module.id}] Arquivo inexistente: ${file}`);
  }
}

for (const rule of contract.crossCutting) {
  for (const moduleId of rule.modules) {
    if (!contractIds.includes(moduleId)) failures.push(`[${rule.id}] Modulo transversal inexistente: ${moduleId}`);
  }
}

const readTsFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return readTsFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
};
const backendSource = readTsFiles(path.join(root, "server"))
  .filter((file) => !file.endsWith(".test.ts"))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
for (const module of contract.modules) {
  for (const prefix of module.apiPrefixes) {
    if (!backendSource.includes(prefix)) failures.push(`[${module.id}] Prefixo de API nao encontrado no backend: ${prefix}`);
  }
}

const markdownFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return markdownFiles(absolute);
  return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
});
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
for (const markdownFile of markdownFiles(path.join(root, "docs/platform"))) {
  const content = fs.readFileSync(markdownFile, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].split("#")[0];
    if (!target || /^https?:|^mailto:/.test(target)) continue;
    const resolved = path.resolve(path.dirname(markdownFile), target);
    if (!fs.existsSync(resolved)) failures.push(`${path.relative(root, markdownFile)} referencia link inexistente: ${target}`);
  }
}

if (failures.length > 0) {
  console.error(`Contrato invalido (${failures.length} problema(s)):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Contrato valido: ${contract.modules.length} modulos e ${featureIds.length} funcionalidades cobertas.`);
