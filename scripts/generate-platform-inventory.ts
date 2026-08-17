import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedDir = path.join(root, "docs/platform/generated");
fs.mkdirSync(generatedDir, { recursive: true });

const appSource = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const frontendRoutes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);

const collectTs = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectTs(absolute);
  return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [absolute] : [];
});
const serverFiles = collectTs(path.join(root, "server"));
const endpoints: Array<{ method: string; route: string; file: string; line: number }> = [];
for (const file of serverFiles) {
  const source = fs.readFileSync(file, "utf8");
  const pattern = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(pattern)) {
    endpoints.push({
      method: match[1].toUpperCase(),
      route: match[2],
      file: path.relative(root, file).replace(/\\/g, "/"),
      line: source.slice(0, match.index).split("\n").length,
    });
  }
}

const schemaSource = fs.readFileSync(path.join(root, "shared/schema.ts"), "utf8");
const postgresTables = [...schemaSource.matchAll(/pgTable\("([^"]+)"/g)].map((match) => match[1]);
const serverSource = serverFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const directusCollections = new Set<string>();
for (const match of serverSource.matchAll(/\/items\/([A-Za-z0-9_-]+)/g)) directusCollections.add(match[1]);
for (const match of serverSource.matchAll(/collection:\s*["'`]([A-Za-z0-9_-]+)["'`]/g)) directusCollections.add(match[1]);

const header = `> Gerado automaticamente por \`npm run platform:inventory\` em 2026-08-17. Nao editar manualmente.\n\n`;
fs.writeFileSync(
  path.join(generatedDir, "FRONTEND_ROUTES.md"),
  `# Rotas Frontend\n\n${header}${frontendRoutes.sort().map((route) => `- \`${route}\``).join("\n")}\n`,
);
fs.writeFileSync(
  path.join(generatedDir, "API_ENDPOINTS.md"),
  `# Endpoints de API\n\n${header}| Metodo | Rota | Fonte |\n| --- | --- | --- |\n${endpoints.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method)).map((endpoint) => `| ${endpoint.method} | \`${endpoint.route}\` | \`${endpoint.file}:${endpoint.line}\` |`).join("\n")}\n`,
);
fs.writeFileSync(
  path.join(generatedDir, "DATA_STORES.md"),
  `# Armazenamento\n\n${header}## PostgreSQL / Drizzle\n\n${postgresTables.sort().map((table) => `- \`${table}\``).join("\n")}\n\n## Colecoes Directus referenciadas literalmente\n\n${[...directusCollections].sort().map((collection) => `- \`${collection}\``).join("\n") || "Nenhuma colecao literal detectada."}\n`,
);
console.log(`Inventario gerado: ${frontendRoutes.length} rotas, ${endpoints.length} endpoints e ${postgresTables.length} tabelas.`);
