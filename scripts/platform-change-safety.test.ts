import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { changedFiles, checkChangeReview, checkDeprecations, downstream, findReferences, importGraph, isSourceFile, readSources, REVIEW_AREAS, type ChangeReview } from "./lib/platform-change-safety";

const catalog = {version: 1, rules: [{id: "old-concept", description: "Substituição de conceito por uma fonte única", terms: ["Objetivo da Aliança"], roots: ["client", "server", "shared"], regressionTests: ["shared/domain.test.ts"], exceptions: [] as any[]}]};
const recordPath = "docs/platform/changes/test-change.json";
function fixture() {
  const sources = new Map([
    ["shared/domain.ts", "export const thesis = 'Tese de interesse';"],
    ["shared/domain.test.ts", "// Negative test: Objetivo da Aliança"],
    ["client/view.ts", "import {thesis} from '../shared/domain';"],
    ["docs/platform/deprecations.json", JSON.stringify(catalog)],
  ]);
  const record: ChangeReview = {
    version: 1, id: "test-change", title: "Propagar tese de interesse", status: "complete", kind: "rename",
    sourceOfTruth: ["shared/domain.ts"], searchTerms: ["thesis"],
    consumers: ["shared/domain.ts", "client/view.ts"].map(file => ({path: file, decision: "updated", reason: "Consumidor utiliza a fonte canônica compartilhada."})),
    areas: REVIEW_AREAS.map(area => ({area, status: "verified", evidence: "Revisão isolada documentada com teste de propagação."})),
    regressionTests: ["shared/domain.test.ts"], deprecationRuleIds: ["old-concept"],
  };
  const check = (changed = ["shared/domain.ts", recordPath], before?: Map<string, string>) => {
    sources.set(recordPath, JSON.stringify(record));
    return checkChangeReview(sources, changed, before);
  };
  return {sources, record, check};
}

test("varredura inclui código novo em outros diretórios e exclui segredos/artefatos", () => {
  assert.equal(isSourceFile("new-module/rules.ts"), true);
  assert.equal(isSourceFile("package-lock.json"), true);
  for (const file of [".env", "server/.env.local", "node_modules/lib/a.ts", "dist/app.js", "output/a.html", ".BUILT-tmp/a.ts", "tmp/result.json", "app.log"]) assert.equal(isSourceFile(file), false, file);
  const refs = findReferences(new Map([["x.ts", "OBJETIVO DA ALIANÇA\nOutra coisa\nobjetivo da alianca"]]), ["Objetivo da Aliança"]);
  assert.deepEqual(refs, [{file: "x.ts", lines: [1, 3]}]);
});

test("importação, reexportação, require, import dinâmico, aliases e ciclos entram no mapa", () => {
  const sources = new Map([
    ["tsconfig.json", JSON.stringify({compilerOptions: {paths: {"@shared/*": ["shared/*"]}}})],
    ["shared/domain.ts", "import '../client/view'; export const x = 1;"],
    ["shared/index.ts", "export * from './domain.js';"],
    ["client/view.ts", "import {x} from '@shared/index';"],
    ["client/lazy.ts", "const page = import('./view');"],
    ["server/legacy.cjs", "const page = require('../client/lazy');"],
  ]);
  assert.deepEqual(downstream(importGraph(sources), ["shared/domain.ts"]), ["client/lazy.ts", "client/view.ts", "server/legacy.cjs", "shared/index.ts"]);
});

test("referência antiga nova falha mesmo fora dos arquivos já conhecidos; testes negativos são permitidos", () => {
  const {sources} = fixture();
  assert.deepEqual(checkDeprecations(sources, catalog), []);
  sources.set("client/new-screen.tsx", 'const label = "OBJETIVO DA ALIANCA";');
  assert.match(checkDeprecations(sources, catalog).join(), /client\/new-screen.tsx:1/);
});

test("exceção histórica exige arquivo, linha exata e justificativa, sem liberar o restante do arquivo", () => {
  const {sources} = fixture();
  const rule = structuredClone(catalog);
  const line = 'legacy["Objetivo da Aliança"] = thesis;';
  rule.rules[0].exceptions.push({file: "server/template.ts", line, reason: "Compatibilidade de templates históricos imutáveis."});
  sources.set("server/template.ts", line);
  assert.deepEqual(checkDeprecations(sources, rule), []);
  sources.set("server/template.ts", line + "\nconst title = 'Objetivo da Aliança';");
  assert.match(checkDeprecations(sources, rule).join(), /server\/template.ts:2/);
  sources.set("server/template.ts", line + "\n" + line);
  assert.match(checkDeprecations(sources, rule).join(), /2 encontradas/);
  sources.delete("server/template.ts");
  assert.match(checkDeprecations(sources, rule).join(), /0 encontradas/);
  rule.rules[0].exceptions[0].file = "server/*";
  assert.match(checkDeprecations(sources, rule).join(), /Catálogo inválido/);
});

