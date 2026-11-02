import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { matchReceipt, normalizeReceiptFacts } from "../../../shared/receipt-matching";

test("comprovante: diferenças permanecem visíveis na escolha e após anexação automática", () => {
  const source = readFileSync(new URL("./receipt-matching.tsx", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/export function/g, "function");
  const Result = new Function("React", "CheckCircle2", transformSync(source, { loader: "tsx" }).code + "; return ReceiptMatchingResult;")
    (React, () => null);
  const facts = normalizeReceiptFacts({ valor: 121, moeda: "BRL", recebedor: "J. Santos", descricao: "Limpeza terreno", data_pagamento: "2026-11-03", situacao: "realizado", multiplas_transacoes: false });
  const matching = matchReceipt(facts, [{ id: "flow", bia: "bia", tipo: "saida", valor: 120, descricao: "Limpeza do terreno", data_pagamento: "2026-11-01", favorecido_id: { nome: "João Santos" } }], "bia");
  const result = { id: "analysis", arquivo: "comprovante.png", dados: facts, candidatos: matching.candidates, anexado: false, automatico: false, lancamentoId: null };
  const render = (patch = {}) => renderToStaticMarkup(React.createElement(Result, { result: { ...result, ...patch }, selected: "", onSelect: () => {}, disabled: false }));
  for (const html of [render(), render({ anexado: true, automatico: true, lancamentoId: matching.automaticId })]) {
    assert.match(html, /Valor próximo/);
    assert.match(html, /1,00/);
    assert.match(html, /Nome parcial\/abreviado compatível/);
    assert.match(html, /2 dias de diferença/);
    assert.match(html, /120,00/);
  }
  assert.match(render(), /Encontrei um possível lançamento/);
  assert.match(render({ anexado: true, automatico: true, lancamentoId: matching.automaticId }), /Status de pagamento preservado/);

  const sparse = { ...facts, recebedor: "Pedro Oliveira", descricao: "", data_pagamento: null };
  const possible = matchReceipt(sparse, [
    { id: "one", bia: "bia", tipo: "saida", valor: 120, descricao: "Limpeza", favorecido_id: { nome: "João Santos" } },
    { id: "two", bia: "bia", tipo: "saida", valor: 121, descricao: "Material", favorecido_id: { nome: "Ana Lima" } },
  ], "bia");
  const choices = render({ dados: sparse, candidatos: possible.candidates });
  assert.equal(possible.automaticId, null);
  assert.match(choices, /Encontrei 2 possíveis lançamentos para este comprovante/);
  assert.match(choices, /João Santos/); assert.match(choices, /Ana Lima/);
  assert.match(choices, /Nome do comprovante diferente do favorecido cadastrado/);
  assert.equal((choices.match(/type="radio"/g) || []).length, 2);
  assert.doesNotMatch(choices, /checked=/);
});
