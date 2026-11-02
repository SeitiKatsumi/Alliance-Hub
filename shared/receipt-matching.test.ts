import test from "node:test";
import assert from "node:assert/strict";
import { matchReceipt, normalizeReceiptFacts, receiptFlowFingerprint } from "./receipt-matching";
const facts = normalizeReceiptFacts({ valor: 120, moeda: "BRL", data_pagamento: "2026-11-01", pagador: "Maria Silva", recebedor: "João Santos", descricao: "Limpeza terreno", situacao: "realizado", multiplas_transacoes: false });
const row = { id: "flow", bia: "bia", tipo: "saida", natureza: "caixa", valor: "120.00", status: "pendente", descricao: "Limpeza do terreno", data_pagamento: "2026-11-01", favorecido_id: { id: "person", nome: "João Santos" } };
test("comprovante: automático exige sinais fortes e não aceita conflitos ou candidatos de outra BIA", () => {
  assert.equal(matchReceipt(facts, [row, { ...row, id: "foreign", bia: "other" }], "bia").automaticId, "flow");
  for (const change of [{ valor: 130 }, { recebedor: "Outra Pessoa" }, { data_pagamento: "2026-11-05" }, { moeda: null }, { situacao: "agendado" }, { multiplas_transacoes: true }])
    assert.equal(matchReceipt({ ...facts, ...change } as any, [row], "bia").automaticId, null);
  const oppositeDate = matchReceipt({ ...facts, descricao: "" }, [{ ...row, data_pagamento: null, data_vencimento: facts.data_pagamento }], "bia");
  assert.equal(oppositeDate.automaticId, null);
  assert.ok(!oppositeDate.candidates[0].motivos.some(reason => reason.includes("data")));
});

