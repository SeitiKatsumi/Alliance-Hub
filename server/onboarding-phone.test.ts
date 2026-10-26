import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { sql } from "drizzle-orm";
import * as onboarding from "../shared/initial-onboarding";

function harness(phone: unknown, legacy = false) {
  const source = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const start = source.indexOf(legacy ? '  app.post("/api/onboarding/finalizar-aceites"' : '  app.put("/api/onboarding/etapas/:etapa"');
  const end = source.indexOf(legacy ? '  app.post("/api/register/validate"' : '  app.post("/api/onboarding/concluir"', start);
  let handler: any;
  const calls: any[] = [];
  const journey = { status: "em_andamento", current_step: legacy ? "aceites" : "pronto", flow_version: legacy ? 1 : 2, membro_id: "member", convite_id: "invite", completed_steps: ["aceites", "personalizacao", "perfil", "configuracao", "conexoes"], responses: { personalizacao: { purposes: ["imoveis"] }, perfil: { telefone: phone } } };
  const scope = {
    ...onboarding, sql,
    app: { put: (_: string, fn: any) => handler = fn, post: (_: string, fn: any) => handler = fn },
    getInitialOnboardingJourney: async () => journey,
    directusUpdate: async (...args: any[]) => { calls.push(["directus", ...args]); },
    storage: { getConvitesByCandidatoMembro: async () => [{ id: "invite" }] },
    completeInitialOnboardingInvite: async () => { calls.push(["invite"]); },
    db: { execute: async () => { calls.push(["db"]); } },
    opportunityInviteDestinationFromJourney: () => null,
    onboardingDestinationUrl: () => "/",
  };
  new Function(...Object.keys(scope), transformSync(source.slice(start, end), { loader: "ts" }).code)(...Object.values(scope));
  return { calls, invoke: async (step = "pronto", body: any = {}, session: any = { userId: "user" }) => {
    let status = 200, data: any;
    const response = { status: (value: number) => { status = value; return response; }, json: (value: any) => { data = value; } };
    await handler({ params: { etapa: step }, body, session, query: {} }, response);
    return { status, data };
  } };
}

test("finalização v2 normaliza telefone longo formatado antes do Directus e só então conclui", async () => {
  const h = harness("+351    (912)    345    678              ");
  const result = await h.invoke();
  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.equal(h.calls[0][3].telefone, "+351912345678");
  assert.deepEqual(h.calls.map(c => c[0]), ["directus", "invite", "db"]);
});

test("rascunho antigo inválido volta ao Perfil sem gravar ou concluir: fluxo v2 e legado", async () => {
  for (const legacy of [false, true]) {
    const h = harness("1".repeat(31), legacy);
    const result = await h.invoke();
    assert.equal(result.status, 400);
    assert.equal(result.data.next_url, "/onboarding/perfil");
    assert.match(result.data.error, /Revise o telefone/);
    assert.deepEqual(h.calls, []);
  }
});

test("perfil valida no servidor e sessão continua obrigatória", async () => {
  const h = harness("");
  assert.equal((await h.invoke("perfil", { telefone: "Inválido" })).status, 400);
  assert.equal((await h.invoke("pronto", {}, {})).status, 401);
  assert.deepEqual(h.calls, []);
});

test("interface oferece telefone acessível e recuperação do Perfil, sem sucesso prematuro", () => {
  const source = readFileSync(new URL("../client/src/pages/initial-onboarding.tsx", import.meta.url), "utf8");
  assert.match(source, /<PhoneInput id="onboarding-phone"/);
  assert.match(source, /aria-describedby=\{phoneError \? "onboarding-phone-error" : undefined\}/);
  assert.match(source, /validateOnboardingStepPayload\(step, payload\)/);
  assert.equal((source.match(/if \(error.nextUrl === "\/onboarding\/perfil"\) navigate\(error.nextUrl\)/g) || []).length, 2);
  assert.doesNotMatch(source, /Seu onboarding foi concluído/);
  assert.match(source, /Tudo pronto para concluir/);
});
