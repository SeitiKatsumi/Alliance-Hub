import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuraGuide, hasSeenAuraGuide, rememberAuraGuide } from "./aura-guide";

test("o convite é opcional e a escolha de um membro não dispensa o guia de outra pessoa", t => {
  // O renderer isolado usa o runtime JSX clássico para a ajuda já existente (ModuleInfo).
  const previous = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { value: React, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "React", previous); else Reflect.deleteProperty(globalThis, "React"); });
  const render = (memberId: string | null) => renderToStaticMarkup(React.createElement(AuraGuide, { memberId, hasScore: false, canConsult: true, onConsult: () => {} }));
  assert.match(render("membro-1"), /Quer conhecer sua Aura em 3 passos/);
  rememberAuraGuide("membro-1");
  assert.equal(hasSeenAuraGuide("membro-1"), true);
  assert.doesNotMatch(render("membro-1"), /Agora não/);
  assert.match(render("membro-1"), /Abrir guia da Aura/);
  assert.match(render("membro-2"), /Agora não/);
  assert.doesNotMatch(render(null), /Abrir guia da Aura|Agora não/);
});
