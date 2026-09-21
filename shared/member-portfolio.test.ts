import test from "node:test";
import assert from "node:assert/strict";
import { initialMapEconomicSummary, initialMapContributionValue, withInitialCapitalParticipation, type InitialMapParticipantInput } from "./member-portfolio";

test("resumo usa valores do MAP Zero, sem duplicar DM por cargos ou arredondar os componentes", () => {
  const map = calculateInitialMap(1500000, [
    {memberId:"g",nome:"Guardião",tipo:"guardiao",indiceContribuicao:0,pesoCapital:100},
    {memberId:"m",nome:"Multiplicador",tipo:"multiplicador",indiceContribuicao:12.5,pesoCapital:0,cargos:["Diretor","Autor"]},
  ]);
  const summary = initialMapEconomicSummary(map);
  assert.equal(summary.divisor,12.5);
  assert.equal(summary.cppTotal,187500);
  assert.equal(summary.custoOrigem,1687500);
  assert.deepEqual(summary.rows,[{label:"Guardião",perc:0,cpp:0},{label:"Multiplicador",perc:12.5,cpp:187500}]);
  assert.equal(initialMapEconomicSummary({...map,baseEconomicaInicial:1500000.00001}).cppTotal,0.00001);
});

test("DM simples mostra o mesmo valor da calculadora, inclusive zero e cinco casas", () => {
  for (const index of [0, 1, 12.5, 0.123456]) {
    const map = calculateInitialMap(1500000,[{memberId:"a",nome:"A",tipo:"guardiao",indiceContribuicao:index,pesoCapital:100,capitalComprometido:1500000}]);
    assert.equal(initialMapContributionValue(1500000,index),map.participantes[0].cppOrigem);
  }
  assert.equal(initialMapContributionValue(1500000,12.5),187500);
});

test("troca para Multiplicador zera somente capital; Guardião exige preenchimento sem recriar valor antigo", () => {
  const participant:InitialMapParticipantInput = {memberId:"a",nome:"A",cargos:["Diretor de Aliança"],tipo:"guardiao",indiceContribuicao:1,pesoCapital:100,capitalComprometido:100,naturezaCapital:"nao_caixa",tipoCppCapital:{id:"capital",nome:"Capital"},tipoCppContribuicao:{id:"lead",nome:"Liderança"}};
  const no = withInitialCapitalParticipation(participant,false);
  assert.equal(no.tipo,"multiplicador");
  assert.equal(no.capitalComprometido,0);
  assert.equal(no.pesoCapital,0);
  assert.equal(no.tipoCppCapital,undefined);
  assert.equal(no.indiceContribuicao,1);
  assert.deepEqual(no.tipoCppContribuicao,participant.tipoCppContribuicao);
  assert.deepEqual(no.cargos,participant.cargos);
  assert.equal(participant.capitalComprometido,100);
  const yes = withInitialCapitalParticipation(no,true);
  assert.equal(yes.tipo,"guardiao");
  assert.ok(Number.isNaN(yes.capitalComprometido));
  assert.throws(()=>calculateInitialMap(100,[yes]),/capital comprometido/);
  assert.equal(withInitialCapitalParticipation({...participant,capitalComprometido:0},true).capitalComprometido,0);
  assert.throws(()=>calculateInitialMap(100,[{...participant,indiceContribuicao:NaN}]),/Preencha o DM/);
});
import { allocateQuotaTransferAmounts, calculateInitialMap, calculateMap, calculatePortfolioTotals, convertPortfolioAmountToBrl, isMembershipActive, membershipEndsAt, normalizeFinancingInstallments } from "./member-portfolio";

test("cancelamento preserva acesso ate o fim da vigencia", () => {
  const startsAt = new Date("2026-08-21T00:00:00Z");
  const endsAt = membershipEndsAt(startsAt);
  assert.equal(endsAt.toISOString(), "2027-08-21T00:00:00.000Z");
  assert.equal(isMembershipActive({ status: "canceled", starts_at: startsAt, ends_at: endsAt }, new Date("2027-01-01T00:00:00Z")), true);
  assert.equal(isMembershipActive({ status: "refunded", starts_at: startsAt, ends_at: endsAt }, new Date("2027-01-01T00:00:00Z")), false);
});

