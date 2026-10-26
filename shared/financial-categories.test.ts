import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoryText, financialCategoryOptions, matchingFinancialCategory } from "./financial-categories";

const proper = { id: 120, Nome_da_categoria: "3.9 Serviços recorrentes de operações e facilities", Tipo_de_categoria: "Saída", Descricao_das_categorias: "NÚCLEO DE OBRA", bia_id: null };
const broken = { ...proper, id: 180, Nome_da_categoria: "3.9 ServiÃ§os recorrentes de operaÃ§Ãµes e facilities", Tipo_de_categoria: "SaÃ­da", Descricao_das_categorias: "NÃšCLEO DE OBRA" };

test("categorias: corrige acentos reversíveis e unifica opções preservando ID selecionado", () => {
  assert.equal(categoryText(broken.Nome_da_categoria), proper.Nome_da_categoria);
  assert.equal(categoryText(broken.Descricao_das_categorias), proper.Descricao_das_categorias);
  assert.equal(categoryText("ENTRADAS DO PRÃ“PRIO NEGÃ“CIO"), "ENTRADAS DO PRÓPRIO NEGÓCIO");
  assert.equal(categoryText("São Paulo · Japão"), "São Paulo · Japão");
  assert.deepEqual(financialCategoryOptions([broken, proper]), [proper]);
  assert.deepEqual(financialCategoryOptions([proper, broken], 180), [broken]);
  assert.ok(matchingFinancialCategory([proper, broken], 120, 180));
  assert.equal(matchingFinancialCategory([proper, broken], 999, 120), false);
});

test("categorias: grupos, códigos, tipos e BIAs diferentes não são fundidos", () => {
  const others = [{ ...proper, id: 1, Tipo_de_categoria: "Entrada" }, { ...proper, id: 2, bia_id: "outra" }, { ...proper, id: 3, Descricao_das_categorias: "Outro núcleo" }, { ...proper, id: 4, Nome_da_categoria: proper.Nome_da_categoria.replace("3.9", "3.10") }];
  assert.equal(financialCategoryOptions([proper, broken, ...others]).length, 5);
  for (const other of others) assert.equal(matchingFinancialCategory([proper, other], 120, other.id), false);
});

test("seed de categorias reconhece nome corrompido existente sem criar outra categoria", async () => {
  const source = readFileSync("server/routes.ts", "utf8");
  const start = source.indexOf("  async function ensurePlanoContasCategorias()");
  const end = source.indexOf("  await ensurePlanoContasCategorias()", start);
  const body = source.slice(start, end).replace("new Map<string, any>()", "new Map()");
  const writes: any[] = [];
  const run = new Function("directusFetch", "directusUpdate", "directusCreate", "categoryText", "PLANO_CONTAS_CATEGORIAS", `${body}; return ensurePlanoContasCategorias();`);
  await run(async () => [broken], async (...args: any[]) => writes.push(args), async () => { throw Error("não deve duplicar"); }, categoryText, [{ nome: broken.Nome_da_categoria, tipo: broken.Tipo_de_categoria, grupo: broken.Descricao_das_categorias }]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], 180);
  assert.equal(writes[0][2].Nome_da_categoria, proper.Nome_da_categoria);
});

test("criação/edição e filtro usam projeção única sem mudar relações salvas", () => {
  const source = readFileSync("client/src/pages/fluxo-caixa.tsx", "utf8");
  assert.match(source, /financialCategoryOptions\(categorias, value\)/);
  assert.match(source, /financialCategoryOptions\(categorias, Number\(filterCategoria\)\)/);
  assert.match(source, /matchingFinancialCategory\(categorias,/);
  assert.match(source, /const selected = categorias.find\(\(c\) => c.id === value\)/);
});
