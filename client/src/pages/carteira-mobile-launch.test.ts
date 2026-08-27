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
