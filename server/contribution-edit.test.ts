import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editLinkedContribution, type ContributionEditDependencies } from "./contribution-edit";
import { relatedContributionIds } from "../shared/contribution-edit";

function fixture() {
  const entries = new Map<string, any>([
    ["expense", { id: "expense", bia: "bia", tipo: "saida", valor: "100", status: "agendado", Categoria: [] }],
    ["a", { id: "a", bia: "bia", tipo: "entrada", valor: "50", favorecido_id: "member-a", membro_responsavel: "original", status: "agendado", Categoria: [] }],
    ["b", { id: "b", bia: "bia", tipo: "entrada", valor: "50", favorecido_id: "member-b", membro_responsavel: "operator-b", status: "pago", Categoria: [], data_pagamento: "2026-10-01" }],
  ]);
  const lot = { id: "lot", bia_id: "bia", estado: "concluido", movimentos: [...entries.values()].map(e => structuredClone(e)) };
  const audit: any[] = [], batches: any[] = [], protectedIds: string[] = [];
  let locked = false;
  const deps: ContributionEditDependencies = {
    lot: async () => lot,
    lock: async (_bia, work) => { locked = true; try { return await work(); } finally { locked = false; } },
    access: async id => { assert.ok(locked); return structuredClone(entries.get(id)); },
    phase: async () => {}, member: async id => id === "operator" ? { id } : null,
    category: async id => id === "7" ? { id, Tipo_de_categoria: "Entrada" } : null,
    protect: async id => { protectedIds.push(id); },
    update: async (id, patch) => { entries.set(id, { ...entries.get(id), ...patch }); return entries.get(id); },
    batch: async (_id, _patch, rows) => { assert.ok(locked); batches.push(structuredClone(rows)); for (const row of rows) entries.set(row.id, { ...entries.get(row.id), ...row }); return rows; },
    audit: async (...args) => { audit.push(structuredClone(args)); },
  };
  return { entries, lot, audit, batches, protectedIds, deps };
}

test("categoria em conjunto: um lote atômico, só entradas da mesma despesa, preserva valores, pagadores e pagamentos dos demais", async () => {
  const f = fixture(), expenseBefore = structuredClone(f.entries.get("expense")), bBefore = structuredClone(f.entries.get("b"));
  const result = await editLinkedContribution("a", { Categoria: [{ categorias_id: 7 }], status: "pago", data_pagamento: "2026-10-30", membro_responsavel: "forged" }, true, "operator", f.deps);
  assert.deepEqual(result?.updatedIds, ["a", "b"]);
  assert.equal(f.batches.length, 1);
  assert.deepEqual(f.entries.get("expense"), expenseBefore);
  assert.deepEqual(f.entries.get("b"), { ...bBefore, Categoria: [{ categorias_id: "7" }] });
  assert.equal(f.entries.get("a").membro_responsavel, "operator");
  assert.equal(f.entries.get("a").favorecido_id, "member-a");
  assert.equal(f.entries.get("a").valor, "50");
  assert.equal(f.audit[0][2].membro_responsavel, "original");
  assert.ok(f.audit.some(row => row[1] === "pagamento_confirmado" && row[3].membro_responsavel === "operator"));
  assert.deepEqual(f.protectedIds, ["a", "b"]);
  assert.equal(f.lot.movimentos[1].status, "agendado", "snapshot original imutável");
});

test("recebimento individual deriva responsável da sessão; edição posterior não reatribui autoria", async () => {
  const f = fixture();
  await editLinkedContribution("a", { status: "pago", membro_responsavel: "forged" }, false, "operator", f.deps);
  assert.equal(f.entries.get("a").membro_responsavel, "operator");
  await editLinkedContribution("a", { status: "pago", membro_responsavel: "someone-else", descricao: "Correção" }, false, "other", f.deps);
  assert.equal(f.entries.get("a").membro_responsavel, "operator");
  assert.equal(f.batches.length, 0);
  assert.equal(f.entries.get("b").membro_responsavel, "operator-b");
});

