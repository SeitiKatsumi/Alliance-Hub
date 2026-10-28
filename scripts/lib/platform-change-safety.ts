import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { z } from "zod";

export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const slash = (text: string) => text.replace(/\\/g, "/");
const relativePath = z.string().min(1).refine(value => !path.isAbsolute(value) && !/^[A-Za-z]:|[\\\r\n\0]|(^|\/)\.\.?($|\/)|[*?\[\]]/.test(value), "Use caminho relativo exato, sem curingas ou ..");
const explanation = z.string().trim().min(12);
const testPath = relativePath.refine(value => /^(client\/src|server|shared|scripts)\/.+\.test\.tsx?$/.test(value), "Informe um teste executado por test:all");

// No credentials, logs, build output, local experiments or binary/user assets are inspected.
export function isSourceFile(file: string): boolean {
  if (/(^|\/)(node_modules|dist|build|coverage|output|tmp|\.git|\.local|\.BUILT-tmp|attached_assets|generated)(\/|$)/.test(file)) return false;
  if (/(^|\/)(\.env[^/]*|AI_HANDOFF\.md)$|\.(log|map|lock)$/.test(file)) return false;
  return /\.(?:[cm]?[jt]sx?|json|sql|html|css|txt|ya?ml|md|sh|ps1|py)$/.test(file);
}

export function needsReview(file: string): boolean {
  return isSourceFile(file) && !file.startsWith("docs/") && !file.endsWith(".md");
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

export function repositoryFiles(root: string): string[] {
  return [...new Set(git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean))]
    .filter(isSourceFile).sort();
}

