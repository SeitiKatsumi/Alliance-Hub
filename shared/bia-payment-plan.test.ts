import test from "node:test";
import assert from "node:assert/strict";
import { makePaymentSchedule, newPaymentPlan, parsePaymentAmounts, quotePaymentShare } from "./bia-payment-plan";
import { applyPaymentPlan, biaBudgetSchema, emptyBiaBudget } from "./bia-budget";

const veneto={...newPaymentPlan("2026-12"),entrada:80000,
  intermediarias:[{nome:"Intermediárias",quantidade:5,valor:80000,intervalo:1}],saldoQuantidade:80};

test("Veneto gera 86 previsões e distribui os centavos exatos por mês e por cota",()=>{
  const rows=makePaymentSchedule(veneto,1170000);
  assert.equal(rows.length,86);
  assert.equal(rows[0].centavos,8000000);
  assert.deepEqual(rows.at(-1),{mes:"2034-01",centavos:862500,bloco:"Saldo"});
  const quotes=Array.from({length:8},(_,index)=>quotePaymentShare(rows,8,index,1));
  for(const quote of quotes){
    assert.equal(quote.reduce((sum,row)=>sum+row.centavos,0),14625000);
    assert.deepEqual(new Set(quote.slice(6).map(row=>row.centavos)),new Set([107812,107813]));
  }
  for(const [index,row] of rows.entries())assert.equal(quotes.reduce((sum,quote)=>sum+quote[index].centavos,0),row.centavos);
});

test("Regenerar preserva itens manuais, estende o horizonte e substitui a mesma rubrica de plano",()=>{
  const budget=emptyBiaBudget("BRL");
  budget.capex.push({id:"manual",descricao:"Obra",ativoId:"",ativoNome:"",situacao:"Estimativa",valor:15,pagamentos:[]});
  const generated=applyPaymentPlan(budget,veneto,1170000);
  assert.equal(generated.meses,86);
  assert.equal(generated.capex[0].id,"manual");
  const regenerated=applyPaymentPlan(generated,{...veneto,saldoQuantidade:60},1170000);
  assert.equal(regenerated.capex.length,2);
  assert.equal(regenerated.capex[1].id,generated.capex[1].id);
  assert.equal(regenerated.capex[1].pagamentos.length,66);
  assert.equal(regenerated.capex[1].pagamentos.at(-1)?.valor,11500);
  assert.deepEqual(biaBudgetSchema.parse(regenerated),regenerated);
  assert.throws(()=>makePaymentSchedule({...veneto,entrada:1e8},1170000),/ultrapassam/);
});

test("Parcela à vista e periodicidade atravessam o ano sem data local",()=>{
  assert.deepEqual(makePaymentSchedule({...veneto,modelo:"a_vista"},100),[{mes:"2026-12",centavos:10000,bloco:"À vista"}]);
  assert.deepEqual(makePaymentSchedule({...veneto,modelo:"parcelado",saldoQuantidade:2,saldoIntervalo:3},100).map(row=>row.mes),["2026-12","2027-03"]);
});


test("A quantidade do saldo pode ficar vazia ou zerada durante a edição",()=>{
  for(const saldoQuantidade of [null,0]){
    const plan={...veneto,saldoQuantidade};
    assert.equal(biaBudgetSchema.parse({...emptyBiaBudget("BRL"),planoPagamento:plan}).planoPagamento?.saldoQuantidade,saldoQuantidade);
    assert.throws(()=>makePaymentSchedule(plan,1170000),/Informe a quantidade de parcelas/);
    assert.equal(makePaymentSchedule(plan,480000).length,6);
  }
  assert.equal(makePaymentSchedule({...veneto,saldoQuantidade:80},1170000).length,86);
});

test("Importa 80 parcelas corrigidas e preserva os centavos no CAPEX e nas cotas", () => {
  const values = parsePaymentAmounts(["1ª parcela: R$ 8.625,00",
    ...Array.from({length:78}, (_, index) => `${index + 2}ª parcela: R$ 9.000,01`),
    "80ª parcela: R$ 13.835,65"].join("\r\n"));
  const plan = {...veneto, entrada:90000, intermediarias:[{...veneto.intermediarias[0], valor:90000}],
    correcao:"INCC" as const, saldoValoresCentavos:values};
  const budget = applyPaymentPlan(emptyBiaBudget("BRL"), plan, 1170000);
  const rows = makePaymentSchedule(biaBudgetSchema.parse(budget).planoPagamento!, 1170000);
  assert.equal(rows.length, 86);
  assert.deepEqual(rows.slice(0, 6).map(row => row.centavos), Array(6).fill(9000000));
  assert.deepEqual(rows.slice(6).map(row => row.centavos), values);
  assert.equal(rows[6].mes, "2027-06");
  assert.equal(rows.at(-1)?.mes, "2034-01");
  assert.equal(budget.capex[0].pagamentos.at(-1)?.valor, 13835.65);
  assert.equal(budget.capex[0].valor, 1264461.43);
  const quotas = Array.from({length:8}, (_, index) => quotePaymentShare(rows, 8, index, 1));
  assert.equal(quotas.reduce((sum, quota) => sum + quota.at(-1)!.centavos, 0), 1383565);
  assert.throws(() => parsePaymentAmounts("1ª parcela: 8.625,00\n3ª parcela: 10.000,00"), /linha 2/);
  assert.throws(() => parsePaymentAmounts("8.625,000"), /linha 1/);
  assert.throws(() => makePaymentSchedule({...plan, saldoValoresCentavos:[]}, 1170000), /Importe/);
  assert.throws(() => makePaymentSchedule({...plan, saldoValoresCentavos:Array(115).fill(1)}, 1170000), /até 120/);
});
