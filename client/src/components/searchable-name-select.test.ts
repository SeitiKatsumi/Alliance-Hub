import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchableName, searchableNameFilter, sortSearchableNameOptions } from "./searchable-name-select";

test("ordena nomes alfabeticamente em pt-BR e preserva ações fixas no início", () => {
  const sorted = sortSearchableNameOptions([
    { value: "2", label: "Vilma Costa" },
    { value: "1", label: "Átila Frois" },
    { value: "none", label: "Definir depois", pinned: true },
    { value: "3", label: "Alessandro Gomes" },
    { value: "4", label: "  Abner Victor  " },
  ]);
  assert.deepEqual(sorted.map((option) => option.value), ["none", "4", "3", "1", "2"]);
  assert.equal(sorted[1].label, "Abner Victor");
});

test("não repete a mesma pessoa quando fontes de acesso se sobrepõem", () => {
  const sorted = sortSearchableNameOptions([
    { value: "member-1", label: "Ana" },
    { value: "member-1", label: "Ana duplicada" },
  ]);
  assert.deepEqual(sorted.map((option) => option.value), ["member-1"]);
});

test("pesquisa nomes sem diferenciar acentos ou maiúsculas", () => {
  assert.equal(normalizeSearchableName("  JOÃO Átila  "), "joao atila");
  assert.equal(searchableNameFilter("", "joao", ["João Pedro"]), 1);
  assert.equal(searchableNameFilter("", "ATILA", ["Átila Frois"]), 1);
  assert.equal(searchableNameFilter("", "rodrigo", ["Átila Frois"]), 0);
});
