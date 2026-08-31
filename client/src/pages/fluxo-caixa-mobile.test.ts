import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
});
