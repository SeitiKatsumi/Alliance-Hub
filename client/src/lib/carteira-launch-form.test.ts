import test from "node:test";
import assert from "node:assert/strict";
import { propertyLaunchForm, propertyLaunchRequest } from "./carteira-launch-form";

const launch = { id: "launch-1", tipo: "despesa", categoria: "Condomínio", valor: 699.99, data: "2026-10-16", status: "pago", descricao: "Condomínio", data_vencimento: "2026-10-20", data_pagamento: "2026-10-16", observacao: "Importado" };

test("edição preenche valores e datas, altera o mesmo ID sem substituir origem/anexos/proprietário", () => {
  const form = propertyLaunchForm(launch);
  assert.equal(form.valor, "699,99");
  assert.equal(form.data_pagamento, launch.data_pagamento);
  assert.equal(form.observacao, launch.observacao);
  const request = propertyLaunchRequest({ ...form, valor: "1.250,50", descricao: "Corrigido" }, "property", launch.id);
  assert.equal(request.method, "PATCH");
  assert.equal(request.url, "/api/carteira/lancamentos/launch-1");
  assert.equal(request.body.valor, 1250.5);
  assert.equal(propertyLaunchRequest({ ...form, valor: "1.250" }, "property", launch.id).body.valor, 1250);
  assert.equal(propertyLaunchRequest({ ...form, valor: "699.99" }, "property", launch.id).body.valor, 699.99);
  for (const key of ["imovel_id", "origem", "anexos", "owner_user_id", "createdAt"]) assert.equal(key in request.body, false);
  assert.equal(launch.valor, 699.99);
  assert.deepEqual(propertyLaunchForm(launch), form); // reopening discards unsaved edits
});

test("novo lançamento não herda ID nem valores de edição; datas podem ser removidas explicitamente", () => {
  const empty = propertyLaunchForm();
  assert.equal(empty.valor, "");
  const request = propertyLaunchRequest({ ...empty, valor: "100", descricao: "Nova despesa" }, "property");
  assert.equal(request.method, "POST");
  assert.equal(request.body.data_pagamento, null);
  assert.equal(propertyLaunchRequest({ ...propertyLaunchForm(launch), data_vencimento: "" }, "property", launch.id).body.data_vencimento, null);
});

test("valor inválido não é enviado, centavos são preservados e erros permitem nova tentativa", () => {
  for (const valor of ["", "0", "-1", "Infinity", "abc", "1,2,3"]) assert.throws(() => propertyLaunchRequest({ ...propertyLaunchForm(launch), valor }, "property", launch.id));
  for (const valor of [0.01, 450, 699.99, 1250, 1234567.89]) {
    const form = propertyLaunchForm({ ...launch, valor });
    assert.equal(propertyLaunchRequest(form, "property", launch.id).body.valor, valor);
    assert.deepEqual(propertyLaunchRequest(form, "property", launch.id), propertyLaunchRequest(form, "property", launch.id));
  }
});