test("comprovante: aceita centavos ou poucos reais, limitados a R$5 e 2%, sem alterar valores", () => {
  for (const amount of [119.99, 120.01, 118, 122, 122.4]) {
    const result = matchReceipt(facts, [{ ...row, valor: amount }], "bia");
    assert.equal(result.automaticId, "flow");
    assert.match(result.candidates[0].motivos.join(" · "), /Valor próximo \(diferença de R\$/);
    assert.equal(result.candidates[0].valor, amount);
  }
  assert.equal(matchReceipt(facts, [{ ...row, valor: 122.41 }], "bia").automaticId, null);
  const larger = { ...facts, valor: 1000 };
  assert.equal(matchReceipt(larger, [{ ...row, valor: 1005 }], "bia").automaticId, "flow");
  assert.equal(matchReceipt(larger, [{ ...row, valor: 1005.01 }], "bia").automaticId, null);
  const small = { ...facts, valor: 10 };
  assert.equal(matchReceipt(small, [{ ...row, valor: 10.2 }], "bia").automaticId, "flow");
  assert.equal(matchReceipt(small, [{ ...row, valor: 10.21 }], "bia").automaticId, null);
  assert.equal(row.valor, "120.00");
});

test("comprovante: nomes parciais, iniciais e dados ausentes podem ser compensados por outros sinais", () => {
  for (const person of ["João Carlos dos Santos", "J. Santos", "João S.", "Joao Santos LTDA"]) {
    const result = matchReceipt(facts, [{ ...row, favorecido_id: { id: "p", nome: person } }], "bia");
    assert.equal(result.automaticId, "flow", person);
  }
  for (const change of [{ recebedor: "" }, { descricao: "" }, { data_pagamento: null }]) {
    assert.equal(matchReceipt({ ...facts, ...change }, [row], "bia").automaticId, "flow");
  }
  const short = matchReceipt({ ...facts, recebedor: "João", descricao: "" }, [row], "bia");
  assert.equal(short.automaticId, null);
  assert.ok(short.candidates[0].motivos.includes("Parte do nome coincide"));
  assert.equal(matchReceipt({ ...facts, recebedor: "João Souza" }, [row], "bia").automaticId, null);
  assert.equal(matchReceipt({ ...facts, recebedor: "João Pedro Santos" }, [{ ...row, favorecido_id: { nome: "João Carlos Santos" } }], "bia").automaticId, null);
  const onlyAmount = matchReceipt({ ...facts, recebedor: "", descricao: "", data_pagamento: null }, [row], "bia");
  assert.equal(onlyAmount.candidates.length, 1);
  assert.equal(onlyAmount.automaticId, null);
});

test("comprovante: aproxima datas até três dias, inclusive em virada de mês/ano, sem confundir vencimento e pagamento", () => {
  for (const payment of ["2026-10-29", "2026-11-04"]) {
    const result = matchReceipt(facts, [{ ...row, data_pagamento: payment }], "bia");
    assert.equal(result.automaticId, "flow");
    assert.ok(result.candidates[0].motivos.includes("Data próxima (3 dias de diferença)"));
  }
  assert.equal(matchReceipt({ ...facts, data_pagamento: "2027-01-01" }, [{ ...row, data_pagamento: "2026-12-30" }], "bia").automaticId, "flow");
  assert.equal(matchReceipt({ ...facts, data_pagamento: null, data_vencimento: "2026-11-01" }, [{ ...row, data_pagamento: null, data_vencimento: "2026-11-03" }], "bia").automaticId, "flow");
});

test("comprovante: valores próximos repetidos exigem escolha e sugestões mais fortes vêm primeiro", () => {
  const nearby = { ...row, id: "nearby", valor: 121, descricao: "Outro lançamento" };
  const result = matchReceipt(facts, [nearby, row], "bia");
  assert.equal(result.automaticId, null);
  assert.equal(result.candidates[0].id, "flow");
  const partialFacts = { ...facts, valor: 121, recebedor: "J. Santos", data_pagamento: "2026-11-03" };
  const partial = matchReceipt(partialFacts, [row], "bia");
  assert.equal(partial.automaticId, "flow");
  assert.ok(partial.candidates[0].motivos.includes("Nome parcial/abreviado compatível"));
});

test("comprovante: sugere por valor mesmo com outro nome e por primeiro nome mesmo sem valor", () => {
  const otherName = { ...facts, recebedor: "Pedro Oliveira", descricao: "", data_pagamento: null };
  const byValue = matchReceipt(otherName, [row, { ...row, id: "nearby", valor: 121, favorecido_id: { nome: "Ana Lima" } }], "bia");
  assert.deepEqual(byValue.candidates.map(c => c.id), ["flow", "nearby"]);
  assert.equal(byValue.automaticId, null);
  for (const candidate of byValue.candidates) assert.ok(candidate.avisos?.includes("Nome do comprovante diferente do favorecido cadastrado."));

  const firstName = { ...facts, valor: null, recebedor: "João", descricao: "", data_pagamento: null };
  const byName = matchReceipt(firstName, [row, { ...row, id: "namesake", valor: 300, favorecido_id: { nome: "João Pereira" } },
    { ...row, id: "different", favorecido_id: { nome: "Ana Lima" } }, { ...row, id: "foreign", bia: "other" }], "bia");
  assert.deepEqual(byName.candidates.map(c => c.id), ["flow", "namesake"]);
  assert.equal(byName.automaticId, null);
  for (const candidate of byName.candidates) {
    assert.ok(candidate.motivos.includes("Parte do nome coincide"));
    assert.ok(candidate.avisos?.includes("Valor do comprovante não identificado."));
  }
  const differentValue = matchReceipt({ ...firstName, valor: 180 }, [row], "bia");
  assert.equal(differentValue.candidates.length, 1);
  assert.equal(differentValue.automaticId, null);
  assert.match(differentValue.candidates[0].avisos!.join(" "), /Valor diferente \(diferença de R\$.*60,00/);
  assert.equal(matchReceipt({ ...firstName, recebedor: "" }, [row], "bia").candidates.length, 0);
});
test("comprovante: valor repetido exige escolha, valores isolados não são certeza e cancelados não são sugeridos", () => {
  assert.equal(matchReceipt(facts, [row, { ...row, id: "another", descricao: "Outro lançamento" }], "bia").automaticId, null);
  assert.equal(matchReceipt({ ...facts, recebedor: "", descricao: "", data_pagamento: null }, [row], "bia").automaticId, null);
  assert.equal(matchReceipt(facts, [{ ...row, status: "cancelado" }, { ...row, natureza: "direito" }], "bia").candidates.length, 0);
  assert.equal(matchReceipt({ ...facts, pagador: "João Santos", recebedor: "Outra Pessoa" }, [{ ...row, tipo: "entrada" }], "bia").automaticId, "flow");
});
test("comprovante: saída da IA é dados limitados, datas inválidas e campos inesperados não viram comandos", () => {
  const data = normalizeReceiptFacts({ valor: "120", moeda: "USD", data_pagamento: "2026-02-30", descricao: "x".repeat(1000), id: "foreign", status: "pago" });
  assert.equal(data.valor, null); assert.equal(data.moeda, null); assert.equal(data.data_pagamento, null);
  assert.equal(data.descricao.length, 300); assert.equal(data.multiplas_transacoes, true); assert.equal((data as any).id, undefined);
  assert.notEqual(receiptFlowFingerprint(row), receiptFlowFingerprint({ ...row, valor: 999 }));
});
