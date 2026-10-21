import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { applyViaCepToAsaasForm, AsaasAdminSummary, AsaasBiaSummary, AsaasRefreshFeedback, asaasAccountRefreshMessage } from "./asaas-status";
import { asaasBiaStatusSchema, asaasAccountSummarySchema, type AsaasBiaStatus } from "../../../shared/asaas";
import { publicAsaasStatus, asaasConfig } from "../../../server/asaas/config";

test("painel Asaas informa preparação sem campos de chave nem ações financeiras", () => {
  const summary = publicAsaasStatus(asaasConfig({}), false);
  const html = renderToStaticMarkup(React.createElement(AsaasAdminSummary, { data: summary }));
  assert.match(html, /Sandbox/); assert.match(html, /Próximos passos/); assert.match(html, /BaaS/);
  assert.doesNotMatch(html, /<input|<button|type="password"/);
  assert.match(html, /Pendente/);
});

test("conta aprovada informa operações habilitadas e armazenamento indisponível não simula vínculo ausente", () => {
  const data = asaasBiaStatusSchema.parse({ environment: "sandbox", integrationState: "operational", storageReady: true, operationsEnabled: true, chargesEnabled: true, transfersEnabled: true, accountCreationAvailable: true, accountCreationBlockers: [], account: { id: "account-test", label: "Holding <script>", state: "approved", ownership: "company" } });
  const html = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data }));
  assert.match(html, /Holding &lt;script&gt;/); assert.match(html, /Aprovada/); assert.match(html, /Cobranças habilitadas/); assert.match(html, /Transferências habilitadas/);
  assert.doesNotMatch(html, /<input|<button/);
  const unavailable = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: { ...data, account: null, storageReady: false } }));
  assert.doesNotMatch(unavailable, /Nenhuma conta Asaas vinculada/); assert.match(unavailable, /poderá ser consultado/);
  assert.equal(asaasBiaStatusSchema.parse({ ...data, operationsEnabled: false }).operationsEnabled, false);
});

test("fluxo de criação Sandbox é responsivo e só aparece para edição do Banco", () => {
  const source = readFileSync(new URL("./asaas-status.tsx", import.meta.url), "utf8");
  const capital = readFileSync(new URL("../pages/nucleo-capital.tsx", import.meta.url), "utf8");
  assert.match(source, /button-create-asaas-subaccount/);
  assert.match(source, /h-\[100dvh\][\s\S]*?overflow-y-auto[\s\S]*?button-confirm-create-asaas-subaccount/);
  assert.match(source, /accountCreationAvailable/);
  assert.match(source, /Serviço bancário fornecido pelo/);
  assert.match(source, /asaas-account-operations/); assert.match(source, /Confirmar transferência/);
  assert.match(capital, /BiaAsaasStatus[^>]+canEdit=\{!readOnly\}/);
});

test("CEP preenche logradouro e bairro sem apagar dados manuais", () => {
  const base = {
    name: "Empresa Teste", email: "empresa@example.com", cpfCnpj: "11222333000181",
    companyType: "LIMITED" as const, mobilePhone: "11999999999", incomeValue: 1000,
    address: "", addressNumber: "42", complement: "Sala 2", province: "", postalCode: "01310-930",
    taxRegime: "UNKNOWN" as const, environmentConfirmation: false,
  };
  assert.deepEqual(applyViaCepToAsaasForm(base, {
    logradouro: "Avenida Paulista", complemento: "lado ímpar", bairro: "Bela Vista",
    localidade: "São Paulo", uf: "SP",
  }), { ...base, address: "Avenida Paulista", province: "Bela Vista" });
  assert.strictEqual(applyViaCepToAsaasForm(base, { erro: true }), base);

  const source = readFileSync(new URL("./asaas-status.tsx", import.meta.url), "utf8");
  assert.match(source, /viacep\.com\.br\/ws\/\$\{postalCodeDigits\}\/json/);
  assert.match(source, /CEP não encontrado/);
});

const approvedStatus = (): AsaasBiaStatus => asaasBiaStatusSchema.parse({
  environment: "sandbox", integrationState: "foundation_ready", storageReady: true,
  operationsEnabled: false, chargesEnabled: false, transfersEnabled: false,
  accountCreationAvailable: true, accountCreationBlockers: [],
  integrationPending: ["Habilitar cobranças de aportes neste ambiente.", "Habilitar transferências neste ambiente."],
  account: { id: "fixture-account", label: "Empresa fictícia", state: "approved", ownership: "company" },
});

test("Banco omite Próximos passos em todos os estados sem ocultar situação e habilitação da conta", () => {
  const html = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: approvedStatus() }));
  assert.match(html, /Integração da plataforma:/);
  assert.match(html, /Empresa fictícia/); assert.match(html, /Aprovada/);
  assert.match(html, /Cobranças não habilitadas/); assert.match(html, /Transferências não habilitadas/);
  assert.doesNotMatch(html, /Próximos passos|Cadastro concluído|Configuração da plataforma|asaas-account-next-steps/);
  assert.doesNotMatch(html, /href=|<button|<input/);
  const oldServer = { ...approvedStatus(), integrationPending: undefined };
  assert.match(renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: oldServer })), /Cobranças não habilitadas/);
  for (const state of ["pending", "in_review", "rejected", "blocked"] as const) {
    const data = approvedStatus(); data.account!.state = state;
    const summary = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data }));
    assert.doesNotMatch(summary, /Próximos passos|asaas-account-next-steps/);
    assert.match(summary, /As operações serão liberadas quando a conta estiver aprovada/);
  }
  const production = { ...approvedStatus(), environment: "production" as const, integrationState: "operational" as const, chargesEnabled: true, transfersEnabled: true, operationsEnabled: true, integrationPending: [] };
  const productionHtml = renderToStaticMarkup(React.createElement(AsaasBiaSummary, { data: production }));
  assert.match(productionHtml, /Cobranças habilitadas/); assert.match(productionHtml, /Transferências habilitadas/);
  assert.doesNotMatch(productionHtml, /Próximos passos|Configuração da plataforma/);
  const source = readFileSync(new URL("./asaas-status.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Confira a aprovação e o bloco Próximos passos/);
});

