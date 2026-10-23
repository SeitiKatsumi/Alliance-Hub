import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { PUBLIC_LABELS, publicLabel } from "./public-labels";

test("rótulo de tese normaliza somente nomes descontinuados, sem mudar códigos ou nomes personalizados", () => {
  for (const value of [undefined, null, "", "Tipo de negócio", "Tipos de negócios", " TIPOS DE NEGOCIO ", "Objetivo da Aliança"]) {
    assert.equal(publicLabel("Market", value), "Tese de interesse");
  }
  assert.equal(publicLabel("Market", "Estratégia personalizada"), "Estratégia personalizada");
  assert.equal(publicLabel("ContributionArea", "Tipo de negócio"), "Tipo de negócio");
  assert.equal(publicLabel("ContributionArea"), "O que você pode oferecer");
  assert.deepEqual(Object.keys(PUBLIC_LABELS), ["Market", "StrategicCell", "GovernanceProfile", "ContributionArea"]);
});

function taxonomyHandler(method: string, url: string, scope: Record<string, unknown>) {
  const source = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handler = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === `app.${method}` && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === url) {
      handler = node.arguments[1].getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler, url);
  return new Function(...Object.keys(scope), transformSync(`const handler = ${handler};`, { loader: "ts" }).code + ";return handler;")(...Object.values(scope));
}

test("API de nomes públicos corrige override antigo só na projeção; escrita continua autorizada", async () => {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const scope = {
    PUBLIC_LABELS, publicLabel,
    ensureTaxonomyTables: async () => {},
    resultRows: (value: unknown) => value,
    sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
    db: { execute: async (statement: { text: string; values: unknown[] }) => {
      statements.push(statement);
      return statement.text.trim().startsWith("SELECT")
        ? [{ code: "Market", display_name: "Tipo de negócio", description: "Descrição preservada" }]
        : [{ code: statement.values[0], display_name: statement.values[1] }];
    } },
    isAdminRequest: (req: any) => req.admin === true,
    recordUsageEvent: async () => {},
  };
  let payload: any;
  let status = 200;
  const res = { json: (value: unknown) => { payload = value; }, status: (value: number) => { status = value; return res; } };
  await taxonomyHandler("get", "/api/taxonomy/public-labels", scope)({}, res);
  assert.deepEqual(payload.find((item: any) => item.code === "Market"), { code: "Market", display_name: "Tese de interesse", description: "Descrição preservada" });
  assert.equal(statements.length, 1);
  assert.match(statements[0].text, /^SELECT/);
  const put = taxonomyHandler("put", "/api/admin/taxonomy/public-labels/:code", scope);
  await put({ params: { code: "Market" }, body: { display_name: "Tipo de negócio" } }, res);
  assert.equal(status, 403);
  assert.equal(statements.length, 1, "acesso negado não grava");
  for (const [value, expected] of [["Objetivo da Aliança", "Tese de interesse"], ["Estratégia personalizada", "Estratégia personalizada"]]) {
    await put({ admin: true, params: { code: "Market" }, body: { display_name: value }, session: { directusUserId: "test-admin" } }, res);
    assert.equal(payload.display_name, expected);
  }
});

test("cache antigo do frontend também usa o mesmo adaptador de nomes públicos", () => {
  const source = readFileSync("client/src/hooks/use-public-labels.ts", "utf8").replace(/^import .*;\r?\n/gm, "").replace("export function", "function");
  const hook = new Function("useQuery", "publicLabel", transformSync(source, { loader: "ts" }).code + ";return usePublicLabels;")(
    () => ({ data: [{ code: "Market", display_name: "Tipos de negócio" }] }), publicLabel,
  );
  assert.equal(hook()("Market"), "Tese de interesse");
});

test("demandas, administração, perfil e opções do PDF usam o nome público de tese", () => {
  for (const [path, expected] of [
    ["client/src/components/bia-demandas.tsx", "Tese de interesse"],
    ["client/src/pages/network-opportunities.tsx", "Tese de interesse"],
    ["client/src/components/admin-commercial-policies.tsx", "Células e teses de interesse"],
    ["client/src/pages/meu-perfil.tsx", "Falha ao carregar teses de interesse"],
    ["client/src/lib/print-bia-summary.ts", "Identificação, tese de interesse"],
  ]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes(expected), path);
    assert.doesNotMatch(source, /tipos? de neg[oó]cios?/i, path);
  }
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.ok(routes.includes("Escolha uma Célula antes da tese de interesse."));
  assert.ok(routes.includes("A tese de interesse não pertence à Célula escolhida."));
});
