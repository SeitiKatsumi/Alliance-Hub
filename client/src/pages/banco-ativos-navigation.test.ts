import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Banco de Ativos oculta a navegacao geral e preserva suas categorias", () => {
  const source = readFileSync(new URL("./area-aliancas.tsx", import.meta.url), "utf8");

  assert.match(source, /<Tabs value=\{activeTab\}[\s\S]*?\{!forcedArea && \(\s*<TabsList/);
  assert.match(source, /<TabsContent value="landbank"/);
  assert.match(source, /landBankCategories\.map/);
});