test("congelamento preserva acesso enquanto a contagem esta pausada", () => {
  assert.equal(isMembershipActive({ status: "active", starts_at: "2026-01-01", ends_at: "2026-02-01", frozen_at: "2026-01-15" }, new Date("2026-03-01")), true);
});

test("MAP considera aportes e transferencias aceitas sem criar valor", () => {
  const rows = calculateMap(
    [{ memberId: "a", value: 800, status: "pago" }, { memberId: "b", value: 200, status: "pago" }],
    [{ status: "aceita", fromMemberId: "a", toMemberId: "b", value: 300 }],
  );
  assert.equal(rows.find((row) => row.memberId === "a")?.percent, 50);
  assert.equal(rows.find((row) => row.memberId === "b")?.percent, 50);
});

test("distribui dois centavos com cinco casas sem zerar destinatarios nem criar valor", () => {
  const percentages = Array(10).fill(9.0909).concat(9.091);
  const amounts = allocateQuotaTransferAmounts(0.02, percentages);
  assert.equal(Number(amounts.reduce((sum, value) => sum + value, 0).toFixed(5)), 0.02);
  assert.ok(amounts.every((value) => value > 0));

  const rows = calculateMap(
    [{ memberId: "leia", value: 0.02, status: "pago" }],
    amounts.map((value, index) => ({ status: "aceita", fromMemberId: "leia", toMemberId: `destino-${index}`, value })),
  );
  assert.equal(rows.find((row) => row.memberId === "leia"), undefined);
  assert.equal(rows.length, 11);
  assert.equal(Number(rows.reduce((sum, row) => sum + row.value, 0).toFixed(5)), 0.02);
});

test("calcula o MAP Inicial da planilha sem criar regra por cargo", () => {
  const guardian = (memberId: string, nome: string, indiceContribuicao: number) => ({
    memberId, nome, tipo: "guardiao" as const, indiceContribuicao, pesoCapital: 12.5,
  });
  const result = calculateInitialMap(1_500_000, [
    guardian("maria", "Maria", 1.25), guardian("ju", "Ju", 2), guardian("re", "Rê", 2), guardian("mel", "Mel", 2),
    guardian("pat", "Pat", 2), guardian("eli", "Eli", 0), guardian("max", "Max", 0), guardian("fabi", "Fabi", 0),
    { memberId: "rodrigo", nome: "Rodrigo", tipo: "multiplicador", indiceContribuicao: 1.25, pesoCapital: 0, cargos: ["Aliado BUILT"] },
    { memberId: "pedro", nome: "Pedro", tipo: "multiplicador", indiceContribuicao: 2, pesoCapital: 0, cargos: ["Autor da Oportunidade"] },
  ]);

  assert.equal(result.divisorMultiplicador, 12.5);
  assert.equal(result.baseEconomicaInicial, 1_687_500);
  assert.deepEqual(result.participantes.map((item) => [item.memberId, item.cppTotal, item.mapPercentual]), [
    ["maria", 206_250, 12.22222], ["ju", 217_500, 12.88889], ["re", 217_500, 12.88889],
    ["mel", 217_500, 12.88889], ["pat", 217_500, 12.88889], ["eli", 187_500, 11.11111],
    ["max", 187_500, 11.11111], ["fabi", 187_500, 11.11111], ["rodrigo", 18_750, 1.11111],
    ["pedro", 30_000, 1.77778],
  ]);
  assert.equal(Number(result.participantes.reduce((sum, item) => sum + item.mapPercentual, 0).toFixed(5)), 100);
});

test("MAP Inicial valida pessoa unica, pesos e regra do Multiplicador", () => {
  const base = { memberId: "m1", nome: "Ana", tipo: "guardiao" as const, indiceContribuicao: 0, pesoCapital: 100 };
  assert.throws(() => calculateInitialMap(100, [base, base]), /mesma pessoa/i);
  assert.throws(() => calculateInitialMap(100, [{ ...base, pesoCapital: 90 }]), /totalizar 100/i);
  assert.throws(() => calculateInitialMap(100, [base, { memberId: "m2", nome: "Bia", tipo: "multiplicador", indiceContribuicao: 1, pesoCapital: 1 }]), /não recebe Peso de Capital/i);
  assert.equal(calculateInitialMap(100, [base]).participantes[0].cppOrigem, 0);
});