export function readSources(root: string, files = repositoryFiles(root)): Map<string, string> {
  const sources = new Map<string, string>();
  const realRoot = fs.realpathSync(root);
  for (const file of files) {
    relativePath.parse(file);
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) continue; // Deleted files are retained separately in the change inventory.
    const real = fs.realpathSync(absolute);
    const relative = path.relative(realRoot, real);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Arquivo fora do repositório: ${file}`);
    sources.set(file, fs.readFileSync(absolute, "utf8"));
  }
  return sources;
}

export function findReferences(sources: Map<string, string>, terms: string[]) {
  const needles = terms.filter(term => term.trim()).map(normalize);
  return [...sources].flatMap(([file, content]) => {
    const lines = content.split(/\r?\n/).flatMap((line, index) => needles.some(term => normalize(line).includes(term)) ? [index + 1] : []);
    return lines.length ? [{ file, lines }] : [];
  });
}

export function importGraph(sources: Map<string, string>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const config = sources.get("tsconfig.json");
  const aliases: Record<string, string[]> = config ? ts.parseConfigFileTextToJson("tsconfig.json", config).config?.compilerOptions?.paths || {} : {};
  const resolve = (from: string, specifier: string): string | undefined => {
    let bases: string[] = [];
    if (specifier.startsWith(".")) bases = [slash(path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)))];
    for (const [alias, targets] of Object.entries(aliases)) {
      const star = alias.indexOf("*");
      if (star < 0 ? alias === specifier : specifier.startsWith(alias.slice(0, star)) && specifier.endsWith(alias.slice(star + 1))) {
        const middle = star < 0 ? "" : specifier.slice(star, specifier.length - (alias.length - star - 1));
        bases.push(...targets.map(target => target.replace("*", middle).replace(/^\.\//, "")));
      }
    }
    for (const base of bases) {
      const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"].map(ext => base + ext), ...[".ts", ".tsx", ".js", ".jsx"].map(ext => `${base}/index${ext}`)];
      // TypeScript source may be imported using the eventual .js extension.
      if (/\.[cm]?js$/.test(base)) candidates.push(base.replace(/\.[cm]?js$/, ".ts"));
      const found = candidates.find(candidate => sources.has(candidate));
      if (found) return found;
    }
    return undefined;
  };
  for (const [file, content] of sources) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    const imports = ts.preProcessFile(content, true, true).importedFiles;
    for (const item of imports) {
      const dependency = resolve(file, item.fileName);
      if (dependency) {
        const consumers = graph.get(dependency) || new Set<string>();
        consumers.add(file);
        graph.set(dependency, consumers);
      }
    }
  }
  return graph;
}

export function downstream(graph: Map<string, Set<string>>, seeds: string[]): string[] {
  const found = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    for (const consumer of graph.get(queue.shift()!) || []) {
      if (!found.has(consumer)) { found.add(consumer); queue.push(consumer); }
    }
  }
  return [...found].filter(file => !seeds.includes(file)).sort();
}

export const catalogSchema = z.object({
  version: z.literal(1),
  rules: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    description: explanation,
    terms: z.array(z.string().trim().min(3)).min(1),
    roots: z.array(relativePath).min(1),
    regressionTests: z.array(testPath).min(1),
    exceptions: z.array(z.object({ file: relativePath, line: z.string().trim().min(3), reason: explanation }).strict()),
  }).strict()).min(1),
}).strict();

export function checkDeprecations(sources: Map<string, string>, input: unknown): string[] {
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success) return [`Catálogo inválido: ${parsed.error.message}`];
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const rule of parsed.data.rules) {
    if (ids.has(rule.id)) failures.push(`Regra duplicada: ${rule.id}`);
    ids.add(rule.id);
    for (const test of rule.regressionTests) if (!sources.has(test)) failures.push(`[${rule.id}] Teste ausente: ${test}`);
    const used = rule.exceptions.map(() => 0);
    for (const [file, text] of sources) {
      if (!rule.roots.some(root => file === root || file.startsWith(root.endsWith("/") ? root : root + "/")) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) continue;
      text.split(/\r?\n/).forEach((line, index) => {
        if (!rule.terms.some(term => normalize(line).includes(normalize(term)))) return;
        const exception = rule.exceptions.findIndex(item => item.file === file && item.line === line.trim());
        if (exception < 0) failures.push(`[${rule.id}] Referência antiga em ${file}:${index + 1}`);
        else used[exception]++;
      });
    }
    rule.exceptions.forEach((item, index) => {
      if (used[index] !== 1) failures.push(`[${rule.id}] Exceção deve corresponder a uma única linha (${used[index]} encontradas): ${item.file}`);
    });
  }
  return failures;
}

export const REVIEW_AREAS = ["interface", "api", "dados", "calculos-graficos", "notificacoes-emails", "documentos-relatorios", "integracoes-tarefas", "permissoes", "legado", "testes"] as const;
export const reviewSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: explanation,
  status: z.enum(["complete", "pending"]),
  kind: z.enum(["rename", "remove", "behavior", "maintenance"]),
  sourceOfTruth: z.array(relativePath).min(1),
  searchTerms: z.array(z.string().trim().min(2)).min(1),
  consumers: z.array(z.object({ path: relativePath, decision: z.enum(["updated", "reviewed", "removed", "preserved", "pending"]), reason: explanation }).strict()).min(1),
  areas: z.array(z.object({ area: z.enum(REVIEW_AREAS), status: z.enum(["verified", "not-applicable", "pending"]), evidence: explanation }).strict()),
  regressionTests: z.array(testPath).min(1),
  deprecationRuleIds: z.array(z.string()),
}).strict();
export type ChangeReview = z.infer<typeof reviewSchema>;

export function checkChangeReview(sources: Map<string, string>, changed: string[], before: Map<string, string> = new Map()): string[] {
  const required = changed.filter(needsReview);
  if (!required.length) return [];
  const failures: string[] = [];
  const catalog = catalogSchema.parse(JSON.parse(sources.get("docs/platform/deprecations.json") || "{}"));
  const recordPaths = changed.filter(file => /^docs\/platform\/changes\/[^/]+\.json$/.test(file) && sources.has(file));
  const covered = new Set<string>();
  if (!recordPaths.length) failures.push("Mudança sem registro de revisão em docs/platform/changes/*.json.");
  for (const recordPath of recordPaths) {
    const parsed = reviewSchema.safeParse(JSON.parse(sources.get(recordPath)!));
    if (!parsed.success) { failures.push(`${recordPath}: ${parsed.error.message}`); continue; }
    const record = parsed.data;
    if (record.status !== "complete") failures.push(`${recordPath}: revisão pendente.`);
    const seen = new Set<string>();
    for (const consumer of record.consumers) {
      if (seen.has(consumer.path)) failures.push(`${recordPath}: consumidor duplicado ${consumer.path}`);
      seen.add(consumer.path);
      if (consumer.decision === "pending") failures.push(`${recordPath}: consumidor pendente ${consumer.path}`);
      else covered.add(consumer.path);
      if (consumer.decision === "removed") {
        if (sources.has(consumer.path) || !changed.includes(consumer.path)) failures.push(`${recordPath}: remoção não comprovada ${consumer.path}`);
      } else if (!sources.has(consumer.path)) failures.push(`${recordPath}: consumidor inexistente ${consumer.path}`);
    }
    for (const file of [...record.sourceOfTruth, ...record.regressionTests]) if (!sources.has(file)) failures.push(`${recordPath}: evidência inexistente ${file}`);
    for (const area of REVIEW_AREAS) {
      const entries = record.areas.filter(entry => entry.area === area);
      if (entries.length !== 1 || entries[0].status === "pending") failures.push(`${recordPath}: revisão ausente/pendente/duplicada em ${area}`);
    }
    if (["rename", "remove"].includes(record.kind) && !record.deprecationRuleIds.length) failures.push(`${recordPath}: renomeação/remoção exige regra contra regressão.`);
    for (const id of record.deprecationRuleIds) if (!catalog.rules.some(rule => rule.id === id)) failures.push(`${recordPath}: regra de depreciação inexistente ${id}`);
    // Search inventory is enforced too: arbitrary file omissions are not a completed repository-wide review.
    for (const reference of findReferences(sources, record.searchTerms).filter(item => needsReview(item.file))) {
      if (!seen.has(reference.file)) failures.push(`${recordPath}: referência sem decisão ${reference.file}`);
    }
  }
  const seeds = required.filter(file => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file));
  const affected = new Set([...required, ...downstream(importGraph(sources), seeds), ...downstream(importGraph(before), seeds)]);
  for (const file of affected) if (needsReview(file) && !covered.has(file)) failures.push(`Sem revisão: ${file}`);
  return failures;
}

export type ChangeScope = { mode: "working" | "staged" | "range"; base?: string; head?: string };
export function changedFiles(root: string, scope: ChangeScope): { files: string[]; before: Map<string, string>; sources: Map<string, string> } {
  const revision = (ref: string) => {
    if (!/^[A-Za-z0-9_./~^{}-]+$/.test(ref) || ref.startsWith("-")) throw new Error("Referência Git inválida");
    return git(root, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  };
  const base = revision(scope.base || "HEAD");
  const head = scope.mode === "range" ? revision(scope.head || "HEAD") : undefined;
  const args = ["diff", "--name-only", "--no-renames", "-z", ...(scope.mode === "staged" ? ["--cached", base] : [base, ...(head ? [head] : [])]), "--"];
  const files = git(root, args).split("\0").filter(Boolean);
  if (scope.mode === "working") files.push(...git(root, ["ls-files", "-z", "--others", "--exclude-standard"]).split("\0").filter(Boolean));
  const treeSources = (ref: string, staged = false) => {
    const names = git(root, staged ? ["ls-files", "-z", "--cached"] : ["ls-tree", "-rz", "--name-only", ref]).split("\0").filter(isSourceFile);
    names.forEach(file => relativePath.parse(file));
    const result = execFileSync("git", ["cat-file", "--batch"], {
      cwd: root, input: names.map(file => staged ? `:${file}` : `${ref}:${file}`).join("\n") + "\n", maxBuffer: 128 * 1024 * 1024,
    });
    const tree = new Map<string, string>();
    let cursor = 0;
    for (const file of names) {
      const end = result.indexOf(10, cursor);
      const header = result.subarray(cursor, end).toString("utf8");
      if (!/^[a-f0-9]+ blob \d+$/.test(header)) throw new Error(`Não foi possível ler a versão de ${file}`);
      const size = Number(header.split(" ")[2]);
      tree.set(file, result.subarray(end + 1, end + 1 + size).toString("utf8"));
      cursor = end + size + 2;
    }
    return tree;
  };
  return { files: [...new Set(files)].sort(), before: treeSources(base), sources: scope.mode === "working" ? readSources(root) : treeSources(head || "HEAD", scope.mode === "staged") };
}
