import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("modal base permanece rolável na altura do celular", () => {
  const source = readFileSync(new URL("../components/ui/dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(source, /overflow-y-auto/);
});

test("lançamento do imóvel oferece leitura por IA antes do formulário manual", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("function NewLaunchDialog"), source.indexOf("function DemandInterestsManager"));
  assert.ok(dialog.indexOf("Leitura com IA") > -1);
  assert.ok(dialog.indexOf("Leitura com IA") < dialog.lastIndexOf("ou preencha manualmente"));
  assert.match(dialog, /Confirmar sugestões/);
});

test("excluir sugestão remove somente a linha selecionada, sem gravar ou excluir registros oficiais", () => {
  const source = readFileSync(new URL("./carteira.tsx", import.meta.url), "utf8");
  const dialog = source.slice(source.indexOf("function NewLaunchDialog"), source.indexOf("function DemandInterestsManager"));
  const button = dialog.match(/<Button[^>]*aria-label=\{`Excluir lançamento[^\n]+/u)?.[0];
  assert.ok(button);
  assert.match(button, /disabled=\{suggestionsMutation\.isPending\}/);
  const handler = button.match(/onClick=\{\(\) => (setSuggestions\(.+\))\}/)?.[1];
  assert.ok(handler);
  const remove = new Function("setSuggestions", "index", handler);
  const repeated = { descricao: "Despesa repetida", valor: 100 };
  const other = { descricao: "Outra despesa", valor: 200 };
  const original = [repeated, repeated, other];
  let remaining = original;
  const setSuggestions = (update: (current: typeof original) => typeof original) => { remaining = update(remaining); };
  remove(setSuggestions, 1);
  assert.deepEqual(remaining, [repeated, other]);
  assert.equal(original.length, 3);
  remove(setSuggestions, 0);
  assert.deepEqual(remaining, [other]);
  remove(setSuggestions, 0);
  assert.deepEqual(remaining, []);
  assert.match(dialog, /suggestions\.length > 0 &&/);
  assert.match(dialog, /Promise\.all\(suggestions\.map/);
});