test("rejeita rateio de cotas invalido", () => {
  assert.throws(() => allocateQuotaTransferAmounts(0.02, [0, 100]), /Percentual inválido/);
  assert.throws(() => allocateQuotaTransferAmounts(0.02, [60, 50]), /exceder/);
  assert.throws(() => allocateQuotaTransferAmounts(0.00001, [50, 50]), /insuficiente/);
});

test("patrimonio soma imoveis liquidos e apenas participacoes confirmadas", () => {
  const result = calculatePortfolioTotals(
    [{ acquisitionValue: 100, currentValue: 140, debt: 20, liquidity: "baixa" }],
    [{ invested: 30, participationValue: 50 }, { invested: 10, participationValue: null }],
  );
  assert.equal(result.netWorth, 170);
  assert.equal(result.estimatedTotal, 190);
  assert.equal(result.acquisitionTotal, 140);
  assert.equal(result.registeredAppreciation, 60);
  assert.equal(result.allianceInvested, 40);
  assert.equal(result.lowLiquidityPercent, (140 / 170) * 100);
});

test("patrimonio considera somente a fracao do imovel pertencente ao usuario", () => {
  const result = calculatePortfolioTotals(
    [{ acquisitionValue: 200, currentValue: 300, debt: 40, ownershipPercent: 30 }],
    [],
  );
  assert.equal(result.acquisitionValue, 60);
  assert.equal(result.propertyCurrentValue, 90);
  assert.equal(result.debt, 12);
  assert.equal(result.netWorth, 78);
  assert.equal(result.estimatedTotal, 90);
});

test("MAP considera o aporte somente quando o pagamento acontece", () => {
  const rows = calculateMap([
    { memberId: "a", value: 100, status: "pago" },
    { memberId: "b", value: 200, status: "agendado" },
    { memberId: "c", value: 300, status: "pendente" },
    { memberId: "d", value: 400, status: "vencido" },
  ], []);

  assert.deepEqual(rows.map((row) => [row.memberId, row.value, row.percent]), [["a", 100, 100]]);
});

test("MAP incorpora a alocacao inicial do imovel sem lancamento financeiro", () => {
  const rows = calculateMap(
    [{ memberId: "a", value: 100, status: "pago" }],
    [],
    [{ memberId: "a", value: 600 }, { memberId: "b", value: 400 }],
  );
  assert.deepEqual(rows.map((row) => [row.memberId, row.value, row.percent]), [
    ["a", 700, 63.63636363636363],
    ["b", 400, 36.36363636363637],
  ]);
});

test("patrimonio total estimado nao desconta dividas e valor de aquisicao inclui aportes", () => {
  const result = calculatePortfolioTotals(
    [{ acquisitionValue: 500_000, currentValue: 600_000, debt: 80_000, ownershipPercent: 50 }],
    [{ invested: 100_000, participationValue: 100_000 }, { invested: 20_000, participationValue: null }],
  );
  assert.equal(result.estimatedTotal, 400_000);
  assert.equal(result.acquisitionTotal, 370_000);
  assert.equal(result.registeredAppreciation, 50_000);
  assert.deepEqual(result.valuationCoverage, { propertiesIncluded: 1, propertiesTotal: 1, alliancesIncluded: 1, alliancesTotal: 2 });
});

test("converte moedas com cotacao conhecida e nao presume BRL quando ela falta", () => {
  const rates = new Map([["USD", { moeda: "USD", taxaBrl: 5.25, data: "2026-08-24", fonte: "BCB PTAX" }]]);
  assert.equal(convertPortfolioAmountToBrl(100, "USD", rates), 525);
  assert.equal(convertPortfolioAmountToBrl(100, "BRL", rates), 100);
  assert.equal(convertPortfolioAmountToBrl(100, "EUR", rates), null);
});

test("importacao de financiamento descarta parcelas invalidas e normaliza o status", () => {
  assert.deepEqual(normalizeFinancingInstallments([
    { parcela: 2, valor: 1500, data_vencimento: "2026-09-10", status: "agendado" },
    { parcela: 3, valor: 0, data_vencimento: "2026-10-10" },
  ]), [{ parcela: 2, valor: 1500, data: "2026-09-10", status: "agendado" }]);
});
