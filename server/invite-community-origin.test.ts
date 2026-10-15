import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { asc, eq } from "drizzle-orm";
import ts from "typescript";
import { convitesComunidade, membroComunidadeMae } from "../shared/schema";

test("exibe origem sem M2M somente na consulta explícita, sem conceder associação", async () => {
  const source = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  let method = "";
  function find(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "getMembroComunidadesLinks") method = node.getText(source);
    ts.forEachChild(node, find);
  }
  find(source);
  assert.ok(method);
  let mother: any = { comunidade_id: "5", source: "convite" };
  let fail = false;
  const communities = [
    { id: 5, nome: "Comunidade de origem", membros: [] as any[], aliado: null },
    { id: 6, nome: "Outra comunidade", membros: [{ cadastro_geral_id: { id: "pessoa" } }], aliado: { id: "pessoa" } },
  ];
  const getLinks = runInNewContext(ts.transpileModule(`${method}; getMembroComunidadesLinks;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    getComunidadeCol: async () => "Comunidade",
    directusFetchScoped: async () => { if (fail) throw new Error("indisponível"); return communities; },
    directusRelationId: (value: any) => typeof value === "object" ? value?.id : value,
    resolveMembroComunidadeMae: async () => mother,
    console: { warn() {} },
  });
  const before = JSON.stringify(communities);
  assert.equal((await getLinks("pessoa")).length, 1, "permissões continuam recebendo apenas vínculo efetivo");
  const displayed = await getLinks("pessoa", true);
  assert.equal(displayed.length, 2);
  assert.equal(displayed[0].papel, "ambos");
  assert.equal(displayed[1].papel, "origem");
  assert.equal(displayed[1].is_mae, true);
  assert.equal(displayed[1].locked, true);
  assert.equal(displayed[1].origem_mae, "convite");
  assert.equal(JSON.stringify(communities), before, "consulta não altera o M2M");
  communities[0].membros.push({ cadastro_geral_id: "pessoa" });
  const associated = await getLinks("pessoa", true);
  assert.equal(associated.length, 2, "não duplica a comunidade após associação");
  assert.equal(associated[0].papel, "membro");
  mother = { comunidade_id: "6", source: "manual_update" };
  assert.equal((await getLinks("pessoa", true))[1].is_mae, true, "preserva alteração manual");
  mother = null;
  assert.equal((await getLinks("sem-convite", true)).length, 0);
  mother = { comunidade_id: "inexistente", source: "convite" };
  await assert.rejects(() => getLinks("pessoa", true), /comunidade mãe/);
  fail = true;
  await assert.rejects(() => getLinks("pessoa", true), /indisponível/);
  assert.match(source.text, /getMembroComunidadesLinks\(req.params.id, req.query.incluir_origem === "1"\)/);
});

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
