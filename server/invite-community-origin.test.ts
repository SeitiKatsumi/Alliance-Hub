import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { asc, eq } from "drizzle-orm";
import ts from "typescript";
import { convitesComunidade, membroComunidadeMae } from "../shared/schema";

test("grava a comunidade do primeiro convite junto com o convite", async () => {
  const source = ts.createSourceFile(
    "storage.ts",
    readFileSync(new URL("./storage.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let method = "";
  function find(node: ts.Node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "createConvite") method = node.getText(source);
    ts.forEachChild(node, find);
  }
  find(source);
  assert.ok(method);

  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE convites_comunidade (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), token varchar UNIQUE NOT NULL DEFAULT gen_random_uuid(),
      comunidade_id text NOT NULL, candidato_membro_id text NOT NULL, candidato_nome text, candidato_email text,
      invitador_membro_id text, status text NOT NULL DEFAULT 'convidado', tipo text NOT NULL DEFAULT 'completo',
      dados_contratuais jsonb, expires_at timestamp, termos_aceitos_em timestamp, solicitacao_acesso_em timestamp,
      aura_invitador_avaliada_em timestamp, avaliacao_token varchar UNIQUE, lembrete_24h_em timestamp,
      lembrete_48h_em timestamp, lembrete_72h_em timestamp, criado_em timestamp DEFAULT now(), atualizado_em timestamp DEFAULT now()
    );
    CREATE TABLE membro_comunidade_mae (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), membro_id text NOT NULL UNIQUE, comunidade_id text NOT NULL,
      source text NOT NULL DEFAULT 'manual_seed', locked_at timestamp NOT NULL DEFAULT now(), created_by_user_id varchar,
      created_by_membro_id text, metadata jsonb DEFAULT '{}', created_at timestamp DEFAULT now()
    );
  `);
  const storage = runInNewContext(
    ts.transpileModule(`({${method}})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    { db, convitesComunidade, membroComunidadeMae, eq, asc },
  );

  try {
    const first = await storage.createConvite({
      candidato_membro_id: "mariah-ficticia",
      comunidade_id: "vitoria-a01",
      invitador_membro_id: "rodrigo-ficticio",
    });
    await storage.createConvite({ candidato_membro_id: first.candidato_membro_id, comunidade_id: "outra" });
    const anchors = await db.select().from(membroComunidadeMae);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0].comunidade_id, "vitoria-a01");
    assert.equal(anchors[0].metadata?.convidador_membro_id, "rodrigo-ficticio");

    await pg.exec("DROP TABLE membro_comunidade_mae");
    await assert.rejects(() => storage.createConvite({ candidato_membro_id: "kaua-ficticio", comunidade_id: "vitoria-a01" }));
    assert.equal((await db.select().from(convitesComunidade).where(eq(convitesComunidade.candidato_membro_id, "kaua-ficticio"))).length, 0);
  } finally {
    await pg.close();
  }
});
