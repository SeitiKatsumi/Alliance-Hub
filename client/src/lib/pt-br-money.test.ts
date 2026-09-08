import assert from "node:assert/strict";
import test from "node:test";
import { formatPtBrMoneyInput } from "./pt-br-money";

test("formata moeda pt-BR enquanto digita e completa os centavos ao sair", () => {
  assert.equal(formatPtBrMoneyInput("100000"), "100.000");
  assert.equal(formatPtBrMoneyInput("100000", true), "100.000,00");
  assert.equal(formatPtBrMoneyInput("100000,5"), "100.000,5");
  assert.equal(formatPtBrMoneyInput("R$ 100.000,5", true), "100.000,50");
});
