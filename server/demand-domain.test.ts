import assert from "node:assert/strict";
import test from "node:test";
import {
  demandResolutionError,
  demandStatusAfterProposalAccepted,
  normalizeDemandProposalStatus,
  normalizeDemandResolutionMode,
  normalizeProposalAmount,
} from "./demand-domain";

test("normaliza os quatro modos e preserva a solicitacao legada", () => {
  assert.equal(normalizeDemandResolutionMode("solicitacao"), "NETWORK_DEMAND");
  assert.equal(normalizeDemandResolutionMode("direct-hire"), "DIRECT_HIRE");
  assert.equal(normalizeDemandResolutionMode("INTERNAL_BIA"), "INTERNAL_BIA");
  assert.equal(normalizeDemandResolutionMode("OBA"), "OBA");
});

test("modos internos e OBA exigem BIA", () => {
  assert.match(demandResolutionError("INTERNAL_BIA", null) || "", /BIA/);
  assert.match(demandResolutionError("OBA", "") || "", /BIA/);
  assert.equal(demandResolutionError("OBA", "bia-1"), null);
  assert.equal(demandResolutionError("NETWORK_DEMAND", null), null);
});

test("normaliza estados publicos de proposta sem quebrar os estados legados", () => {
  assert.equal(normalizeDemandProposalStatus("recebido"), "interesse_recebido");
  assert.equal(normalizeDemandProposalStatus("aceita"), "selecionado");
  assert.equal(normalizeDemandProposalStatus("rejeitada"), "nao_selecionado");
  assert.equal(normalizeDemandProposalStatus("desconhecido"), null);
});

test("dinheiro entra como numero e aceite leva a Demanda para negociacao", () => {
  assert.equal(normalizeProposalAmount("1.250,90"), 1250.9);
  assert.equal(normalizeProposalAmount(-10), null);
  assert.equal(demandStatusAfterProposalAccepted("aberta"), "em_negociacao");
  assert.equal(demandStatusAfterProposalAccepted("em_execucao"), "em_execucao");
});
