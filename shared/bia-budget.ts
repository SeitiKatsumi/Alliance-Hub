import { z } from "zod";

export const BUDGET_COST_STATES = ["Estimativa", "Orçado", "Contratado"] as const;
export const BUDGET_SOURCE_STATES = ["Estimada", "Condicionada", "Confirmada pelo responsável"] as const;
export const BUDGET_SOURCE_TYPES = ["Aporte", "Financiamento", "Carta de crédito", "Receita prevista", "Outra"] as const;
export const BUDGET_TARGETS = ["Livre", "CAPEX", "OPEX"] as const;
const text = z.string().max(4000).default("");
const id = z.string().min(1).max(100);
const month = z.string().refine(v => !v || /^(19\d{2}|[2-8]\d{3}|9[0-8]\d{2})-(0[1-9]|1[0-2])$/.test(v), "Mês inválido").default("");
const money = z.number().finite().min(0).max(1e10).nullable().default(null);
const expense = { id, descricao:text, situacao:z.enum(BUDGET_COST_STATES), ativoId:text, ativoNome:text };
export const biaBudgetSchema = z.object({
  moeda:z.string().regex(/^[A-Z]{3}$/), inicio:month, meses:z.number().int().min(1).max(120),
  capex:z.array(z.object({...expense,valor:money,pagamentos:z.array(z.object({id,mes:month,valor:money})).max(120)})).max(200),
  opex:z.array(z.object({...expense,valorMensal:money,inicio:month,fim:month})).max(200),
  fontes:z.array(z.object({id,descricao:text,tipo:z.enum(BUDGET_SOURCE_TYPES),valor:money,mes:month,situacao:z.enum(BUDGET_SOURCE_STATES),destinacao:z.enum(BUDGET_TARGETS),observacoes:text})).max(200),
}).superRefine((v,ctx)=>{
  const plannedCents=[...v.capex.flatMap(c=>[c.valor ?? 0,...c.pagamentos.map(p=>p.valor ?? 0)]),...v.fontes.map(f=>f.valor ?? 0)].reduce((sum,n)=>sum+cents(n),0)+v.opex.reduce((sum,o)=>sum+cents(o.valorMensal ?? 0)*v.meses,0);
  if(!Number.isSafeInteger(plannedCents))ctx.addIssue({code:'custom',message:'O total do orçamento excede o limite de cálculo seguro em centavos'});
  for(const rows of [v.capex,v.opex,v.fontes,...v.capex.map(c=>c.pagamentos)]) {
    if(new Set(rows.map(r=>r.id)).size!==rows.length)ctx.addIssue({code:'custom',message:'Identificadores repetidos no orçamento'});
  }
  v.opex.forEach((o,i)=>{if(o.inicio && o.fim && o.fim<o.inicio)ctx.addIssue({code:'custom',path:['opex',i,'fim'],message:'O fim deve ser igual ou posterior ao início'});});
});
export type BiaBudget = z.infer<typeof biaBudgetSchema>;
export function emptyBiaBudget(moeda:string):BiaBudget { return {moeda,inicio:'',meses:12,capex:[],opex:[],fontes:[]}; }
const cents=(v:number)=>Math.round((v+Number.EPSILON)*100);
const monthIndex=(v:string)=>Number(v.slice(0,4))*12+Number(v.slice(5,7))-1;
const monthAt=(n:number)=>`${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;

// Planning only. No ledger, BEI/MAP, bank balance or approval is read or changed here.
export function projectBiaBudget(budget:BiaBudget|undefined,moeda:string,assets:Array<{id:string;nome:string}>=[],valorOrigem?:number|null) {
  const validation=budget?biaBudgetSchema.safeParse(budget):null;
  if(validation && !validation.success)return {warnings:[`Revise o orçamento: ${validation.error.issues[0].message}.`],partial:true,currencyMismatch:false,capex:null,opex:null,diferenca:null,rows:[]};
  const warnings:string[]=[];
  const warn=(message:string)=>{if(!warnings.includes(message))warnings.push(message);};
  let partial=false;
  const pending=(message:string)=>{partial=true;warn(message);};
  const currencyMismatch=!!budget && budget.moeda!==moeda;
  const start=budget?.inicio?monthIndex(budget.inicio):null;
  const rows=Array.from({length:budget && start!==null?budget.meses:0},(_,i)=>({mes:monthAt(start!+i),capex:0,opex:0,confirmadas:0,condicionadas:0,
    confirmado:{Livre:0,CAPEX:0,OPEX:0},previsto:{Livre:0,CAPEX:0,OPEX:0}}));
  const row=(mes:string)=>rows.find(r=>r.mes===mes);
  if(!budget)return {warnings:['Orçamento não informado.'],partial:true,currencyMismatch:false,capex:null,opex:null,diferenca:null,rows:[]};
  if(start===null)pending('Informe o mês inicial do planejamento.');
  if(currencyMismatch)pending(`Orçamento em ${budget.moeda}; moeda atual da BIA: ${moeda}. Não há conversão automática.`);
  if(!budget.capex.length)pending('CAPEX não informado.');
  if(!budget.opex.length)pending('OPEX não informado.');
  const link=(item:{descricao:string;ativoId:string;ativoNome:string})=>{
    if(!item.descricao.trim())pending('Há itens sem descrição.');
    if(item.ativoId && !assets.some(a=>a.id===item.ativoId))warn(`Revise o vínculo do ativo: ${item.ativoNome || 'ativo removido'} (${item.descricao || 'item sem descrição'}).`);
  };
  let capex=0,opex=0,knownCapex=false,knownOpex=false;
  for(const c of budget.capex){
    link(c);
    if(c.valor===null)pending(`CAPEX sem valor: ${c.descricao || 'item sem descrição'}.`);
    else {capex+=cents(c.valor);knownCapex=true;}
    if(!c.pagamentos.length)pending(`CAPEX sem pagamentos previstos: ${c.descricao || 'item sem descrição'}.`);
    let scheduled=0;
    for(const p of c.pagamentos){
      if(!p.mes || p.valor===null)pending(`Pagamento de CAPEX incompleto: ${c.descricao || 'item sem descrição'}.`);
      if(p.valor!==null){scheduled+=cents(p.valor);if(p.mes && row(p.mes))row(p.mes)!.capex+=cents(p.valor);}
      if(p.mes && start!==null && !row(p.mes))warn(`Pagamento fora do horizonte: ${c.descricao || 'CAPEX'} · ${p.mes}.`);
    }
    if(c.valor!==null && scheduled!==cents(c.valor))pending(`Pagamentos diferem do total de CAPEX: ${c.descricao || 'item sem descrição'}.`);
  }
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  for(const o of budget.opex){
    link(o);
    if(o.valorMensal===null || !o.inicio)pending(`OPEX incompleto: ${o.descricao || 'item sem descrição'}.`);
    if(o.fim && o.inicio && o.fim<o.inicio){pending(`Fim anterior ao início: ${o.descricao || 'OPEX'}.`);continue;}
    if(o.valorMensal!==null && o.inicio && start!==null){
      knownOpex=true;
      const active=rows.filter(r=>r.mes>=o.inicio && (!o.fim || r.mes<=o.fim));
      for(const r of active){r.opex+=cents(o.valorMensal);opex+=cents(o.valorMensal);}
      if(!active.length)warn(`OPEX fora do horizonte: ${o.descricao || 'item sem descrição'}.`);
      if(budget.capex.some(c=>normalize(c.descricao)===normalize(o.descricao) && c.descricao.trim() && c.ativoId===o.ativoId && c.pagamentos.some(p=>active.some(r=>r.mes===p.mes))))warn(`Possível duplicidade entre CAPEX e OPEX: ${o.descricao}. Confira sem somar a mesma despesa duas vezes.`);
    }
  }
  for(const f of budget.fontes){
    if(!f.descricao.trim() || f.valor===null || !f.mes)pending('Há origens de recursos sem descrição, mês ou valor.');
    if(f.situacao!=='Confirmada pelo responsável')warn('Há recursos estimados ou condicionados; confira condições e disponibilidade.');
    if(f.mes && start!==null && !row(f.mes))warn(`Origem de recursos fora do horizonte: ${f.descricao || 'sem descrição'} · ${f.mes}.`);
    const r=row(f.mes);
    if(r && f.valor!==null){
      const value=cents(f.valor);r.previsto[f.destinacao]+=value;
      if(f.situacao==='Confirmada pelo responsável'){r.confirmadas+=value;r.confirmado[f.destinacao]+=value;}else r.condicionadas+=value;
    }
  }
  if(!budget.fontes.length)pending('Origem dos recursos não informada.');
  const cumulative={capex:0,opex:0,confirmado:{Livre:0,CAPEX:0,OPEX:0},previsto:{Livre:0,CAPEX:0,OPEX:0}};
  const uncovered=(funds:typeof cumulative.confirmado)=>Math.max(0,Math.max(0,cumulative.capex-funds.CAPEX)+Math.max(0,cumulative.opex-funds.OPEX)-funds.Livre)/100;
  const projected=rows.map(r=>{
    cumulative.capex+=r.capex;cumulative.opex+=r.opex;
    for(const target of BUDGET_TARGETS){cumulative.confirmado[target]+=r.confirmado[target];cumulative.previsto[target]+=r.previsto[target];}
    return {mes:r.mes,capex:r.capex/100,opex:r.opex/100,confirmadas:r.confirmadas/100,condicionadas:r.condicionadas/100,
      descobertoConfirmado:currencyMismatch?null:uncovered(cumulative.confirmado),descobertoPrevisto:currencyMismatch?null:uncovered(cumulative.previsto)};
  });
  if(projected.some(r=>r.descobertoConfirmado!==null && r.descobertoConfirmado>0))warn('Há necessidades sem cobertura no cenário de recursos confirmados.');
  const capexTotal=knownCapex?capex/100:null;
  return {warnings,partial,currencyMismatch,capex:capexTotal,opex:start===null || !knownOpex?null:opex/100,
    diferenca:!currencyMismatch && capexTotal!==null && typeof valorOrigem==='number' && Number.isFinite(valorOrigem)?(capex-cents(valorOrigem))/100:null,rows:projected};
}
