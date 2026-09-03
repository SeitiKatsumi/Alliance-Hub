import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a central do perfil mostra a previa superior com Aura do tamanho da foto", () => {
  const page = readFileSync(new URL("./meu-perfil.tsx", import.meta.url), "utf8");
  const auraScore = readFileSync(new URL("../components/aura-score.tsx", import.meta.url), "utf8");
  const hub = page.slice(page.indexOf("const profileHub"), page.indexOf("const profileSummary"));

  assert.ok(hub.indexOf("{profilePreview}") < hub.indexOf("profileCategories.map"));
  assert.match(page, /h-24 w-24[\s\S]*?data-testid="profile-preview-avatar"/);
  assert.match(page, /data-testid="profile-preview-aura"[\s\S]*?<AuraScore[\s\S]*?size="md"/);
  assert.match(page, /\[data-testid="profile-preview-aura"\] svg circle:first-of-type/);
  assert.match(auraScore, /md: "w-24 h-24"/);
  assert.match(page, /href=\{`\/aura\/\$\{encodeURIComponent\(membroId\)\}`\}/);
});

test("conta e seguranca mostra alterar senha antes do convite", () => {
  const page = readFileSync(new URL("./meu-perfil.tsx", import.meta.url), "utf8");
  const accountEditor = page.slice(page.indexOf('data-testid="section-alterar-senha"'), page.indexOf("<aside"));

  assert.ok(accountEditor.indexOf('data-testid="section-alterar-senha"') < accountEditor.indexOf("{/* Meu Convite */}"));
  assert.match(accountEditor, /md:grid-cols-3/);
  assert.match(accountEditor, /data-testid="btn-alterar-senha"/);
  assert.match(page, /pending === null \? null/);
  assert.doesNotMatch(page, />Revisar<\/span>/);
  assert.match(page, /activeCategory !== "account" && <div className="xl:hidden">/);
  assert.match(page, /activeCategory === "account" \? profileSummary/);
});

test("o salvamento geral do perfil flutua quando ha alteracoes e inclui Tipos de Negocio", () => {
  const page = readFileSync(new URL("./meu-perfil.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

  assert.doesNotMatch(page, /Salvar Tipos de Negócio/);
  assert.match(page, /placeholderData: DEFAULT_STRATEGIC_CELL_TYPES/);
  assert.match(routes, /strategicCellTablesPromise \?\?= ensureStrategicCellTablesInternal/);
  assert.match(page, /openProfileCategory\("company"\);[\s\S]*?CNPJ obrigatório/);
  assert.match(page, /const hasUnsavedChanges = hasProfileChanges \|\| hasStrategicCellChanges/);
  assert.match(page, /if \(hasStrategicCellChanges\) updateStrategicCellPreferencesMutation\.mutate\(\)/);
  assert.match(page, /hasUnsavedChanges &&[\s\S]*?fixed bottom-4 right-4 z-50/);
  assert.match(page, /"Salvar alterações"/);
});
