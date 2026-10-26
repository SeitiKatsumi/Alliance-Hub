import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { transformSync } from "esbuild";

function harness(value = "+55 11999999999", props: Record<string, unknown> = {}) {
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
  const tree = module.exports.PhoneInput({ value, onChange: (next: string) => changed.push(next), required: true, ...props });
  const [select, input] = React.Children.toArray(tree.props.children) as React.ReactElement<any>[];
  return { tree, select, input, changed, api: module.exports };
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
  assert.equal(select.props["aria-label"], "País e código internacional");
  const admin = readFileSync(new URL("../pages/membros.tsx", import.meta.url), "utf8");
  const phones = admin.match(/<PhoneInput\b[^>]*(?:=>[^>]*)*?\/>/g) || [];
  assert.equal(phones.length, 3);
  for (const phone of phones) assert.doesNotMatch(phone, /bg-white|!text-brand-navy/);
});

test("onboarding usa seletor compartilhado sem perder identificação e erro acessível", () => {
  const legacy = harness("(31) 99999-9999", { inferUnprefixedDialCode: false });
  assert.equal(legacy.select.props.value, "+55");
  assert.equal(legacy.input.props.value, "(31) 99999-9999");
  assert.deepEqual(legacy.changed, []);
  assert.equal(harness("+351 912345678", { inferUnprefixedDialCode: false }).select.props.value, "+351");
  const { input, changed } = harness("", { id: "onboarding-phone", "aria-invalid": true, "aria-describedby": "onboarding-phone-error" });
  assert.equal(input.props.id, "onboarding-phone");
  assert.equal(input.props.type, "tel");
  assert.equal(input.props["aria-invalid"], true);
  assert.equal(input.props["aria-describedby"], "onboarding-phone-error");
  input.props.onChange({ target: { value: "11999999999" } });
  assert.deepEqual(changed, ["+55 11999999999"]);
  const source = readFileSync(new URL("../pages/initial-onboarding.tsx", import.meta.url), "utf8");
  assert.match(source, /<PhoneInput id="onboarding-phone"/);
  assert.doesNotMatch(source, /<Input id="onboarding-phone"/);
  assert.match(source, /normalizeOnboardingPhone\(profile.telefone\)/);
});

test("países aparecem por extenso com DDI, sem perder espaço para o número", () => {
  const { tree, select, changed } = harness("+27 999493070");
  const options = React.Children.toArray(select.props.children) as React.ReactElement<any>[];
  const labels = options.map(option => React.Children.toArray(option.props.children).join(""));
  assert.ok(labels.includes("Brasil (+55)"));
  assert.ok(labels.includes("África do Sul (+27)"));
  assert.ok(labels.includes("Emirados Árabes Unidos (+971)"));
  assert.ok(labels.every(label => !/^[A-Z]{2}\s/.test(label)));
  assert.equal(select.props.value, "+27");
  assert.deepEqual(changed, []); // Mostrar o país nunca regrava um telefone existente.
  assert.match(tree.props.className, /flex-col/);
  assert.match(select.props.className, /w-full/);
  assert.doesNotMatch(select.props.className, /w-\[104px\]/);
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
