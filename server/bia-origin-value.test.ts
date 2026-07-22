import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBiaOriginPatch } from "./bia-origin-value";

test("preserva o valor salvo quando o campo nao foi enviado", () => {
  assert.deepEqual(normalizeBiaOriginPatch({ nome_bia: "BIA" }), {
    provided: false,
    shouldUpdate: false,
  });
});

test("preserva o valor salvo quando o editor envia null ou vazio", () => {
  assert.deepEqual(normalizeBiaOriginPatch({ valor_origem: null }), {
    provided: true,
    shouldUpdate: false,
  });
  assert.deepEqual(normalizeBiaOriginPatch({ valor_origem: "  " }), {
    provided: true,
    shouldUpdate: false,
  });
});

test("aceita zero explicito e valores nos formatos da API e pt-BR", () => {
  assert.deepEqual(normalizeBiaOriginPatch({ valor_origem: 0 }), {
    provided: true,
    shouldUpdate: true,
    value: 0,
  });
  assert.equal(normalizeBiaOriginPatch({ valor_origem: "513429.18" }).value, 513429.18);
  assert.equal(normalizeBiaOriginPatch({ valor_origem: "513.429,18" }).value, 513429.18);
});

test("rejeita valor invalido ou negativo", () => {
  assert.equal(normalizeBiaOriginPatch({ valor_origem: "abc" }).error, "Valor de origem invalido.");
  assert.equal(normalizeBiaOriginPatch({ valor_origem: -1 }).error, "Valor de origem invalido.");
});
