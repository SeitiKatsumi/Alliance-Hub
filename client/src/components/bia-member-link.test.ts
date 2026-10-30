import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { BiaMemberLink } from "./bia-member-link";
import { getMembroUrl, resolveMembroByRef } from "../lib/public-refs";

const members = [{ id: "member-a", nome: "Mesmo nome" }, { id: "member-b", nome: "Mesmo nome" }];
function render(memberId: string | null, name = "Mesmo nome", directory = members) {
  return renderToStaticMarkup(React.createElement(Router, { ssrPath: "/bias/test" },
    React.createElement(BiaMemberLink, { memberId, name, members: directory })));
}

test("atalho usa identidade explícita e rota pública, sem resolver homônimos pelo nome", () => {
  for (const member of members) {
    const url = getMembroUrl(member);
    assert.ok(render(member.id).includes(`href="${url}"`));
    assert.equal(resolveMembroByRef(members, url.split("/").pop())?.id, member.id);
  }
  assert.match(render("member-a"), /aria-label="Ver perfil de Mesmo nome"/);
  assert.match(render("member-a"), /focus-visible:ring-2/);
  assert.doesNotMatch(render("member-a"), /target=|onclick=/);
});

test("não cria link para instituição, função sem identidade, nome vazio ou membro fora do diretório", () => {
  for (const html of [render(null, "BUILT"), render(null, "Não atribuído"), render("ausente"), render("member-a", ""), render("member-a", "Mesmo nome", [])]) {
    assert.doesNotMatch(html, /<a\b|href=|tabindex=/);
  }
  assert.match(render("member-a", "<script>"), /&lt;script&gt;/);
});

test("Governança e as duas apresentações CPP usam o mesmo atalho sem modificar a projeção econômica", () => {
  const page = readFileSync(new URL("../pages/bia-detalhe.tsx", import.meta.url), "utf8");
  assert.match(page, /memberId=\{e\.id\}/);
  assert.match(page, /memberId=\{nome \? memberId : null\}/);
  assert.equal((page.match(/memberId=\{row\.memberId\}/g) || []).length, 2);
  assert.match(page, /const summary = initialMapEconomicSummary\(snapshot\)/);
  assert.match(page, /\.\.\.row, memberId: snapshot\.participantes\[index\]\.memberId/);
  assert.match(page, /memberId: null, cpp: valorOrigem \* row\.perc \/ 100/);
  const profile = readFileSync(new URL("../pages/membro-detalhe.tsx", import.meta.url), "utf8");
  assert.match(profile, /resolveMembroByRef\(membros, id\)/);
  assert.match(profile, /queryKey: \["\/api\/membros"\]/);
});
