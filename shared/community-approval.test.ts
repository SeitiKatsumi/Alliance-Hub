import assert from "node:assert/strict";
import test from "node:test";
import { canSeeCommunityApproval, isCommunityApprovalPending, shouldStartMembershipPaymentAfterApproval, statusAfterConnectorAura } from "./community-approval";

test("aprovações pendentes mostram somente decisão do candidato e avaliação de Aura", () => {
  assert.equal(isCommunityApprovalPending("candidato"), true);
  assert.equal(isCommunityApprovalPending("aguardando_avaliacao_aura"), true);
  assert.equal(isCommunityApprovalPending("termos_enviados"), false);
  assert.equal(isCommunityApprovalPending("termos_aceitos"), false);
  assert.equal(isCommunityApprovalPending("pagamento_pendente"), false);
});

test("aprovar onboarding inicial nao inicia cobranca", () => {
  assert.equal(shouldStartMembershipPaymentAfterApproval("onboarding_inicial"), false);
  assert.equal(shouldStartMembershipPaymentAfterApproval("vitrine"), false);
  assert.equal(shouldStartMembershipPaymentAfterApproval("associacao_completa"), true);
});

test("a pendência de Aura é visível somente ao conector, e depois vira candidatura", () => {
  const invite = { status: "aguardando_avaliacao_aura", invitador_membro_id: "conector" };
  assert.equal(canSeeCommunityApproval(invite, "conector"), true);
  assert.equal(canSeeCommunityApproval(invite, "gestor"), false);
  assert.equal(canSeeCommunityApproval(invite, null), false);
  assert.equal(canSeeCommunityApproval({ ...invite, status: "candidato" }, "gestor"), true);
});

test("o convite de acesso inicial do próprio Aliado segue direto após a Aura", () => {
  assert.equal(statusAfterConnectorAura("onboarding_inicial", "bernal", "bernal"), "acesso_inicial_ativo");
  assert.equal(statusAfterConnectorAura("onboarding_inicial", "bernal", "rodrigo"), "candidato");
  assert.equal(statusAfterConnectorAura("onboarding_inicial", "bernal", null), "candidato");
  for (const type of ["associacao_completa", "vitrine", "capital"]) assert.equal(statusAfterConnectorAura(type, "bernal", "bernal"), "candidato");
});
