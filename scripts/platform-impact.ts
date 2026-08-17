import fs from "node:fs";
import path from "node:path";
import { PLATFORM_FUNCTIONAL_MODULES } from "../client/src/data/platform-functional-report";

interface ContractModule {
  id: string;
  name: string;
  doc: string;
  keywords: string[];
  routes: string[];
  frontendFiles: string[];
  backendFiles: string[];
  apiPrefixes: string[];
  dataStores: string[];
  roles: string[];
  invariants: string[];
  tests: string[];
}

interface CrossCuttingRule {
  id: string;
  keywords: string[];
  modules: string[];
  invariant: string;
}

interface PlatformContract {
  modules: ContractModule[];
  crossCutting: CrossCuttingRule[];
}

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9/_?.:-]+/g, " ")
  .trim();

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Uso: npm run platform:impact -- <funcionalidade, termo ou arquivo>");
  process.exit(1);
}

const root = process.cwd();
const contract = JSON.parse(
  fs.readFileSync(path.join(root, "docs/platform/platform-contract.json"), "utf8"),
) as PlatformContract;
const normalizedQuery = normalize(query);
const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

const functionalById = new Map(PLATFORM_FUNCTIONAL_MODULES.map((module) => [module.id, module]));
const crossMatches = contract.crossCutting.filter((rule) => {
  const searchable = normalize([rule.id, ...rule.keywords, rule.invariant].join(" "));
  return searchable.includes(normalizedQuery) || queryTokens.every((token) => searchable.includes(token));
});

const scored = contract.modules.map((module) => {
  const functional = functionalById.get(module.id);
  const features = functional?.features ?? [];
  const fields = [
    module.id,
    module.name,
    module.doc,
    ...module.keywords,
    ...module.routes,
    ...module.frontendFiles,
    ...module.backendFiles,
    ...module.apiPrefixes,
    ...module.dataStores,
    ...module.roles,
    ...module.invariants,
    ...(functional ? [functional.title, functional.summary] : []),
    ...features.flatMap((feature) => [feature.id, feature.title, feature.description]),
  ].map(normalize);
  const exact = fields.some((field) => field.includes(normalizedQuery));
  const tokenHits = queryTokens.filter((token) => fields.some((field) => field.includes(token))).length;
  const crossHit = crossMatches.some((rule) => rule.modules.includes(module.id));
  return { module, functional, features, score: (exact ? 100 : 0) + tokenHits * 10 + (crossHit ? 5 : 0) };
}).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);

if (scored.length === 0) {
  console.error(`Nenhum impacto encontrado para: ${query}`);
  console.error(`Modulos disponiveis: ${contract.modules.map((module) => module.id).join(", ")}`);
  process.exit(2);
}

console.log(`\nImpacto da plataforma para: ${query}\n`);
for (const entry of scored) {
  const matchingFeatures = entry.features.filter((feature) => {
    const searchable = normalize([feature.id, feature.title, feature.description].join(" "));
    return searchable.includes(normalizedQuery) || queryTokens.some((token) => searchable.includes(token));
  });
  console.log(`=== ${entry.module.name} [${entry.module.id}] ===`);
  console.log(`Contrato: ${entry.module.doc}`);
  if (matchingFeatures.length > 0) {
    console.log(`Funcionalidades: ${matchingFeatures.map((feature) => `${feature.title} (${feature.id})`).join("; ")}`);
  }
  console.log(`Telas/rotas: ${entry.module.routes.join(", ")}`);
  console.log(`Frontend: ${entry.module.frontendFiles.join(", ")}`);
  console.log(`Backend: ${entry.module.backendFiles.join(", ")}`);
  console.log(`APIs: ${entry.module.apiPrefixes.join(", ")}`);
  console.log(`Dados: ${entry.module.dataStores.join("; ")}`);
  console.log(`Papeis: ${entry.module.roles.join(", ")}`);
  console.log("Invariantes:");
  entry.module.invariants.forEach((invariant) => console.log(`- ${invariant}`));
  console.log(`Testes: ${entry.module.tests.join(", ")}\n`);
}

if (crossMatches.length > 0) {
  console.log("Regras transversais:");
  crossMatches.forEach((rule) => console.log(`- ${rule.id}: ${rule.invariant}`));
}
