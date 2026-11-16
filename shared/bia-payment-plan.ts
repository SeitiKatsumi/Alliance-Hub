import { z } from "zod";

const month = /^((19|[2-8][0-9]|9[0-8])[0-9]{2})-(0[1-9]|1[0-2])$/;
export const paymentPlanSchema = z.object({
  modelo: z.enum(["a_vista","parcelado","blocos"]),
  inicio: z.string().max(7),
  correcao: z.enum(["Sem reajuste","INCC","IPCA"]),
  entrada: z.number().min(0).max(1e10).nullable(),
  intermediarias: z.array(z.object({
    nome:z.string().trim().min(1).max(100),quantidade:z.number().int().min(1).max(120),
    valor:z.number().min(0).max(1e10).nullable(),intervalo:z.number().int().min(1).max(12),
  })).max(20),
  saldoQuantidade: z.number().int().min(0).max(120).nullable(),
  saldoIntervalo: z.number().int().min(1).max(12),
});

export type PaymentPlan = z.infer<typeof paymentPlanSchema>;
export const newPaymentPlan = (inicio=""): PaymentPlan => ({
  modelo:"blocos",inicio,correcao:"Sem reajuste",entrada:null,intermediarias:[],
  saldoQuantidade:1,saldoIntervalo:1,
});

export type PlannedPayment = {mes:string; centavos:number; bloco:string};
export const toPaymentCents = (value:number) => Math.round((value+Number.EPSILON)*100);
export const monthIndex = (value:string) => Number(value.slice(0,4))*12+Number(value.slice(5))-1;
export const monthAt = (value:number) => String(Math.floor(value/12))+"-"+String(value%12+1).padStart(2,"0");

export function makePaymentSchedule(input:PaymentPlan, total:number): PlannedPayment[] {
  const plan=paymentPlanSchema.parse(input);
  if (!month.test(plan.inicio) || !Number.isFinite(total) || total<=0 || total>1e10)
    throw new Error("Informe o Valor de Origem e o primeiro vencimento.");
  const payments:PlannedPayment[]=[];
  let cursor=monthIndex(plan.inicio);
  const add=(name:string,count:number,amount:number,interval:number) => {
    if (payments.length+count>120) throw new Error("O CAPEX aceita até 120 pagamentos neste plano.");
    const each=Math.floor(amount/count);
    const remainder=amount%count;
    for (let index=0;index<count;index++) {
      const mes=monthAt(cursor);
      if(!month.test(mes))throw new Error("O último vencimento excede o período suportado.");
      payments.push({mes,centavos:each+(index<remainder?1:0),bloco:name});
      cursor+=index===count-1?1:interval;
    }
  };
  const target=toPaymentCents(total);
  if (plan.modelo==="a_vista") {
    add("À vista",1,target,1);
    return payments;
  }
  if (plan.modelo==="blocos") {
    if (plan.entrada && toPaymentCents(plan.entrada)>0) add("Entrada",1,toPaymentCents(plan.entrada),1);
    for (const block of plan.intermediarias) {
      if (block.valor==null || toPaymentCents(block.valor)<=0) throw new Error("Informe o valor das parcelas intermediárias.");
      add(block.nome,block.quantidade,toPaymentCents(block.valor)*block.quantidade,block.intervalo);
    }
  }
  const remaining=target-payments.reduce((sum,row)=>sum+row.centavos,0);
  if (remaining<0) throw new Error("A entrada e as intermediárias ultrapassam o Valor de Origem.");
  if (remaining>0) {
    if (!plan.saldoQuantidade) throw new Error("Informe a quantidade de parcelas para distribuir o saldo.");
    if(remaining<plan.saldoQuantidade)throw new Error("O saldo precisa cobrir pelo menos um centavo por parcela.");
    add(plan.modelo==="parcelado"?"Parcelas":"Saldo",plan.saldoQuantidade,remaining,plan.saldoIntervalo);
  }
  return payments;
}

// Consecutive cents are distributed across the quotas in rotation.
// Every monthly payment and the total assigned to each quota reconcile.
export function quotePaymentShare(rows:PlannedPayment[],totalQuotas:number,firstQuota:number,count:number) {
  if (!Number.isSafeInteger(totalQuotas) || totalQuotas<1 || !Number.isSafeInteger(firstQuota) || firstQuota<0 ||
      !Number.isSafeInteger(count) || count<1 || firstQuota+count>totalQuotas) throw new Error("A oferta exige uma quantidade inteira de cotas.");
  let offset=0;
  return rows.map(row=>{
    const before=offset;
    offset+=row.centavos;
    const share=(value:number)=>Math.floor(value/totalQuotas)*count+Math.max(0,Math.min(count,value%totalQuotas-firstQuota));
    return {...row,centavos:share(offset)-share(before)};
  });
}
