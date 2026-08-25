import test from "node:test";
import assert from "node:assert/strict";
import { buildPropertyOriginAllocations, normalizePropertyPartners, propertyMapIsComplete, propertyMapTotal } from "./property-ownership";

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
