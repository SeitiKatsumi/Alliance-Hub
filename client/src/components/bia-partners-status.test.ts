import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { hasBiaAccess } from "../../../shared/bia-access";

test("consulta de sócios usa autorização da BIA, pendências oficiais e agrupa papéis", async () => {
  const source = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf('  app.get("/api/bias/:id/socios-status"'), source.indexOf('  app.get("/api/bia-socio-solicitacoes/bia/:biaId"'));
  let handler: any, allowed = true, failed = false, reads = 0;
  const scope = {
    app: { get: (_path: string, fn: any) => handler = fn },
    hasBiaAccess,
    requireBiaModuleAccess: async (_req: any, _res: any, ref: string, key: string, level: string) => {
      assert.equal(ref, "PUBLIC"); assert.equal(key, "configuracao_bia"); assert.equal(level, "view");
      return allowed ? { access:{permissions:{configuracao_bia:"edit"}}, bia: { id: "internal", socios_guardioes: ["a", "a", "b"], socios_multiplicadores: ["a"], diretor_alianca: {id:"a"}, diretor_capital:"d", aliado_built:"b" } } : null;
    },
    storage: { getBiaSocioSolicitacoesPendentesByBia: async (id: string) => {
      reads++; assert.equal(id, "internal"); if (failed) throw Error("offline");
      return [{ socio_membro_id: "a", socio_nome: "Ana", papel: "Multiplicador" }, { socio_membro_id: "c", socio_nome: "Carlos", papel: "Guardião" }];
    }, getBiaDiretorSolicitacoesPendentesByBia: async (id: string) => {
      assert.equal(id,"internal");
      return [{diretor_membro_id:"c",diretor_nome:"Carlos",papel:"Diretor Técnico"}, {diretor_membro_id:"e",diretor_nome:"Eduardo",papel:"Diretor de Obra"}];
    } },
    DIRETOR_SOLICITACAO_CONFIG: [{campoDiretor:"diretor_alianca",papel:"Diretor de Aliança"},{campoDiretor:"diretor_capital",papel:"Diretor de Capital"}],
    directusRelationId: (value: any) => value?.id || value || null,
    SOCIO_SOLICITACAO_CONFIG: [{ campoSocios: "socios_guardioes", papel: "Guardião" }, { campoSocios: "socios_multiplicadores", papel: "Multiplicador" }],
    parseBiaMemberList: (value: string[]) => value,
    getMembroResumo: async (id: string) => id === "b" ? { nome: "Bruno" } : null,
  };
  new Function(...Object.keys(scope), transformSync(code, { loader: "ts" }).code)(...Object.values(scope));
  let result: any, status = 200;
  const response = { json: (value: any) => result = value, status: (value: number) => { status = value; return response; } };
  await handler({ params: { id: "PUBLIC" } }, response);
  assert.equal(result.convitesPendentes, 4);
  assert.equal(result.canReenviar, true);
  assert.deepEqual(result.socios.map((s: any) => s.nome), ["Ana", "Carlos", "Eduardo", "Bruno", "Membro d"]);
  assert.deepEqual(result.socios[0].papeis, ["Guardião", "Multiplicador", "Diretor de Aliança"]);
  assert.deepEqual(result.socios[1].convitesPendentes, ["Guardião", "Diretor Técnico"]);
  assert.deepEqual(result.socios[3].papeis, ["Guardião", "Aliado BUILT"]);
  assert.deepEqual(result.socios[4].papeis, ["Diretor de Capital"]);
  assert.equal(result.socios[1].papeis.length, 0);
  allowed = false; await handler({ params: { id: "PUBLIC" } }, response); assert.equal(reads, 1);
  allowed = true; failed = true; await handler({ params: { id: "PUBLIC" } }, response); assert.equal(status, 500);
  assert.doesNotMatch(code, /res\.json\(\[\]\)|update|create|socio_email/);
});

test("lista mostra nomes, papéis e pendências, com estados vazios e erro distintos", () => {
  const source = readFileSync(new URL("./bia-partners-status.tsx", import.meta.url), "utf8");
  let state: any;
  const scope = { React, Button: "button", useQuery: () => state, useToast:()=>({toast:()=>{}}), useMutation:()=>({isPending:false,mutate:()=>{}}) };
  const compiled = transformSync(source.slice(source.indexOf("export function BiaPartnersStatus(")).replaceAll("export function", "function"), { loader: "tsx" }).code;
  const Component = new Function(...Object.keys(scope), compiled + ";return BiaPartnersStatus;")(...Object.values(scope));
  const html = () => renderToStaticMarkup(React.createElement(Component, { biaId: "bia" }));
  state = { data: { convitesPendentes: 1, socios: [{ membroId: "a", nome: "Ana <teste>", papeis: ["Guardiã"], convitesPendentes: ["Multiplicadora"] }] } };
  assert.match(html(), /Ana &lt;teste&gt;/); assert.match(html(), /Convite pendente de aceite/); assert.match(html(), /Vinculado/);
  assert.match(html(), /Participantes e pendências/);
  assert.doesNotMatch(html(), />Atualizar</);
  assert.match(source, /refetchInterval: 30_000/);
  assert.match(source, /refetchOnWindowFocus: "always"/);
  assert.match(source, /refetchOnReconnect: "always"/);
  assert.match(source, /refetchOnMount: "always"/);
  state.data.socios[0].convites = [{id:"i",tipo:"socio"}];
  assert.doesNotMatch(html(), /Reenviar convite/);
  state.data.canReenviar = true;
  assert.match(html(), /Reenviar convite para Ana/);
  state = { data: { convitesPendentes: 0, socios: [] } }; assert.match(html(), /Nenhum participante/);
  state = { isPending: true }; assert.match(html(), /Carregando participantes/); assert.doesNotMatch(html(), /Nenhum participante/);
  state = { isError: true }; assert.match(html(), /Não foi possível consultar/); assert.doesNotMatch(html(), /Nenhum participante/);
  assert.match(html(), /automaticamente/); assert.doesNotMatch(html(), /Clique em Atualizar/);
});
