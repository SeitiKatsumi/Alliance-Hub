import assert from "node:assert/strict";
import test from "node:test";
import { formatBrazilianCep, mergeViaCepAddress } from "./property-address";

test("formata CEP e preenche o endereço retornado pelo ViaCEP", () => {
  assert.deepEqual(formatBrazilianCep("30130-010"), { digits: "30130010", formatted: "30130-010" });
  assert.deepEqual(mergeViaCepAddress({ cep: "30130010", numero: "120" }, {
    cep: "30130-010",
    logradouro: "Avenida Afonso Pena",
    bairro: "Centro",
    localidade: "Belo Horizonte",
    uf: "MG",
  }), {
    cep: "30130-010",
    numero: "120",
    endereco: "Avenida Afonso Pena",
    complemento: undefined,
    bairro: "Centro",
    cidade: "Belo Horizonte",
    estado: "MG",
    pais: "Brasil",
  });
});

test("CEP inválido ou incompleto não apaga o endereço manual", () => {
  const manual = { cep: "30130", endereco: "Rua informada", cidade: "Belo Horizonte" };
  assert.strictEqual(mergeViaCepAddress(manual, { erro: true }), manual);
  assert.deepEqual(formatBrazilianCep("30a13"), { digits: "3013", formatted: "3013" });
});
