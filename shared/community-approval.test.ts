import assert from "node:assert/strict";
import test from "node:test";
import { isCommunityApprovalPending, shouldStartMembershipPaymentAfterApproval } from "./community-approval";

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
