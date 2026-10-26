import { sql } from 'drizzle-orm';

export async function protectContributionFlow(db:any,id:string,patch:any) {
  if(!(await db.execute(sql`SELECT to_regclass('bia_contribution_charges') AS available`)).rows[0]?.available)return;
  const row=(await db.execute(sql`SELECT id FROM bia_contribution_charges WHERE flow_id=${id} LIMIT 1`)).rows[0];
  if(!row)return;
  const safe=patch && Object.keys(patch).every(k=>['descricao','Anexos','anexos','membro_responsavel'].includes(k));
  if(!safe)throw Object.assign(new Error('Este lançamento possui cobrança vinculada. Valores, pagador, vencimento e pagamento devem ser conciliados pela cobrança; não exclua o lançamento isoladamente.'),{statusCode:409});
}
