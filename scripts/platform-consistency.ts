import { changedFiles, checkChangeReview, checkDeprecations, readSources, type ChangeScope } from "./lib/platform-change-safety";

const root = process.cwd();
const args = process.argv.slice(2);
const requireReview = args[0] === "--review";
if (requireReview) args.shift();
try {
  let scope: ChangeScope | undefined = requireReview ? {mode: "working"} : undefined;
  if (args.length) {
    if (args[0] === "--staged" && args.length === 1) scope = {mode: "staged"};
    else if (args[0] === "--base" && args[1] && args.length === 2) scope = {mode: "working", base: args[1]};
    else if (args[0] === "--base" && args[1] && args[2] === "--head" && args[3] && args.length === 4) scope = {mode: "range", base: args[1], head: args[3]};
    else throw new Error("Uso: platform:consistency [--staged | --base REF [--head REF]]");
  }
  const changes = scope ? changedFiles(root, scope) : undefined;
  const sources = changes?.sources || readSources(root);
  const catalog = JSON.parse(sources.get("docs/platform/deprecations.json") || "{}");
  const failures = [
    ...checkDeprecations(sources, catalog),
    ...(changes ? checkChangeReview(sources, changes.files, changes.before) : []),
  ];
  if (failures.length) {
    console.error(`Revisão transversal bloqueada (${failures.length} pendência(s)):`);
    failures.forEach(item => console.error(`- ${item}`));
    process.exitCode = 1;
  } else {
    console.log(`Consistência aprovada: ${sources.size} arquivos inspecionados${changes ? `; ${changes.files.length} arquivos no diff e seus consumidores revisados` : "; catálogo de conceitos removidos verificado"}.`);
    if (!scope) console.log("Para concluir/publicar uma mudança, execute também platform:review com o diff exato; esta verificação não atesta revisão semântica de todas as alterações.");
  }
} catch (error) {
  console.error(`Falha na revisão transversal: ${(error as Error).message}`);
  process.exitCode = 1;
}
