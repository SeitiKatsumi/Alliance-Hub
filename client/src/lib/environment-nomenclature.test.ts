import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translateInterface } from "./interface-language";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("painel e menu usam Vitrine e Alianças como nomes canônicos", () => {
  const panel = read("../pages/painel.tsx");
  const sidebar = read("../components/app-sidebar.tsx");

  assert.match(panel, /title: "Vitrine"/);
  assert.match(panel, /title: "Alianças"/);
  assert.doesNotMatch(panel, /title: "BUILT Vitrine"|title: "BUILT Alliances"/);
  assert.match(sidebar, /t\("Vitrine"\)/);
  assert.match(sidebar, /"Alianças"/);
  assert.doesNotMatch(sidebar, /MEMBER_PORTFOLIO_V2_ENABLED \? "Área de Vitrine"/);
  assert.doesNotMatch(sidebar, /MEMBER_PORTFOLIO_V2_ENABLED \? "Área de Alianças"/);
});

test("títulos dos ambientes seguem a mesma nomenclatura", () => {
  const access = read("../components/environment-access.tsx");
  const showcase = read("../pages/vitrine.tsx");
  const alliances = read("../pages/area-aliancas.tsx");

  assert.match(access, /title: "Vitrine"/);
  assert.match(access, /title: "Alianças"/);
  assert.match(showcase, /data-testid="text-vitrine-title"[\s\S]*?"Vitrine"/);
  assert.match(alliances, /data-testid="text-area-aliancas-title"[\s\S]*?"Alianças"/);
});

test("nomes canônicos têm tradução de interface", () => {
  assert.equal(translateInterface("Vitrine", "en"), "Showcase");
  assert.equal(translateInterface("Alianças", "es"), "Alianzas");
});
