import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCarteiraAlertUpdate } from "./carteira-alertas";

test("registrar uma acao coloca o alerta em andamento", () => {
  assert.deepEqual(normalizeCarteiraAlertUpdate({ acao_registrada: "Solicitar a matrícula atualizada." }), {
    status: "em_andamento",
    acaoRegistrada: "Solicitar a matrícula atualizada.",
    registrarAcao: true,
    ignorar: false,
  });
});

test("ignorar o alerta nao registra uma acao vazia", () => {
  assert.deepEqual(normalizeCarteiraAlertUpdate({ status: "ignorado", acao_registrada: "texto descartado" }), {
    status: "ignorado",
    registrarAcao: false,
    ignorar: true,
  });
});

test("mantem os demais estados validos e rejeita estado desconhecido", () => {
  assert.equal(normalizeCarteiraAlertUpdate({ status: "resolvido" }).status, "resolvido");
  assert.equal(normalizeCarteiraAlertUpdate({ status: "qualquer" }).status, "aberto");
});

test("limita a descricao da acao", () => {
  const update = normalizeCarteiraAlertUpdate({ acao_registrada: "a".repeat(1200) });
  assert.equal(update.acaoRegistrada?.length, 1000);
});
