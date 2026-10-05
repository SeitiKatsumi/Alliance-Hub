import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../components/ui/button";
import { canCorrectQuotaTransfer, canProcessQuotaTransfer } from "../../../shared/quota-correction";

test("MAP não invalida em loop enquanto fontes estão carregando", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const effect = source.match(/useEffect\(\(\) => \{ if \(selectedBiaId && \(fluxoUpdatedAt[\s\S]*?\);/);
  assert.ok(effect);
  assert.match(source, /\[fluxoUpdatedAt, transferenciasUpdatedAt, selectedBiaId\]/);
  let requests = 0;
  let previous: unknown[] = [];
  const useEffect = (callback: () => void, deps: unknown[]) => {
    if (deps.some((value, i) => value !== previous[i])) callback();
    previous = deps;
  };
  // Execute the actual effect, including its dependency array.
  const fullEffect = source.slice(effect.index!, source.indexOf("\n", effect.index!));
  const render = new Function("selectedBiaId", "fluxoUpdatedAt", "transferenciasUpdatedAt", "queryClient", "useEffect", fullEffect);
  for (const [fluxo, transfer] of [[0,0],[0,0],[1,0],[1,0],[1,2],[1,2]]) render("bia", fluxo, transfer, {invalidateQueries: () => requests++}, useEffect);
  assert.equal(requests, 2);
});

test("lançamentos financeiros viram cartões legíveis no celular", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const list = source.slice(source.indexOf('data-testid="table-lancamentos"'), source.indexOf("<Dialog open={importDialogOpen}"));

  assert.match(list, /grid-cols-\[auto_minmax\(0,1fr\)_auto\].*md:table-row/s);
  assert.match(list, /whitespace-nowrap tabular-nums/);
  assert.match(list, />Descrição<\/span>/);
  assert.match(list, />Favorecido e CPP<\/span>/);
  assert.match(list, /data-testid=\{`button-acoes-lancamento-/);
});

test("MAP revalida os aportes e reutiliza o calculo compartilhado", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const query = source.slice(source.indexOf("const { data: allFluxo"), source.indexOf("const { data: historico"));

  assert.match(query, /staleTime:\s*0/);
  assert.match(query, /refetchOnMount:\s*"always"/);
  assert.match(query, /refetchOnWindowFocus:\s*true/);
  assert.match(source, /calculateMap\(mapContributions, mapTransfers\)/);
  assert.match(source, /allocateQuotaTransferAmounts\(transferValorRef/);
  assert.match(source, /formatQuotaPercent\(item\.percentual\)/);
  assert.doesNotMatch(source, /transferValorRef\)\.toFixed\(2\)/);
});

test("MAP, movimentações, histórico, confirmações e PDF exibem reais inteiros", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function formatQuotaTransferValue(");
  const helper = source.slice(start, source.indexOf("function formatQuotaPercent(", start));
  const format = new Function(transformSync(`${helper}; return formatQuotaTransferValue;`, { loader: "ts" }).code)();
  for (const [value, expected] of [[43773.24534, "R$ 43.773"], [39553.2625, "R$ 39.553"], [39553.99999, "R$ 39.554"], ["443.98938", "R$ 444"], [0, "R$ 0"]] as const) {
    assert.equal(format(value).replace(/\s/g, " "), expected);
  }
  assert.equal(source.match(/formatQuotaTransferValue\(item.valor\)/g)?.length, 2, "tela e PDF usam o mesmo formato");
  assert.equal(source.match(/formatQuotaPercent\(item.percentual\)/g)?.length, 2, "percentuais preservados na tela e PDF");
  for (const consumer of ["t.valor_total", "transfer.valor_total", "entry.antes.valor_total", "entry.depois.valor_total", "correctingTransfer?.valor_total", "transferValorRef", "valorDest", "valoresDestinatarios[0]"]) {
    assert.ok(source.includes(`formatQuotaTransferValue(${consumer})`), consumer);
  }
  assert.ok(source.includes("setCorrectionValue(Number(t.valor_total || 0).toFixed(5))"), "campo de edição conserva valor exato");
  assert.doesNotMatch(source, /wholeReais|hasFractionalCents/);
});

test("histórico de ajustes é visível para toda transferência, inclusive sem ajustes", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const marker = source.indexOf('data-testid={`historico-ajustes-');
  assert.ok(marker > 0);
  const start = source.lastIndexOf("<details", marker);
  const block = source.slice(start, source.indexOf("</details>", marker) + "</details>".length);
  assert.doesNotMatch(source, /\{!!t\.correcoes\?\.length && \(/);
  assert.doesNotMatch(block, /currentUser|readOnly|canCorrectQuotaTransfer/);
  const render = new Function("React", "t", "formatQuotaTransferValue", "formatQuotaPercent", transformSync(`return (${block});`, { loader: "tsx" }).code);
  const adjustment = { acao: "corrigir", data: "2026-10-05T00:00:00Z", antes: { valor_total: "443.98938", percentual_transferencia: "1.11005" }, depois: { valor_total: "3996.30", percentual_transferencia: "1.11005" }, motivo: "Valor conferido" };
  for (const status of ["pendente", "aceita", "rejeitada", "revertida"]) {
    for (const correcoes of [undefined, [], [adjustment]]) {
      const transfer = { id: "origem-gestor", status, correcoes };
      const before = JSON.stringify(transfer);
      const html = renderToStaticMarkup(render({ createElement }, transfer, String, String));
      assert.ok(html.includes(`Histórico de ajustes (${correcoes?.length || 0})`));
      if (correcoes?.length) {
        assert.match(html, /Correção.*Valor conferido/);
        assert.doesNotMatch(html, /Nenhum ajuste registrado/);
      } else assert.match(html, /Nenhum ajuste registrado\./);
      assert.equal(JSON.stringify(transfer), before);
    }
  }
});

test("Corrigir aparece na própria transferência aceita somente para gestores com edição", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  const condition = source.match(/\{(!readOnly && t.status === "aceita" && canCorrectQuotaTransfer\([^\n]+\)) && \(/);
  assert.ok(condition);
  const visible = new Function("readOnly", "t", "currentUser", "myMembroId", "selectedBia", "canCorrectQuotaTransfer", `return ${condition[1]}`);
  for (const [role, director, ally, expected] of [
    ["user", { id: "origem" }, null, true],
    ["user", null, "origem", true],
    ["admin", null, null, true],
    ["superadmin", null, null, true],
    ["user", "outro", null, false],
  ] as const) {
    const args = [{ status: "aceita", membro_origem_id: "origem" }, { role }, "origem", { diretor_alianca: director, aliado_built: ally }, canCorrectQuotaTransfer] as const;
    assert.equal(visible(false, ...args), expected);
    assert.equal(visible(true, ...args), false);
    assert.equal(visible(false, { ...args[0], status: "pendente" }, ...args.slice(1)), false);
  }
});

test("movimentação permite que gestor processe a própria linha e mantém Editar legível", () => {
  const source = readFileSync(new URL("./fluxo-caixa.tsx", import.meta.url), "utf8");
  assert.equal(canProcessQuotaTransfer("user", "rodrigo", "rodrigo", null), true);
  assert.match(source, /const canApprove = canProcessQuotaTransfer\(/);
  const editTestId = source.indexOf('data-testid={`btn-editar-transfer-');
  const editButton = source.slice(source.lastIndexOf("<Button", editTestId), editTestId).match(/className="([^"]+)"/);
  assert.ok(editButton, "testa as classes do botão real");
  for (const className of [editButton[1], "text-brand-navy bg-primary/10", "text-brand-navy hover:bg-blue-600", "text-brand-navy focus:bg-brand-gold"]) {
    const editar = renderToStaticMarkup(createElement(Button, { variant: "outline", className }, "Editar"));
    assert.match(editar, /text-brand-navy/);
    assert.doesNotMatch(editar, /text-white/);
  }
  for (const className of ["bg-blue-600", "bg-primary", "bg-brand-gold"]) {
    assert.match(renderToStaticMarkup(createElement(Button, { className }, "Salvar")), /text-white/);
  }
});
