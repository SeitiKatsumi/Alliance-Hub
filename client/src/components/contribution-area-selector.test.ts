import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSync, transformSync } from "esbuild";
import { getAllContributionAreas, getPublicContributionAreas } from "../../../shared/contribution-areas";
import { buildInitialOnboardingProfileFields } from "../../../shared/initial-onboarding";

const selectorPath = new URL("./contribution-area-selector.tsx", import.meta.url);
const source = readFileSync(new URL("./contribution-area-info.tsx", import.meta.url), "utf8");
const code = buildSync({
  entryPoints: [fileURLToPath(selectorPath)],
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
}).outputFiles[0].text;
const bundled = { exports: {} as any };
new Function("require", "module", "exports", code)(createRequire(import.meta.url), bundled, bundled.exports);
const Selector = bundled.exports.ContributionAreaSelector;

function elements(node: any): any[] {
  return Array.isArray(node) ? node.flatMap(elements) : React.isValidElement(node)
    ? [node, ...elements((node.props as any).children)] : [];
}

test("onboarding oferece 20 áreas e um botão de informação separado para cada área", () => {
  const html = renderToStaticMarkup(React.createElement(Selector, { value: [], onChange: () => assert.fail("consulta não grava") }));
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 20);
  assert.equal((html.match(/aria-label="Informações sobre /g) || []).length, 20);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
  for (const area of getAllContributionAreas()) assert.ok(html.includes(`Informações sobre ${area.displayName}`));
  assert.match(html, /não atribuem cargos ou permissões/);
  assert.match(html, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.equal(getPublicContributionAreas().length, 16, "ofertas públicas não mudam");
});

test("lideranças selecionam e removem valores canônicos sem modificar outras escolhas", () => {
  for (const area of getAllContributionAreas().filter(area => area.iconKey === "leadership")) {
    const changes: string[][] = [];
    const selection = (value: string[]) => elements(Selector({ value, onChange: (v: string[]) => changes.push(v) }))
      .find(node => node.props["data-testid"] === `onboarding-contribution-leadership-${area.displayName}`);
    selection(["Alianças de Projeto"]).props.onClick();
    assert.ok(changes[0].includes(area.value));
    assert.ok(changes[0].includes("Alianças de Projeto"));
    selection(changes[0]).props.onClick();
    assert.deepEqual(changes[1], ["Alianças de Projeto"]);
    const fields = buildInitialOnboardingProfileFields({}, { areas: changes[0] });
    assert.deepEqual(fields.tipos_alianca, changes[0]);
    assert.ok(!("role" in fields) && !("diretores" in fields) && !("permissions" in fields));
  }
});

test("ajuda compartilha explicações do Perfil e não aciona seleção por clique ou teclado", () => {
  const profile = readFileSync(new URL("../pages/meu-perfil.tsx", import.meta.url), "utf8");
  assert.match(profile, /import \{ ContributionAreaInfo \} from "@\/components\/contribution-area-info"/);
  assert.doesNotMatch(profile, /const AREA_INFO_CONFIG/);
  let opened = false;
  const scope = { React, useState: () => [false, (v: any) => { opened = typeof v === "function" ? v(opened) : v; }],
    useRef: () => ({ current: null }), useEffect: () => {}, Info: "svg",
    Popover: "section", PopoverTrigger: "span", PopoverContent: "aside" };
  const helpCode = transformSync(source.slice(source.indexOf("const AREA_INFO_CONFIG")).replace("export function", "function"), { loader: "tsx" }).code;
  const Help = new Function(...Object.keys(scope), helpCode + ";return ContributionAreaInfo;")(...Object.values(scope));
  for (const area of getAllContributionAreas()) {
    const tree = Help({ label: area.displayName });
    const nodes = elements(tree);
    const button = nodes.find(node => node.type === "button");
    opened = false;
    button.props.onPointerEnter({ pointerType: "touch" });
    assert.equal(opened, false, "toque não simula hover e não fecha a ajuda no clique");
    let prevented = false, stopped = false;
    button.props.onClick({ preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
    assert.ok(prevented && stopped);
    assert.equal(opened, true);
    button.props.onPointerLeave({ pointerType: "touch" });
    assert.equal(opened, true);
    for (const key of ["Enter", " "]) {
      stopped = false;
      button.props.onKeyDown({ key, stopPropagation: () => { stopped = true; } });
      assert.ok(stopped);
    }
    const content = nodes.find(node => node.type === "aside");
    assert.match(content.props.className, /max-w-\[calc\(100vw-2rem\)\]/);
    assert.match(content.props.className, /overflow-y-auto/);
    assert.ok(renderToStaticMarkup(content).includes(area.displayName));
  }
});