test("catálogo rejeita regras duplicadas e testes ausentes", () => {
  const {sources} = fixture();
  sources.delete("shared/domain.test.ts");
  assert.match(checkDeprecations(sources, {...catalog, rules: [...catalog.rules, ...catalog.rules]}).join(), /Teste ausente/);
  assert.match(checkDeprecations(sources, {...catalog, rules: [...catalog.rules, ...catalog.rules]}).join(), /Regra duplicada/);
});

test("revisão completa passa; omissão do consumidor transitivo bloqueia entrega", () => {
  const {record, check} = fixture();
  assert.deepEqual(check(), []);
  record.consumers.pop();
  assert.match(check().join(), /Sem revisão: client\/view.ts/);
});

test("busca semântica declarada inclui consumidores por texto, sem importação", () => {
  const {sources, check} = fixture();
  sources.set("server/query.sql", "select thesis from catalog;");
  assert.match(check().join(), /referência sem decisão server\/query.sql/);
});

test("registro antigo não serve como prova de um diff novo; arquivo alterado precisa estar coberto", () => {
  const {check} = fixture();
  assert.match(check(["shared/domain.ts"]).join(), /Mudança sem registro/);
  assert.match(check(["client/unreviewed.ts", recordPath]).join(), /Sem revisão: client\/unreviewed.ts/);
});

test("pendências, áreas omitidas e remoção sem guarda não passam", () => {
  const {record, check} = fixture();
  record.status = "pending";
  record.consumers[0].decision = "pending";
  record.areas.pop();
  record.areas[0].status = "pending";
  record.deprecationRuleIds = [];
  const errors = check().join();
  for (const expected of [/revisão pendente/, /consumidor pendente/, /em testes/, /em interface/, /exige regra/]) assert.match(errors, expected);
});

test("remoção usa também o grafo anterior e não desaparece do mapa de impacto", () => {
  const {sources, record, check} = fixture();
  const before = new Map(sources);
  before.set("client/forgotten.ts", "import '../shared/domain';");
  sources.delete("shared/domain.ts");
  record.sourceOfTruth = ["client/view.ts"];
  record.kind = "remove";
  record.consumers[0].decision = "removed";
  assert.match(check(["shared/domain.ts", recordPath], before).join(), /Sem revisão: client\/forgotten.ts/);
});

test("registros não aceitam caminho externo, curingas ou teste que test:all não executaria", () => {
  const {record, check} = fixture();
  record.consumers[0].path = "../outside.ts";
  assert.match(check().join(), /caminho relativo/);
  record.consumers[0].path = "shared/*";
  assert.match(check().join(), /caminho relativo/);
  record.regressionTests = ["docs/fake.test.ts"];
  assert.match(check().join(), /executado por test:all/);
});

test("diff usa versões exatas: índice não é mascarado pelo working tree; remoções e não rastreados entram", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "built-change-safety-"));
  const git = (...args: string[]) => execFileSync("git", args, {cwd: dir, encoding: "utf8"}).trim();
  try {
    git("init", "--quiet");
    fs.mkdirSync(path.join(dir, "shared"));
    fs.writeFileSync(path.join(dir, "shared/rule.ts"), "export const value = 'antes';");
    git("add", ".");
    git("-c", "user.name=Isolated test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "fixture");
    const base = git("rev-parse", "HEAD");
    fs.writeFileSync(path.join(dir, "shared/rule.ts"), "export const value = 'staged antigo';");
    git("add", ".");
    fs.writeFileSync(path.join(dir, "shared/rule.ts"), "export const value = 'working corrigido';");
    fs.writeFileSync(path.join(dir, "shared/new.ts"), "export const novo = true;");
    const staged = changedFiles(dir, {mode: "staged"});
    assert.match(staged.sources.get("shared/rule.ts")!, /staged antigo/);
    assert.equal(staged.sources.has("shared/new.ts"), false);
    const working = changedFiles(dir, {mode: "working"});
    assert.match(working.sources.get("shared/rule.ts")!, /working corrigido/);
    assert.ok(working.files.includes("shared/new.ts"));
    git("-c", "user.name=Isolated test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "staged fixture");
    const range = changedFiles(dir, {mode: "range", base, head: "HEAD"});
    assert.match(range.sources.get("shared/rule.ts")!, /staged antigo/);
    fs.unlinkSync(path.join(dir, "shared/rule.ts"));
    assert.ok(changedFiles(dir, {mode: "working"}).files.includes("shared/rule.ts"));
    assert.throws(() => changedFiles(dir, {mode: "range", base: "--help"}), /inválida/);
    fs.writeFileSync(path.join(dir, ".env"), "PRIVATE=not-to-scan");
    assert.equal(readSources(dir).has(".env"), false);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test("gate entra na verificação e publicação, sem deploy de pull request", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.match(pkg.scripts["platform:verify"], /platform:consistency/);
  assert.match(pkg.scripts["platform:review"], /--review/);
  const workflow = fs.readFileSync(".github/workflows/deploy-caprover.yml", "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /platform:review -- --base "\$BASE_SHA" --head HEAD/);
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /if: github.event_name != 'pull_request'/);
  assert.match(fs.readFileSync("scripts/run-platform-tests.ts", "utf8"), /"scripts"/);
});
