import assert from "node:assert/strict";
import test from "node:test";
import { calcularAura } from "./aura-lexico";

function avaliacao(id: string, palavras: string[]) {
  return { avaliador_membro_id: id, palavras };
}

test("diversidade positiva aumenta amplitude sem diluir a dimensao", () => {
  const aura = calcularAura([
    avaliacao("a1", ["Competente", "Organizado"]),
    avaliacao("a2", ["Competente"]),
  ]);

  assert.equal(aura.scores_reputacionais.T, 100);
  assert.equal(aura.T, 100);
  assert.equal(aura.amplitude_reputacional.T, 2);
  assert.equal(aura.convergencia_reputacional.T, 62.5);
});

test("penalidade negativa validada compoe o denominador reputacional", () => {
  const aura = calcularAura([
    avaliacao("a1", ["Competente"]),
    avaliacao("a2", ["Desorganizado"]),
  ]);

  assert.equal(aura.pontos_positivos.T, 1);
  assert.equal(aura.penalidades_negativas.T, 1);
  assert.equal(aura.scores_reputacionais.T, 50);
  assert.equal(aura.T, 50);
});

test("um avaliador com cobertura completa fica limitado pela confianca inicial", () => {
  const aura = calcularAura([
    avaliacao("a1", ["Competente", "Comunicativo", "Proativo"]),
  ]);

  assert.equal(aura.cobertura_dimensional, 100);
  assert.equal(aura.score, 69);
  assert.equal(aura.confianca, "Confian\u00e7a Inicial");
  assert.equal(aura.faixa, "Aura Confi\u00e1vel");
});

test("cinco avaliadores convergentes podem formar Aura Suprema", () => {
  const aura = calcularAura(
    Array.from({ length: 5 }, (_, index) =>
      avaliacao(`a${index + 1}`, ["Competente", "Comunicativo", "Proativo"])
    )
  );

  assert.equal(aura.score, 100);
  assert.equal(aura.faixa, "Aura Suprema");
  assert.equal(aura.elegivel_aura_suprema, true);
  assert.deepEqual(aura.convergencia_reputacional, { T: 100, R: 100, C: 100 });
});

test("Aura Suprema exige convergencia minima em duas dimensoes", () => {
  const tecnica = ["Competente", "Organizado", "Eficiente", "Detalhista", "Preciso"];
  const relacional = ["Comunicativo", "Cordial", "Prestativo", "Colaborativo", "Educado"];
  const comportamental = ["Proativo", "Determinado", "Resiliente", "Engajado", "Corajoso"];
  const aura = calcularAura(
    Array.from({ length: 5 }, (_, index) =>
      avaliacao(`a${index + 1}`, [tecnica[index], relacional[index], comportamental[index]])
    )
  );

  assert.equal(aura.cobertura_dimensional, 100);
  assert.equal(aura.score, 89);
  assert.equal(aura.elegivel_aura_suprema, false);
  assert.ok(Object.values(aura.convergencia_reputacional).every((valor) => valor < 60));
});

test("cobertura relacional e comportamental aplica teto de 79", () => {
  const aura = calcularAura([
    avaliacao("a1", ["Comunicativo", "Proativo"]),
    avaliacao("a2", ["Comunicativo", "Proativo"]),
  ]);

  assert.equal(aura.cobertura_dimensional, 60);
  assert.equal(aura.aura_observada, 100);
  assert.equal(aura.score, 79);
  assert.deepEqual(aura.dimensoes_sem_evidencia, ["T"]);
});

test("termo critico fica em curadoria e nao reduz automaticamente a dimensao", () => {
  const aura = calcularAura(
    Array.from({ length: 5 }, (_, index) =>
      avaliacao(`a${index + 1}`, ["Competente", "Comunicativo", "Proativo", "antietico"])
    )
  );

  assert.equal(aura.penalidades_negativas.C, 0);
  assert.equal(aura.C, 100);
  assert.equal(aura.score, 89);
  assert.equal(aura.elegivel_aura_suprema, false);
  assert.equal(aura.pontos_atencao_reputacional[0]?.status, "em_curadoria_reputacional");
});