test("categoria isolada não altera os demais; remover categoria em conjunto é explícito", async () => {
  const f = fixture();
  await editLinkedContribution("a", { Categoria: [{ categorias_id: 7 }], membro_responsavel: "forged" }, false, "operator", f.deps);
  assert.deepEqual(f.entries.get("b").Categoria, []);
  assert.equal(f.entries.get("a").membro_responsavel, "original");
  await editLinkedContribution("a", { Categoria: [] }, true, "operator", f.deps);
  assert.deepEqual(f.entries.get("a").Categoria, []);
});

test("lotes com despesas espelhadas não propagam entre despesas diferentes", () => {
  const lot = { movimentos: [{ id: "e1", tipo: "saida" }, { id: "a", tipo: "entrada", despesa_origem_id: "e1" }, { id: "e2", tipo: "saida" }, { id: "b", tipo: "entrada", despesa_origem_id: "e2" }] };
  assert.deepEqual(relatedContributionIds(lot, "a"), ["a"]);
  assert.throws(() => relatedContributionIds(lot, "e1"));
});

test("nega autorização, vínculo cruzado, fase, categoria de saída/outra BIA e guarda antes de escrever", async () => {
  for (const fail of ["access", "cross-bia", "phase", "category-out", "category-other", "guard", "pending"]) {
    const f = fixture();
    if (fail === "access") f.deps.access = async id => id === "b" ? null : f.entries.get(id);
    if (fail === "cross-bia") f.entries.get("b").bia = "other";
    if (fail === "phase") f.deps.phase = async () => { throw Error("fase"); };
    if (fail === "category-out") f.deps.category = async () => ({ Tipo_de_categoria: "Saída" });
    if (fail === "category-other") f.deps.category = async () => ({ Tipo_de_categoria: "Entrada", bia_id: "other" });
    if (fail === "guard") f.deps.protect = async () => { throw Error("protegido"); };
    if (fail === "pending") f.lot.estado = "pendente";
    await assert.rejects(() => editLinkedContribution("a", { Categoria: [{ categorias_id: 7 }] }, true, "operator", f.deps));
    assert.equal(f.batches.length, 0, fail); assert.equal(f.audit.length, 0, fail);
  }
});

test("sem membro autenticado não inventa responsável; falha remota conserva intenção e não registra sucesso", async () => {
  const f = fixture();
  await assert.rejects(() => editLinkedContribution("a", { status: "pago" }, false, null, f.deps));
  assert.equal(f.audit.length, 0);
  f.deps.batch = async () => { throw Error("resposta perdida"); };
  await assert.rejects(() => editLinkedContribution("a", { Categoria: [] }, true, "operator", f.deps));
  assert.equal(f.audit.length, 2);
  assert.ok(f.audit.every(row => row[1] === "edicao_aporte_solicitada"));
  assert.equal(f.entries.get("a").status, "agendado");
});

test("rota usa sessão, guardas e motor MAP também em lote; interface mantém escopo opt-in", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  const route = source.slice(source.indexOf('app.patch("/api/fluxo-caixa/:id"'), source.indexOf("function normalizePaymentText"));
  assert.match(route, /editLinkedContribution.*req\.session as any\)\.membroId/);
  assert.match(route, /protectInitialEntry\(id, change\).*protectExpenseEntry\(db, id, change\)/);
  assert.match(route, /update:.*mapFinancialWrite!/);
  assert.match(route, /batch:.*mapFinancialWrite!/);
  const ui = readFileSync("client/src/pages/fluxo-caixa.tsx", "utf8");
  assert.match(ui, /applyCategoryToRelated, setApplyCategoryToRelated\] = useState\(false\)/);
  assert.match(ui, /payload\.aplicar_categoria_aos_aportes = applyCategoryToRelated/);
  assert.match(ui, /automaticResponsible=\{isLinkedContribution/);
});