test("feedback de consulta mostra situação inalterada, transição, horário e erro acessível", () => {
  assert.match(asaasAccountRefreshMessage("approved", "approved"), /continua: Aprovada/);
  assert.match(asaasAccountRefreshMessage("in_review", "approved"), /de Em análise para Aprovada/);
  const html = renderToStaticMarkup(React.createElement(AsaasRefreshFeedback, { feedback: {
    kind: "success", message: asaasAccountRefreshMessage("approved", "approved"), checkedAt: "2026-10-21T03:00:00.000Z",
  } }));
  assert.match(html, /role="status"/); assert.match(html, /Última consulta ao Asaas/);
  assert.match(html, /dateTime="2026-10-21T03:00:00.000Z"/);
  const error = renderToStaticMarkup(React.createElement(AsaasRefreshFeedback, { feedback: { kind: "error", message: "Consulta indisponível" } }));
  assert.match(error, /role="alert"/); assert.doesNotMatch(error, /Última consulta/);
});

test("Atualizar situação tem loading, cache atualizado, erro e timeout sem criar operação financeira", async () => {
  const source = readFileSync(new URL("./asaas-status.tsx", import.meta.url), "utf8");
  const query: any = { data: approvedStatus(), isPending: false, isError: false, refetch: async () => ({ isError: false }) };
  let feedback: any = null, handlers: any, failure: Error | null = null;
  const calls: string[] = [], invalidations: string[] = [];
  let returnedState = "approved", currentRequest: Promise<void> | undefined;
  const mutation = {
    isPending: false,
    mutate: () => {
      const callbacks = handlers;
      const context = callbacks.onMutate(); mutation.isPending = true;
      currentRequest = (async () => {
        try { await callbacks.onSuccess(await callbacks.mutationFn(), undefined, context); }
        catch (error) { callbacks.onError(error); }
        finally { mutation.isPending = false; }
      })();
    },
  };
  const scope = { React, useToast: () => ({ toast: () => {} }), useState: () => [feedback, (value: any) => { feedback = value; }],
    useQuery: () => query, useMutation: (options: any) => { handlers = options; return mutation; },
    writeJson: async (url: string, body: unknown, signal: AbortSignal) => {
      calls.push(url); assert.equal(body, undefined); assert.ok(signal instanceof AbortSignal);
      if (failure) throw failure;
      return { account: { ...query.data.account, state: returnedState } };
    }, asaasBiaStatusSchema, asaasAccountSummarySchema, asaasAccountRefreshMessage,
    queryClient: { setQueryData: (_key: unknown, update: any) => { query.data = update(query.data); },
      invalidateQueries: async ({ queryKey }: any) => { invalidations.push(queryKey[0]); } },
    Button: "button", Loader2: () => null, RefreshCw: () => null, SubaccountDialog: () => null,
    AsaasBiaSummary, AsaasRefreshFeedback, AccountOperations: () => null };
  const transformed = transformSync(source.slice(source.indexOf("export function BiaAsaasStatus")).replace("export function", "function"), { loader: "tsx" }).code;
  const Component = new Function(...Object.keys(scope), transformed + ";return BiaAsaasStatus;")(...Object.values(scope));
  const nodes = (node: any): any[] => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
  const render = (canEdit = true) => Component({ biaId: "fixture-bia", canEdit });
  const clickRefresh = () => nodes(render().props.actions).find(node => node.type === "button").props.onClick();
  clickRefresh();
  const pendingHtml = renderToStaticMarkup(render());
  assert.match(pendingHtml, /aria-busy="true"/); assert.match(pendingHtml, /disabled=""/);
  assert.match(pendingHtml, /Consultando Asaas/);
  await currentRequest;
  assert.match(feedback.message, /continua: Aprovada/); assert.ok(feedback.checkedAt);
  returnedState = "blocked"; clickRefresh(); await currentRequest;
  assert.equal(query.data.account.state, "blocked");
  assert.match(feedback.message, /de Aprovada para Bloqueada/);
  for (const error of [new Error("provider-private"), Object.assign(new Error("timeout-private"), { name: "TimeoutError" })]) {
    failure = error; clickRefresh(); await currentRequest;
    assert.equal(query.data.account.state, "blocked");
    assert.equal(feedback.kind, "error"); assert.equal(feedback.checkedAt, undefined);
    assert.doesNotMatch(feedback.message, /private|concluída/);
  }
  assert.doesNotMatch(renderToStaticMarkup(render(false)), /<button/);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(url => url === "/api/bias/fixture-bia/banco/asaas/account/refresh"));
  assert.ok(invalidations.every(url => url === "/api/bias/fixture-bia/banco/asaas/finance"));
});
