import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { splitExpense } from "../../../shared/expense-contributions";

test("prévia da despesa mostra cada aporte, conserva centavos e informa total inválido", () => {
  const source = readFileSync(new URL("./expense-contributions.tsx", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const pass = ({ children }: any) => React.createElement("div", null, children);
  const props = { amount: 100, dueDate: "2026-10-26", options: ["a", "b", "c"].map(value => ({ value, label: `Pessoa ${value}` })), map: [], cppOptions: [], onChange() {}, value: { mode: "equal", participants: ["a", "b", "c"].map(memberId => ({ memberId, value: "" })), dueDate: "", cppType: "" } };
  const Component = new Function("React", "splitExpense", "SearchableNameSelect", "Button", "Input", "Label", "Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue", transformSync(source, { loader: "tsx" }).code + "; return ExpenseContributionsFields;")(React, splitExpense, () => null, pass, () => null, pass, pass, pass, pass, pass, pass);
  const render = (value = props.value) => renderToStaticMarkup(React.createElement(Component, { ...props, value }));
  const html = render(); assert.match(html, /Pessoa a: R\$\s*33,34/); assert.match(html, /Pessoa b: R\$\s*33,33/); assert.match(html, /Total de aportes: R\$\s*100,00/); assert.doesNotMatch(html, /registrados como pendentes/);
  assert.match(render({ ...props.value, mode: "manual", participants: [{ memberId: "a", value: "99,99" }] }), /soma dos aportes deve ser igual/);
  const inherited = renderToStaticMarkup(React.createElement(Component, { ...props, inheritedPreview: () => [{memberId:"a",amount:100}] }));
  assert.match(inherited, /Pessoa a: R\$\s*100,00/);
  assert.doesNotMatch(inherited, /Divisão dos aportes|Adicionar participante|Tipo de CPP dos aportes|registrados como pendentes/);
  const page = readFileSync("client/src/pages/fluxo-caixa.tsx", "utf8");
  assert.match(page, /mirrorExpenses: true/);
  assert.match(page, /cppType: formTiposCpp == null \? null : String\(formTiposCpp\)/);
  assert.doesNotMatch(page, /singleExpense=\{/);
});
