import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

test("portal local usa identidade BUILT nas duas apresentações", () => {
  for (const path of ["client/public/localhosts.html", "client/src/pages/portal-localhosts.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes("BUILT — Ambientes locais"));
    assert.ok(source.includes('name: "Projeto BUILT"'));
    assert.ok(source.includes("ambientes locais dos seus projetos em um só painel."));
  }
});

test("prévia renomeada aponta para uma entrada existente", () => {
  const html = readFileSync("client/built-onboarding-preview.html", "utf8");
  assert.ok(html.includes('src="/src/built-onboarding-preview.tsx"'));
  assert.ok(existsSync("client/src/built-onboarding-preview.tsx"));
});
