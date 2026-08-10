import test from "node:test";
import assert from "node:assert/strict";
import {
  canRequestBiaStructuring,
  normalizeAssetOrigin,
  normalizeAssetStage,
  normalizeDemandVisibility,
  publicAssetView,
  publicDemandView,
} from "./network-opportunities";

test("normalizers reject unknown workflow values", () => {
  assert.equal(normalizeDemandVisibility("published"), "privada");
  assert.equal(normalizeAssetOrigin("owner"), "origem_nao_informada");
  assert.equal(normalizeAssetStage("pre_viabilidade_aprovada"), "pre_viabilidade_aprovada");
});

test("public asset view removes exact address, documents and contacts", () => {
  const result = publicAssetView({
    id: "asset-1",
    cidade: "Vitoria",
    endereco: "Rua privada",
    numero: "10",
    cep: "29000-000",
    documentos: [{ id: "secret" }],
    contato_email: "owner@example.com",
    originador_user_id: "user-secret",
    created_by_membro: "member-secret",
    directus_id: "directus-secret",
    autorizacao_compartilhamento_at: new Date().toISOString(),
  });
  assert.equal(result.cidade, "Vitoria");
  assert.equal(result.endereco, undefined);
  assert.equal(result.documentos, undefined);
  assert.equal(result.contato_email, undefined);
  assert.equal(result.originador_user_id, undefined);
  assert.equal(result.created_by_membro, undefined);
  assert.equal(result.directus_id, undefined);
  assert.equal(result.autorizacao_compartilhamento_at, undefined);
  assert.equal(result.dados_privados_liberados, false);
});

test("public demand view exposes only catalog fields", () => {
  const result = publicDemandView({
    id: "demand-1",
    titulo: "Avaliar imovel",
    escopo: "Resumo",
    endereco: "Rua privada",
    cidade: "Vitoria",
    total_interesses: "2",
  });
  assert.equal(result.titulo, "Avaliar imovel");
  assert.equal(result.cidade, "Vitoria");
  assert.equal((result as any).endereco, undefined);
  assert.equal(result.total_interesses, 2);
});

test("BIA structuring requires classified, authorized and pre-feasible asset", () => {
  assert.equal(canRequestBiaStructuring({
    origem_tipo: "oportunidade_externa",
    autorizacao_compartilhamento_at: new Date().toISOString(),
    estagio: "pre_viabilidade_aprovada",
  }), true);
  assert.equal(canRequestBiaStructuring({
    origem_tipo: "origem_nao_informada",
    autorizacao_compartilhamento_at: new Date().toISOString(),
    estagio: "pre_viabilidade_aprovada",
  }), false);
});
