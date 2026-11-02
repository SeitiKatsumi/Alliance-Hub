import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { registerReceiptMatching, validateReceiptFile, RECEIPT_MATCHING_SQL } from "./receipt-matching";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=", "base64");
test("comprovante: MIME real e limite são validados sem confiar na extensão", async () => {
  const file = await validateReceiptFile({ buffer: png, originalname: "fake.pdf", mimetype: "application/pdf" });
  assert.equal(file.mimetype, "image/png");
  await assert.rejects(() => validateReceiptFile({ buffer: Buffer.from("<script>not a receipt</script>"), mimetype: "image/png" }));
  await assert.rejects(() => validateReceiptFile({ buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }));
  const migration = readFileSync(new URL("../migrations/20261102_receipt_matching.sql", import.meta.url), "utf8");
  assert.equal(migration.slice(migration.indexOf("CREATE TABLE")).replace(/\r\n/g, "\n").trim(), RECEIPT_MATCHING_SQL.replace(/\r\n/g, "\n").trim());
});

test("comprovante: API autoriza, preserva anexos/status, recupera resposta perdida e impede duplicidade ou seleção adulterada", async () => {
  const pg = new PGlite(), db = drizzle(pg);
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { directusUserId: req.headers["x-owner"] || "user" }; next(); });
  let availability:string|null=null;
  let extracted = 0, uploaded = 0, appended = 0, audited = 0, lost = false;
  const files = new Map<string, any>();
  const rows: any[] = [{ id: "f1", bia: "bia", tipo: "saida", valor: 120, descricao: "Limpeza terreno", status: "pendente", data_pagamento: "2026-11-01", favorecido_id: { id: "p", nome: "João Santos" }, Anexos: [{ directus_files_id: { id: "existing" } }] }];
  const facts = { valor: 120, moeda: "BRL", recebedor: "João Santos", descricao: "Limpeza terreno", data_pagamento: "2026-11-01", situacao: "realizado", multiplas_transacoes: false };
  await registerReceiptMatching(app, {
    availability:()=>availability,
    db, authorize: async (req, res, bia) => { if (req.headers["x-access"] !== "edit" || bia !== "bia") { res.status(403).json({ error: "Negado" }); return null; } return {}; },
    accessFlow: async (req, res, id) => { if (req.headers["x-access"] !== "edit") { res.status(403).json({ error: "Negado" }); return null; } const snapshot = rows.find(r => r.id === id); if (!snapshot) { res.status(404).json({ error: "Ausente" }); return null; } return { snapshot, biaId: snapshot.bia }; },
    phase: async () => {}, lock: (_bia, work) => db.transaction(work), flows: async () => structuredClone(rows),
    extract: async () => { extracted++; return JSON.stringify(facts); },
    upload: async (_buffer, name) => { const id = `file-${++uploaded}`; files.set(id, { id, filename_download: name }); return id; },
    append: async (id, fileId) => { appended++; rows.find(r => r.id === id).Anexos.push({ directus_files_id: files.get(fileId) }); if (lost) { lost = false; throw new Error("Lost response after commit"); } },
    audit: async () => { audited++; },
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const analyze = (suffix = "", access = "edit", bia = "bia", owner = "user") => {
    const form = new FormData(); form.append("bia_id", bia); form.append("file", new Blob([Buffer.concat([png, Buffer.from(suffix)])], { type: "image/png" }), "receipt.png");
    return fetch(`${base}/api/fluxo-caixa/comprovantes/analisar`, { method: "POST", headers: { "x-access": access, "x-owner": owner }, body: form });
  };
  const attach = (result: any, changes = {}, access = "edit", owner = "user") => fetch(`${base}/api/fluxo-caixa/comprovantes/${result.id}/anexar`, { method: "POST", headers: { "Content-Type": "application/json", "x-access": access, "x-owner": owner }, body: JSON.stringify({ lancamento_id: result.candidatos[0].id, fingerprint: result.candidatos[0].fingerprint, ...changes }) });
  try {
    availability='IA desativada';assert.equal((await analyze()).status,503);assert.equal(extracted,0);
    assert.equal((await (await fetch(base+'/api/fluxo-caixa/comprovantes/disponibilidade')).json()).disponivel,false);availability=null;
    assert.equal((await analyze("", "view")).status, 403); assert.equal(extracted, 0);
    assert.equal((await analyze("", "edit", "other")).status, 403);
    lost = true;
    assert.equal((await analyze()).status, 500); assert.equal(rows[0].Anexos.length, 2);
    const recovered = await (await analyze()).json();
    assert.equal(recovered.anexado, true); assert.equal(recovered.automatico, true);
    assert.equal(uploaded, 1); assert.equal(appended, 1); assert.equal(audited, 1); assert.equal(rows[0].status, "pendente"); assert.equal(rows[0].valor, 120);
    assert.equal((await (await analyze()).json()).anexado, true); assert.equal(appended, 1);
    assert.equal((await analyze("", "edit", "bia", "other-user")).status, 409);
    rows.push({ ...structuredClone(rows[0]), id: "f2", Anexos: [] });
    const ambiguous = await (await analyze("ambiguous")).json(); assert.equal(ambiguous.anexado, false); assert.equal(ambiguous.candidatos.length, 2);
    assert.equal((await attach(ambiguous, {}, "view")).status, 403);
    assert.equal((await attach(ambiguous, {}, "edit", "other-user")).status, 404);
    rows.push({ ...rows[0], id: "foreign", bia: "foreign" });
    assert.equal((await attach(ambiguous, { lancamento_id: "foreign" })).status, 403);
    rows[0].valor = 999;
    assert.equal((await attach(ambiguous)).status, 409); assert.equal(appended, 1);
    rows[0].valor = 120;
    const done = await (await attach(ambiguous)).json(); assert.equal(done.anexado, true); assert.equal(done.automatico, false);
    assert.equal(appended, 2); assert.equal(rows[0].Anexos.length, 3); assert.equal(rows[1].Anexos.length, 0);
    const stored: any = (await db.execute(sql`SELECT * FROM fluxo_comprovante_analises WHERE id=${done.id}`)).rows[0];
    assert.equal(stored.file_base64, null); assert.ok(stored.attached_at);
    const responseText = JSON.stringify(done); assert.ok(!responseText.includes("file_base64")); assert.ok(!responseText.includes("owner_id"));
    const expired = await (await analyze("expired")).json();
    await db.execute(sql`UPDATE fluxo_comprovante_analises SET expires_at=now()-interval '1 day' WHERE id=${expired.id}`);
    assert.equal((await attach(expired)).status, 409);
    rows.splice(1);
    facts.valor = 121; facts.recebedor = "J. Santos"; facts.data_pagamento = "2026-11-03";
    const tolerant = await (await analyze("tolerant")).json();
    assert.equal(tolerant.anexado, true); assert.equal(tolerant.automatico, true);
    assert.match(tolerant.candidatos[0].motivos.join(" · "), /Valor próximo/);
    assert.ok(tolerant.candidatos[0].motivos.includes("Nome parcial/abreviado compatível"));
    assert.equal(rows[0].valor, 120); assert.equal(rows[0].status, "pendente");
    rows.push({ ...structuredClone(rows[0]), id: "nearby", valor: 122, Anexos: [] });
    const nearAmbiguous = await (await analyze("tolerant-ambiguous")).json();
    assert.equal(nearAmbiguous.anexado, false); assert.equal(nearAmbiguous.candidatos.length, 2);
    rows[0].valor = 120.01;
    assert.equal((await attach(nearAmbiguous)).status, 409);
    assert.equal(rows[1].Anexos.length, 0);
    facts.recebedor = "Pedro Oliveira"; facts.descricao = ""; facts.data_pagamento = "";
    const possible = await (await analyze("different-person")).json();
    assert.equal(possible.anexado, false); assert.equal(possible.candidatos.length, 2);
    assert.ok(possible.candidatos.every((c: any) => c.avisos.includes("Nome do comprovante diferente do favorecido cadastrado.")));
    const chosen = possible.candidatos.find((c: any) => c.id === "nearby");
    const selected = await (await attach(possible, { lancamento_id: chosen.id, fingerprint: chosen.fingerprint })).json();
    assert.equal(selected.anexado, true); assert.equal(selected.automatico, false); assert.equal(selected.lancamentoId, "nearby");
    assert.equal(rows[1].Anexos.length, 1); assert.equal(rows[1].valor, 122); assert.equal(rows[1].status, "pendente");
  } finally { await new Promise<void>((r, j) => server.close(e => e ? j(e) : r())); await pg.close(); }
});

test('receipt flow query uses physical fields; nature is added by official metadata adapter',()=>{
 const routes=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const registration=routes.slice(routes.indexOf('await registerReceiptMatching(app'),routes.indexOf('app.get("/api/fluxo-caixa"'));
 assert.match(registration,/flows: biaId => directusFetchScoped/);assert.doesNotMatch(registration,/status,natureza,/);
 const adapter=routes.slice(routes.indexOf('async function directusFetchScoped'),routes.indexOf('async function fetchProductionCollectionFallback'));
 assert.match(adapter,/await initialEntryMetadata/);
});
