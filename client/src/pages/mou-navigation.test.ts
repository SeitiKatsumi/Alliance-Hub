import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { matchesMouRevision } from "@shared/agenda-action";

test("link abre uma única vez, aguarda pendências e não substitui revisão nem usuário", () => {
  const page = fs.readFileSync("client/src/pages/comunidade.tsx", "utf8");
  const block = page.slice(page.indexOf("  const openedMouLink ="), page.indexOf("  const [mouAceito,"));
  assert.ok(block.includes("useEffect"));
  const ref = { current: null as string | null }, opened: any[] = [], notices: any[] = [];
  const run = (searchParams: string, mouRevisoes: any[], ready = true) => {
    const deps = { useRef: () => ref, useEffect: (fn: () => void) => fn(), searchParams, convitesOnly: true, mouRevisoesReady: ready, mouRevisoes, matchesMouRevision,
      setNotificacoesTab() {}, setMostrarHistoricoAprovacoes() {}, setAprovacoesSearch() {}, toast: (value: any) => notices.push(value), revisarMouMutation: { mutate: (value: any) => opened.push(value) } };
    new Function(...Object.keys(deps), transformSync(block, { loader: "tsx" }).code)(...Object.values(deps));
  };
  const pending = [{ id: "bia", map_revisao: 3 }];
  run("?mou=bia&revisao=3", [], false); assert.equal(opened.length, 0); assert.equal(notices.length, 0);
  run("?mou=bia&revisao=3", pending);
  assert.deepEqual(opened, [{ id: "bia", revision: 3 }]);
  run("?mou=bia&revisao=3", [...pending]); assert.equal(opened.length, 1); // polling/close
  run("", pending); run("?mou=bia&revisao=2", pending);
  run("?mou=foreign&revisao=3", pending);
  run("?mou=bia&revisao=3", []); // already accepted
  assert.equal(opened.length, 1); assert.equal(notices.length, 3);
});

test("Agenda, painel e resumo usam destino e título compartilhados", () => {
  const agenda = fs.readFileSync("client/src/pages/agenda.tsx", "utf8");
  const painel = fs.readFileSync("client/src/pages/painel.tsx", "utf8");
  const routes = fs.readFileSync("server/routes.ts", "utf8");
  assert.match(agenda, /const action = agendaSourceAction\(tarefa\)/);
  assert.match(agenda, /openAction\(task\)/);
  assert.match(painel, /href: agendaTaskHref\(acao\)/);
  assert.match(painel, /navigate\(acao.href\)/);
  assert.match(routes, /href: agendaTaskHref\(task\)/);
  for (const source of [agenda, painel, routes]) assert.match(source, /agendaTaskTitle\(/);
});
