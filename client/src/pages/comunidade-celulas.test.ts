import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

test("Dados da candidatura mantém contraste no card e detalhes sem ampliar dados restritos", () => {
  const page = readFileSync(new URL("./comunidade.tsx", import.meta.url), "utf8");
  const source = page.slice(page.indexOf("function candidateValue("), page.indexOf("interface ComunidadePageProps"));
  const Panel = new Function("React", "FileText", transformSync(source, { loader: "tsx" }).code + ";return CandidateInfoPanel;")(React, () => null);
  const convite = { candidato_nome: "Candidata Exemplo", candidato_email: "exemplo@example.test", dados_contratuais: { cidade: "Vitória", cpf: "documento-restrito", telefone: "contato-restrito", mensagem: "Olá <script>", cargo: "Engenharia", token: "segredo-oculto" } };
  const before = JSON.stringify(convite);
  for (const compact of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(Panel, { convite, compact }));
    assert.match(html, /bg-card text-card-foreground/);
    assert.match(html, /text-muted-foreground/);
    assert.match(html, /border-border bg-muted\/30/);
    assert.doesNotMatch(html, /(?:text|border|bg)-white/);
    assert.match(html, /Candidata Exemplo/);
    assert.match(html, /Vitória/);
    assert.match(html, /Olá &lt;script&gt;/);
    assert.doesNotMatch(html, /documento-restrito|contato-restrito|segredo-oculto|<script>/);
    assert.equal(html.includes("Engenharia"), !compact);
    const authorized = renderToStaticMarkup(React.createElement(Panel, { convite, compact, showRestrictedData: true }));
    assert.match(authorized, /documento-restrito/);
    assert.match(authorized, /contato-restrito/);
    assert.doesNotMatch(authorized, /segredo-oculto/);
  }
  assert.equal(renderToStaticMarkup(React.createElement(Panel, { convite: {} })), "");
  assert.equal(JSON.stringify(convite), before);
  assert.equal((page.match(/<CandidateInfoPanel convite=/g) || []).length, 2);
});

test("Comunidade mantém as seis Células oficiais em uma aba própria", () => {
  const page = readFileSync(new URL("./comunidade-detalhe.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

  assert.match(page, /role="tab"[\s\S]*selectCommunityTab\("celulas"\)/);
  assert.match(page, /activeCommunityTab === "celulas" \? "block" : "hidden"/);
  assert.doesNotMatch(page, /Propor (nova )?Célula/);
  assert.doesNotMatch(page, /cell\.markets\.map/);
  assert.doesNotMatch(page, />Tipos de negócio</);
  assert.doesNotMatch(page, />Coordenador da Célula</);
  assert.match(page, /navigate\(`\/comunidade\/\$\{id\}\/celulas\/\$\{cell\.id\}`\)/);
  assert.match(page, /data-testid="section-participantes-celula"/);
  assert.match(app, /Route path="\/comunidade\/:id\/celulas\/:cellId"/);
  assert.match(routes, /async function ensureCommunityStrategicCells/);
  assert.match(routes, /await ensureCommunityStrategicCells\(req\.params\.id\)/);
  assert.match(routes, /canManage \? cellMemberships : cellMemberships\.filter/);
  assert.match(routes, /directusFetchScoped\("cadastro_geral", `fields=id,nome&filter\[id\]\[_in\]/);
  assert.match(routes, /publicNamesByMemberId\.get\(String\(\(membership as any\)\.membro_id\)\)/);
  assert.doesNotMatch(routes, /COALESCE\(u\.nome, u\.email, sm\.membro_id\) AS nome/);
});
