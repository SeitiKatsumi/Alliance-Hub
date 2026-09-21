import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { calculateInitialMap, initialMapContributionValue } from "../../../shared/member-portfolio";
import { validateInitialClassifications } from "../../../shared/initial-contributions";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const calculator = read("./bias-calculadora.tsx");
const editor = calculator.slice(calculator.indexOf("function MapInicialCalculator("), calculator.indexOf("export default function BiasCalculadoraPage"));
function expression(source: string, predicate: (node: ts.Node, file: ts.SourceFile) => boolean) {
  const file = ts.createSourceFile("test.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result = "";
  const visit = (node: ts.Node) => { if (predicate(node, file)) result = node.getText(file); else ts.forEachChild(node, visit); };
  visit(file); assert.ok(result, "expressão de produção encontrada"); return result;
}
function evaluate(source: string, scope: Record<string, unknown>) {
  const code = transformSync(`(${source})`, { loader: "tsx", format: "esm" }).code.trim().replace(/;$/, "");
  return new Function(...Object.keys(scope), `return ${code}`)(...Object.values(scope));
}

test("DM reutiliza cálculo/classificações, aceita zero e não classifica contribuição automaticamente", () => {
  const preview = expression(editor, (n, f) => ts.isArrowFunction(n) && n.getText(f).includes("const calculation = calculateInitialMap"));
  const capital = { participantId: "a", memberId: "a", nome: "A", cargos: ["Diretor", "Aliado"], tipo: "guardiao", indiceContribuicao: 0, capitalComprometido: 1500000, pesoCapital: 100, naturezaCapital: "caixa", tipoCppCapital: { id: "capital", nome: "Capital" } };
  const multiplier = { participantId: "b", memberId: "b", nome: "B", cargos: [], tipo: "multiplicador", indiceContribuicao: 12.5, capitalComprometido: 0, pesoCapital: 0, naturezaCapital: "nao_caixa", tipoCppContribuicao: { id: "origem", nome: "Origem" } };
  const run = (participantes: unknown[]) => evaluate(preview, { valorOrigem: 1500000, participantes, byValue: true, calculateInitialMap, validateInitialClassifications })();
  const valid = run([capital, multiplier]);
  assert.equal(valid.error, null); assert.equal(valid.calculation.divisorMultiplicador, 12.5);
  assert.equal(valid.calculation.baseEconomicaInicial, 1687500); assert.equal(valid.calculation.participantes.length, 2);
  assert.ok(run([{ ...capital, indiceContribuicao: 1 }, multiplier]).error);
  assert.ok(run([{ ...capital, indiceContribuicao: NaN }, multiplier]).error);
  assert.equal(initialMapContributionValue(1500000, 0), 0);
});

test("salvar DM/composição usa a revisão de origem do rascunho, não a consulta revalidada", async () => {
  const mutation = expression(editor, (n, f) => ts.isArrowFunction(n) && n.getText(f).includes('apiRequest("PUT"'));
  const participantes = [{ memberId: "a", indiceContribuicao: 0, capitalComprometido: 1500000, cargos: ["Diretor", "Aliado"] }];
  let body: any;
  await evaluate(mutation, { apiRequest: async (_method: string, url: string, payload: unknown) => { assert.equal(url, "/api/bias/bia/map-inicial"); body = payload; return { json: async () => payload }; }, bia: { id: "bia" }, valorOrigem: 1500000, base: { moeda: "BRL", revisao: 3 }, snapshot: { revisao: 4 }, participantes, motivo: "Correção" })();
  assert.equal(body.revisaoEsperada, 3); assert.equal(body.participantes, participantes); assert.equal(body.motivo, "Correção");
  assert.doesNotMatch(editor, /apiRequest\("(?:POST|PATCH)"/);
});

test("revalidação não sobrescreve o rascunho e edições obedecem ambas as permissões", () => {
  const effect = expression(editor, (n, f) => ts.isArrowFunction(n) && n.getText(f).includes("if (!dirty)"));
  for (const dirty of [true, false]) {
    const calls: string[] = [];
    evaluate(effect, { dirty, snapshot: { valorOrigem: 200, participantes: [] }, setBase: () => calls.push("base"), setValorOrigem: () => calls.push("valor"), setParticipantes: () => calls.push("pessoas") })();
    assert.equal(calls.length, dirty ? 0 : 3);
  }
  assert.match(editor, /readOnly = readOnly \|\| !snapshot.canEdit/);
  assert.match(editor, /snapshot.ativa && !motivo.trim\(\)/);
});

test("somente 404 explicitamente legado habilita calculadora antiga", async () => {
  const loader = calculator.slice(calculator.indexOf("export function useInitialMapSnapshot"), calculator.indexOf("export function BiaMapZero"));
  const query = expression(loader, (n, f) => ts.isArrowFunction(n) && n.getText(f).includes("await fetch"));
  for (const [status, code, legacy] of [[404, "LEGACY_BIA_MAP", true], [404, "", false], [503, "", false]] as const) {
    const run = evaluate(query, { biaId: "bia", fetch: async () => ({ status, ok: false, json: async () => ({ code, error: "Indisponível" }) }) });
    if (legacy) assert.equal(await run(), null); else await assert.rejects(run);
  }
});

test("atalho antigo de aportes vai ao Financeiro; DM comum não é redirecionado", () => {
  const source = read("./bia-detalhe.tsx");
  const redirect = expression(source, (n, f) => ts.isArrowFunction(n) && n.getText(f).includes('window.location.hash === "#aportes-iniciais"'));
  for (const hash of ["", "#aportes-iniciais"]) {
    const urls: string[] = [];
    evaluate(redirect, { URLSearchParams, window: { location: { search: "?tab=capital&capital=calculadora", pathname: "/bias/BIA", hash } }, navigate: (url: string) => urls.push(url) })();
    assert.deepEqual(urls, hash ? ["/bias/BIA?tab=capital&capital=financeiro&financeiro=aportes"] : []);
  }
  assert.match(read("./fluxo-caixa.tsx"), /capital=financeiro&financeiro=aportes/);
});

test("cada área tem seu componente único, MAP Atual padrão e links persistentes", () => {
  const map = read("./movimentacao-cotas.tsx"), financial = read("./nucleo-capital.tsx");
  assert.doesNotMatch(calculator, /<InitialContributions|<BiaMapHistory/);
  assert.match(map, /requestedView === "zero" \|\| requestedView === "historico" \? requestedView : "atual"/);
  assert.match(map, /params.set\("view", next\)/); assert.match(map, /<FluxoCaixaPage[^>]+cotasOnly/);
  assert.match(map, /<BiaMapZero/); assert.match(map, /<BiaMapHistory/);
  assert.match(financial, /snapshot.data\?\.modeloCalculo === 3/);
  assert.equal((financial.match(/<InitialContributions/g) || []).length, 1);
  assert.match(editor, /mode === "zero" && !editing/); assert.match(editor, /mode === "zero" && editing/);
});

test("descartar exige confirmação, cancelamento bloqueia navegação e unload", () => {
  const source = read("../hooks/use-unsaved-changes.ts").replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const events = new Map<string, Function>();
  const location = { href: "http://localhost/dm" };
  const history = { state: null, pushState(_state: unknown, _unused: string, url: string) { location.href = new URL(url, location.href).href; }, replaceState(_state: unknown, _unused: string, url: string) { location.href = new URL(url, location.href).href; } };
  let accepted = false, prompts = 0, cleanup: Function | undefined;
  const navigation = { addEventListener: (name: string, fn: Function) => events.set(name, fn), removeEventListener: () => {} };
  const window = { navigation, confirm: () => { prompts++; return accepted; }, addEventListener: (name: string, fn: Function) => events.set(name, fn), removeEventListener: () => {} };
  const document = { addEventListener: () => {}, removeEventListener: () => {} };
  const code = transformSync(source, { loader: "ts" }).code;
  const hook = new Function("useEffect", "useRef", "window", "history", "location", "document", `${code}; return useUnsavedChanges;`)((fn: Function) => { cleanup = fn(); }, (value: boolean) => ({ current: value }), window, history, location, document);
  hook(true);
  history.pushState(null, "", "/map"); assert.equal(location.href, "http://localhost/dm"); assert.equal(prompts, 1);
  let blocked = false;
  events.get("navigate")!({ cancelable: true, destination: { url: "http://localhost/map" }, preventDefault: () => { blocked = true; } });
  assert.equal(blocked, true);
  const unload = { preventDefault: () => { blocked = true; }, returnValue: undefined as unknown };
  blocked = false; events.get("beforeunload")!(unload); assert.equal(blocked, true); assert.equal(unload.returnValue, "");
  accepted = true; history.pushState(null, "", "/map"); assert.equal(location.href, "http://localhost/map");
  const confirmedPrompts = prompts; history.pushState(null, "", "/financeiro"); assert.equal(prompts, confirmedPrompts);
  cleanup?.();
});
