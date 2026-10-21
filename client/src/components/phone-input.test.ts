import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { transformSync } from "esbuild";

function harness(value = "+55 11999999999") {
  const module = { exports: {} as any };
  const code = transformSync(readFileSync(new URL("./phone-input.tsx", import.meta.url), "utf8"), {
    loader: "tsx", format: "cjs", jsx: "automatic",
  }).code;
  const require = (id: string) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id.endsWith("/input")) return { Input: "input" };
    if (id.endsWith("/utils")) return { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") };
    throw new Error(`Unexpected import: ${id}`);
  };
  new Function("require", "module", "exports", code)(require, module, module.exports);
  const changed: string[] = [];
  const tree = module.exports.PhoneInput({ value, onChange: (next: string) => changed.push(next), required: true });
  const [select, input] = React.Children.toArray(tree.props.children) as React.ReactElement<any>[];
  return { select, input, changed, api: module.exports };
}

test("códigos telefônicos usam o mesmo par de cores do tema no seletor e em cada opção", () => {
  const { select } = harness();
  assert.match(select.props.className, /\bbg-background\b/);
  assert.match(select.props.className, /\btext-foreground\b/);
  assert.match(select.props.className, /\[&>option\]:bg-background/);
  assert.doesNotMatch(select.props.className, /bg-white|text-white|text-brand-navy/);
  const options = React.Children.toArray(select.props.children) as React.ReactElement<any>[];
  assert.ok(options.length > 50);
  for (const option of options) assert.equal(option.props.className, "bg-background text-foreground");
  assert.equal(select.props["aria-label"], "Código internacional");
  const admin = readFileSync(new URL("../pages/membros.tsx", import.meta.url), "utf8");
  const phones = admin.match(/<PhoneInput\b[^>]*(?:=>[^>]*)*?\/>/g) || [];
  assert.equal(phones.length, 3);
  for (const phone of phones) assert.doesNotMatch(phone, /bg-white|!text-brand-navy/);
});

test("ajuste de contraste preserva seleção, digitação, normalização e obrigatoriedade", () => {
  const h = harness("+351 912345678");
  assert.equal(h.select.props.value, "+351");
  assert.equal(h.input.props.value, "912345678");
  assert.equal(h.input.props.required, true);
  h.select.props.onChange({ target: { value: "+55" } });
  h.input.props.onChange({ target: { value: "912 345-679" } });
  assert.deepEqual(h.changed, ["+55 912345678", "+351 912 345-679"]);
  assert.equal(h.api.normalizePhoneValue("+81 9012345678"), "+81 9012345678");
  assert.equal(h.api.normalizePhoneValue(""), "");
  assert.equal(h.api.hasInternationalDialCode("+55 11999999999"), true);
});
