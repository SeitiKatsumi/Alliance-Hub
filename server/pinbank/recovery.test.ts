import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { BankStore } from "./store";
import { bankInputs, executeBankMethod, normalizeBankResult } from "./methods";
import { bankConfig } from "./config";
import type { BankTransport } from "./transport";
import { bankEventEvidence } from "./events";
import { reconcileDev } from "./reconcile";
import { bankReceiptPdf } from "./receipt";

async function setup() {
  const db = new PGlite();
  await db.exec(await readFile(new URL("../../migrations/20260909_pinbank_isolation.sql", import.meta.url), "utf8"));
  return { db, store: new BankStore(db as unknown as Pool, "dev") };
}
const event = (reference: string) => ({ EventId: randomUUID(), EventType: "Boleto.Liquidacao", EventVersion: "v1", EntityId: reference, OccurredAt: new Date().toISOString(), Data: { NossoNumero: reference, CodigoCliente: 3510, CodigoCanal: 47, ValorPago: 150, ModalidadeBoleto: "C", DataPagamento: "2026-09-09" } });

test("statement pagination follows provider offsets and documents expose metadata only", async () => {
  const input = bankInputs.statement.parse({ start: "2026-09-01", end: "2026-09-10", offset: 100 });
  let sent: any;
  const transport = { config: bankConfig("dev"), call: async (_path: string, body: any) => { sent = body; return { ListaTransacoes: [], HasMoreElements: true }; } } as unknown as BankTransport;
  const result: any = await executeBankMethod(transport, "statement", input, randomUUID(), 3510);
  assert.equal(sent.OffsetRetorno, 100); assert.equal(sent.QuantidadeLinhasRetorno, 100); assert.equal(result.nextOffset, 200);
  assert.throws(() => bankInputs.statement.parse({ start: "2026-02-30", end: "2026-03-02" }));
  assert.throws(() => bankInputs.statement.parse({ start: "2026-09-01", end: "2026-09-10", offset: -1 }));
  const documents: any = normalizeBankResult("documents", { StatusContaDigital: "Pendente", ListaDocumentosCadastrados: [{ CodigoDocumento: 12, TipoDocumento: 4, DescricaoDocumento: "CNPJ", StatusDocumento: "Devolvido", NomeArquivo: "fixture.pdf", MotivoDevolucao: "Ilegível", ArquivoBase64: "secret-file", KeyLoja: "secret-key" }] });
  assert.equal(documents.documents[0].rejectionReason, "Ilegível");
  assert.equal(JSON.stringify(documents).includes("secret"), false);
  const pdf = Buffer.from("%PDF-1.4\nfixture\n%%EOF").toString("base64");
  assert.ok(bankReceiptPdf(pdf).length);
  assert.throws(() => bankReceiptPdf(Buffer.from("<html>unsafe</html>").toString("base64")));
  assert.throws(() => bankReceiptPdf("invalid!"));
  const receipts: any = normalizeBankResult("receipt", [{ IdComprovante: 42, ComprovanteTipoDados: pdf }]);
  assert.equal(receipts.receipts[0].downloadable, true);
});

test("unmatched events do not starve settlement and terminal rejection accepts later evidence", async () => {
  const { db, store } = await setup();
  try {
    for (let i = 0; i < 101; i++) { const e = event("unmatched-" + i); await store.receive(e, Buffer.from(JSON.stringify(e))); }
    const op = await store.prepare("admin", "homologation", "boleto", randomUUID(), { amountCents: 15000 }, { client: 3510, channel: 47 });
    await store.claim(op.id, "admin", "homologation", op.confirmation_hash);
    await store.finish(op.id, "rejected", {}, "target");
    const e = event("target"); await store.receive(e, Buffer.from(JSON.stringify(e)));
    await store.processEvents(); await store.processEvents();
    assert.equal((await store.getOperation(op.id, "homologation")).state, "settled");
    await store.processEvents();
    const history = await db.query("SELECT count(*)::int AS count FROM pinbank_dev.operation_history WHERE next_state='settled'");
    assert.equal(history.rows[0].count, 1);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM pinbank_production.operations")).rows[0].count, 0);
    assert.equal(bankEventEvidence({ ...e, Data: { ...e.Data, ValorPago: 150.001 } }), null);
    assert.equal(bankEventEvidence({ ...e, Data: { ...e.Data, DataPagamento: "2026-02-30" } }), null);
    assert.equal(bankEventEvidence({ ...e, Data: { ...e.Data, CodigoCliente: {} } }), null);
  } finally { await db.close(); }
});

test("reconciliation rotates unsupported operations, persists failures and never sends payments", async () => {
  const { db, store } = await setup();
  try {
    for (let i = 0; i < 51; i++) {
      const op = await store.prepare("admin", "homologation", "payment_link", randomUUID(), { amountCents: i + 1 }, { client: 3510, channel: 47 });
      await store.claim(op.id, "admin", "homologation", op.confirmation_hash); await store.finish(op.id, "pending", {});
    }
    const op = await store.prepare("admin", "homologation", "boleto", randomUUID(), { amountCents: 15000 }, { client: 3510, channel: 47 });
    await store.claim(op.id, "admin", "homologation", op.confirmation_hash); await store.finish(op.id, "pending", {}, "target");
    const calls: string[] = [];
    const transport = { config: bankConfig("dev", { PINBANK_DEV_ENABLED: "true", PINBANK_DEV_ENABLED_METHODS: "boleto_status" }), call: async (path: string) => { calls.push(path); throw new Error("sensitive provider text"); } } as unknown as BankTransport;
    await reconcileDev(store, transport); await reconcileDev(store, transport);
    assert.deepEqual(calls, ["/api/CashIn/ConsultarBoleto"]);
    const row = await store.getOperation(op.id, "homologation");
    assert.equal(row.state, "pending"); assert.equal(row.reconciliation_error, "QUERY_FAILED"); assert.ok(row.last_reconciled_at);
    assert.equal(JSON.stringify(await store.list("homologation")).includes("sensitive"), false);
  } finally { await db.close(); }
});

test("expired preparations release duplicate protection and inventoried documents prove ownership", async () => {
  const { db, store } = await setup();
  try {
    const payload = { amountCents: 15000, type: "internal" };
    const op = await store.prepare("admin", "homologation", "payout_internal", randomUUID(), payload, { client: 3510, channel: 47 });
    await db.query("UPDATE pinbank_dev.operations SET created_at=now()-interval '11 minutes' WHERE id=$1", [op.id]);
    await store.recoverInterrupted();
    await assert.rejects(store.claim(op.id, "admin", "homologation", op.confirmation_hash));
    const replacement = await store.prepare("admin", "homologation", "payout_internal", randomUUID(), payload, { client: 3510, channel: 47 });
    assert.equal(replacement.state, "prepared");
    const inventory = await store.prepare("admin", "homologation", "documents", randomUUID(), {}, { client: 3510, channel: 47 });
    await store.claim(inventory.id, "admin", "homologation", inventory.confirmation_hash);
    await store.finish(inventory.id, "completed", { documents: [{ id: 12, type: 4 }] });
    assert.equal(await store.ownsDocument(3510, 12, 4), true);
    assert.equal(await store.ownsDocument(3505, 12, 4), false);
    assert.equal(await store.ownsDocument(3510, 12, 5), false);
  } finally { await db.close(); }
});
