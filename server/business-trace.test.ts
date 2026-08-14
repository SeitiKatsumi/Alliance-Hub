import assert from "node:assert/strict";
import test from "node:test";
import { createBusinessTraceCode, traceObjectTypeForRegistry, traceStageLabel } from "./business-trace-domain";

test("gera código TRC estável no formato público", () => {
  assert.equal(createBusinessTraceCode(Buffer.from("0102030405", "hex")), "TRC-0102030405");
});

test("mantém os tipos dos objetos separados da jornada", () => {
  assert.equal(traceObjectTypeForRegistry({ tipo: "demanda" }), "demanda");
  assert.equal(traceObjectTypeForRegistry({ tipo: "oportunidade" }), "oportunidade");
  assert.equal(traceObjectTypeForRegistry({ tipo: "oba" }), "oba");
});

test("gera nomes humanos para as etapas", () => {
  assert.equal(traceStageLabel("ro"), "Reunião de Oportunidades");
  assert.equal(traceStageLabel("oportunidade", "em_analise"), "Oportunidade: em analise");
});
