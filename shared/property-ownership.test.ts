import test from "node:test";
import assert from "node:assert/strict";
import { calculateInitialMap } from "./member-portfolio";
import { buildPropertyInitialMapParticipants, buildPropertyOriginAllocations, normalizePropertyPartners, propertyMapIsComplete, propertyMapTotal } from "./property-ownership";

test("normaliza socios e exige MAP total de 100%", () => {
  const socios = normalizePropertyPartners([
    { id: "a", membro_id: "m1", nome: "Ana", email: "ANA@EXAMPLE.COM", map_percentual: 50, status: "aceito" },
    { id: "b", membro_id: "m2", nome: "Beto", email: "beto@example.com", map_percentual: "50", status: "aceito" },
  ]);
  assert.equal(propertyMapTotal(socios), 100);
  assert.equal(propertyMapIsComplete(socios), true);
  assert.equal(socios[0].email, "ana@example.com");
});

test("gera alocacoes imutaveis somente para socios aceitos", () => {
  const socios = normalizePropertyPartners([
    { id: "a", membro_id: "m1", nome: "Ana", map_percentual: 60, status: "aceito" },
    { id: "b", membro_id: "m2", nome: "Beto", map_percentual: 40, status: "aceito" },
  ]);
  const rows = buildPropertyOriginAllocations(socios, { a: "guardiao", b: "multiplicador" }, 500_000);
  assert.deepEqual(rows.map((row) => [row.membroId, row.percentual, row.valor]), [
    ["m1", 60, 300_000],
    ["m2", 40, 200_000],
  ]);
});

test("convite pendente conta no total, mas nao gera alocacao de origem", () => {
  const socios = normalizePropertyPartners([
    { id: "a", membro_id: "m1", nome: "Ana", map_percentual: 50, status: "aceito" },
    { id: "b", membro_id: "m2", nome: "Beto", map_percentual: 50, status: "pendente" },
  ]);
  assert.equal(propertyMapIsComplete(socios), true);
  assert.deepEqual(buildPropertyOriginAllocations(socios, { a: "guardiao", b: "multiplicador" }, 400_000), [{
    socioId: "a", membroId: "m1", nome: "Ana", papel: "guardiao", percentual: 50, valor: 200_000,
  }]);
});

test("copropriedade aceita preenche pesos do MAP Zero sem presumir indices ausentes", () => {
  const socios = normalizePropertyPartners([
    { id: "a", membro_id: "m1", nome: "Ana", map_percentual: 60, status: "aceito" },
    { id: "b", membro_id: "m2", nome: "Beto", map_percentual: 40, status: "aceito" },
  ]);
  assert.throws(() => calculateInitialMap(1000, buildPropertyInitialMapParticipants(socios, {a:"guardiao",b:"guardiao"})), /índice|Índice/);
  assert.equal(calculateInitialMap(1000, buildPropertyInitialMapParticipants(socios, {a:"guardiao",b:"guardiao"}, {a:0,b:0})).divisorMultiplicador, 0);
  assert.deepEqual(buildPropertyInitialMapParticipants(socios, { a: "guardiao", b: "multiplicador" }, { a: 2, b: 1 }), [
    { participantId: "member:m1", memberId: "m1", nome: "Ana", cargos: ["Coproprietário"], tipo: "guardiao", indiceContribuicao: 2, pesoCapital: 60 },
    { participantId: "member:m2", memberId: "m2", nome: "Beto", cargos: ["Coproprietário"], tipo: "multiplicador", indiceContribuicao: 1, pesoCapital: 0 },
  ]);
});
