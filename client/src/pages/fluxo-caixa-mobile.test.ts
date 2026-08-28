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
