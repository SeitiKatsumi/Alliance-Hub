import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

test("consulta de sócios usa autorização da BIA, pendências oficiais e agrupa papéis", async () => {
  const source = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf('  app.get("/api/bias/:id/socios-status"'), source.indexOf('  app.get("/api/bia-socio-solicitacoes/bia/:biaId"'));
  let handler: any, allowed = true, failed = false, reads = 0;
  const scope = {
    app: { get: (_path: string, fn: any) => handler = fn },
    requireBiaModuleAccess: async (_req: any, _res: any, ref: string, key: string, level: string) => {
      assert.equal(ref, "PUBLIC"); assert.equal(key, "configuracao_bia"); assert.equal(level, "view");
      return allowed ? { bia: { id: "internal", socios_guardioes: ["a", "a", "b"], socios_multiplicadores: ["a"] } } : null;
    },
    storage: { getBiaSocioSolicitacoesPendentesByBia: async (id: string) => {
      reads++; assert.equal(id, "internal"); if (failed) throw Error("offline");
      return [{ socio_membro_id: "a", socio_nome: "Ana", papel: "Multiplicador" }, { socio_membro_id: "c", socio_nome: "Carlos", papel: "Guardião" }];
    } },
    SOCIO_SOLICITACAO_CONFIG: [{ campoSocios: "socios_guardioes", papel: "Guardião" }, { campoSocios: "socios_multiplicadores", papel: "Multiplicador" }],
    parseBiaMemberList: (value: string[]) => value,
    getMembroResumo: async (id: string) => id === "b" ? { nome: "Bruno" } : null,
  };
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code)(...Object.values(scope));
  let result: any, status = 200;
  const response = { json: (value: any) => result = value, status: (value: number) => { status = value; return response; } };
  await handler({ params: { id: "PUBLIC" } }, response);
  assert.equal(result.convitesPendentes, 2);
  assert.deepEqual(result.socios.map((s: any) => s.nome), ["Ana", "Carlos", "Bruno"]);
  assert.deepEqual(result.socios[0].papeis, ["Guardião", "Multiplicador"]);
  assert.equal(result.socios[1].papeis.length, 0);
  allowed = false; await handler({ params: { id: "PUBLIC" } }, response); assert.equal(reads, 1);
  allowed = true; failed = true; await handler({ params: { id: "PUBLIC" } }, response); assert.equal(status, 500);
  assert.doesNotMatch(code, /res\.json\(\[\]\)|update|create|socio_email/);
});

test("lista mostra nomes, papéis e pendências, com estados vazios e erro distintos", () => {
  const source = readFileSync(new URL("./bia-partners-status.tsx", import.meta.url), "utf8");
  let state: any;
  const scope = { React, Button: "button", useQuery: () => state };
  const compiled = transformSync(source.slice(source.indexOf("export function BiaPartnersStatus(")).replaceAll("export function", "function"), { loader: "tsx" }).code;
  const Component = new Function(...Object.keys(scope), compiled + ";return BiaPartnersStatus;")(...Object.values(scope));
  const html = () => renderToStaticMarkup(React.createElement(Component, { biaId: "bia" }));
  state = { data: { convitesPendentes: 1, socios: [{ membroId: "a", nome: "Ana <teste>", papeis: ["Guardiã"], convitesPendentes: ["Multiplicadora"] }] } };
  assert.match(html(), /Ana &lt;teste&gt;/); assert.match(html(), /Convite pendente de aceite/); assert.match(html(), /Vinculado/);
  state = { data: { convitesPendentes: 0, socios: [] } }; assert.match(html(), /Nenhum sócio/);
  state = { isPending: true }; assert.match(html(), /Carregando sócios/); assert.doesNotMatch(html(), /Nenhum sócio/);
  state = { isError: true }; assert.match(html(), /Não foi possível consultar/); assert.doesNotMatch(html(), /Nenhum sócio/);
});
