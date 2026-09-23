import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { calculateInitialMap, calculateMap } from "../shared/member-portfolio";
import { MAP_HISTORY_SQL, appendMapVersion, assertMapRevision, canCorrectMapBase, mapContentHash, mapRowsFromBase } from "./bia-map-history";

const calculation = calculateInitialMap(1500000, [
  { memberId: "a", nome: "João", cargos: ["Diretor", "Guardião"], tipo: "guardiao", indiceContribuicao: 12.5, pesoCapital: 100 },
  { memberId: "b", nome: "Maria", tipo: "multiplicador", indiceContribuicao: 0, pesoCapital: 0 },
]);
const base = { revisao: 1, valor_origem: calculation.valorOrigem, moeda: "BRL", divisor_multiplicador: calculation.divisorMultiplicador,
  base_economica_inicial: calculation.baseEconomicaInicial, participantes: calculation.participantes };

test("correções da base exigem papel na BIA e revisão esperada; índices ausentes não viram zero", () => {
  const bia = { diretor_alianca: { id: "d" }, aliado_built: "a" };
  assert.equal(canCorrectMapBase(bia, "d"), true);
  assert.equal(canCorrectMapBase(bia, "a"), true);
  assert.equal(canCorrectMapBase(bia, "superadmin"), false);
  assert.equal(canCorrectMapBase(bia, null), false);
  assert.throws(() => assertMapRevision(2, 1), /MAP mudou/);
  assert.throws(() => assertMapRevision(2, undefined), /MAP mudou/);
  assertMapRevision(2, 2);
  assert.throws(() => calculateInitialMap(100, [{ ...calculation.participantes[0], indiceContribuicao: null as any }]), /Preencha/);
});

test("aportes pendentes não alteram MAP; transferências incompatíveis recusam em vez de reduzir silenciosamente", () => {
  const origin = mapRowsFromBase(base);
  const initial = calculateMap([], [], origin, true);
  assert.deepEqual(calculateMap([{ memberId: "b", name: "Maria", value: 100, status: "pendente" }], [], origin, true), initial);
  const paid = calculateMap([{ memberId: "b", name: "Maria", value: 100, status: "pago" }], [], origin, true);
  assert.equal(paid.reduce((sum, p) => sum + p.value, 0), 1687600);
  const transfer = { status: "aceita", fromMemberId: "a", toMemberId: "b", value: 100 };
  assert.equal(calculateMap([], [transfer], origin, true).reduce((sum, p) => sum + p.value, 0), 1687500);
  assert.throws(() => calculateMap([], [{ ...transfer, value: 2000000 }], origin, true), /não cobre/);
  assert.deepEqual(calculateMap([], [{ ...transfer, status: "revertida" }], origin, true), initial);
});

test("migração, versões imutáveis, idempotência, revisões de aceite e concorrência em banco isolado", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  try {
    await pg.exec(`CREATE TABLE bia_map_inicial_snapshots (bia_id text PRIMARY KEY);
      CREATE TABLE bia_mou_aceites (bia_id text, membro_id text, mou_versao text, dados_contratuais jsonb,
      UNIQUE (bia_id, membro_id, mou_versao));
      INSERT INTO bia_map_inicial_snapshots VALUES ('bia');
      INSERT INTO bia_mou_aceites VALUES ('bia', 'a', 'mou1', '{"texto":"Original"}');`);
    await pg.exec(MAP_HISTORY_SQL);
    await pg.exec(MAP_HISTORY_SQL);
    const migration = readFileSync(new URL("../migrations/20260918_map_zero_versions.sql", import.meta.url), "utf8");
    const economicMigration = readFileSync(new URL("../migrations/20260923_bia_economic_structure.sql", import.meta.url), "utf8");
    const economicSql = "ALTER TABLE bia_map_inicial_snapshots ADD COLUMN IF NOT EXISTS estrutura_economica jsonb;";
    assert.ok(economicMigration.includes(economicSql));
    assert.equal(migration.replace(/\r\n/g, "\n").trim(), MAP_HISTORY_SQL.replace(economicSql+"\n", "").replace(/\r\n/g, "\n").trim());
    const record = (eventId: string, rows = mapRowsFromBase(base), tipo: "zero" | "atual" = "zero", nextBase = base) =>
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT * FROM bia_map_inicial_snapshots WHERE bia_id = 'bia' FOR UPDATE`);
        return appendMapVersion(tx, { biaId: "bia", tipo, base: nextBase, rows, eventId, reason: "Teste", actor: { name: "Diretor" }, biaName: "BIA Teste", footer: "Nota dinâmica" });
      });
    const first: any = await record("zero1");
    assert.equal(first.numero, 1);
    assert.equal(first.snapshot.footer, "");
    assert.equal((await record("zero1") as any).id, first.id);
    assert.equal((await record("no-op") as any).id, first.id);
    const originalJson = JSON.stringify(first.snapshot);
    const rows = mapRowsFromBase(base).map((row) => ({ ...row, value: row.value + 100 }));
    const one: any = await record("mov1", rows, "atual");
    assert.equal(one.numero, 1);
    assert.equal((await record("mov1", rows, "atual") as any).id, one.id);
    const two: any = await record("mov2", rows.map((row) => ({ ...row, value: row.value + 100 })), "atual");
    assert.equal(two.numero, 2);
    assert.equal(two.snapshot.footer, "Nota dinâmica");
    assert.equal(JSON.stringify((await pg.query<any>("SELECT snapshot FROM bia_map_versoes WHERE id=$1", [first.id])).rows[0].snapshot), originalJson);
    await assert.rejects(pg.exec("UPDATE bia_map_versoes SET motivo='apagado'"), /imutaveis/);
    await assert.rejects(pg.exec("DELETE FROM bia_map_versoes"), /imutaveis/);
    await pg.exec("INSERT INTO bia_mou_aceites (bia_id,membro_id,mou_versao,map_revisao) VALUES ('bia','a','mou1',1) ON CONFLICT DO NOTHING");
    await pg.exec("INSERT INTO bia_mou_aceites (bia_id,membro_id,mou_versao,map_revisao) VALUES ('bia','a','mou1',1) ON CONFLICT DO NOTHING");
    assert.equal((await pg.query<any>("SELECT count(*)::int AS n FROM bia_mou_aceites")).rows[0].n, 2);
    const edit = () => db.transaction(async (tx) => {
      const row: any = (await tx.execute(sql`SELECT revisao FROM bia_map_inicial_snapshots WHERE bia_id='bia' FOR UPDATE`)).rows[0];
      assertMapRevision(Number(row.revisao), 0);
      await tx.execute(sql`UPDATE bia_map_inicial_snapshots SET revisao=1 WHERE bia_id='bia'`);
    });
    const attempts = await Promise.allSettled([edit(), edit()]);
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((r) => r.status === "rejected").length, 1);
    assert.equal(mapContentHash([...rows].reverse()), mapContentHash(rows));
  } finally { await pg.close(); }
});
