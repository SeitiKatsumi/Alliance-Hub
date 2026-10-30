import { sql } from 'drizzle-orm';

export async function protectContributionFlow(db:any,id:string,patch:any,current?:any) {
  if(!(await db.execute(sql`SELECT to_regclass('bia_contribution_charges') AS available`)).rows[0]?.available)return;
  const row=(await db.execute(sql`SELECT id FROM bia_contribution_charges WHERE flow_id=${id} AND payment_state<>'cancelled' LIMIT 1`)).rows[0];
  if(!row)return;
  const equal=(key:string,a:any,b:any)=>{
    if(key==='valor')return Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Number(a)===Number(b);
    if(['data_vencimento','data_pagamento'].includes(key))return String(a||'').slice(0,10)===String(b||'').slice(0,10);
    const value=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)&&'id' in v?v.id:v;
    return JSON.stringify(value(a)??null)===JSON.stringify(value(b)??null);
  };
  const safe=patch && Object.keys(patch).every(k=>['descricao','Anexos','anexos','membro_responsavel','Categoria','tipo_de_cpp','data'].includes(k) || (current && equal(k,patch[k],current[k])));
  if(!safe)throw Object.assign(new Error('Há uma cobrança vinculada. Abra “Pix e boleto do aporte” e cancele a cobrança antes de alterar valor, pagador, vencimento ou excluir. Cobranças pagas exigem conciliação.'),{statusCode:409});
}
