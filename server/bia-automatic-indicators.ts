import { sql } from 'drizzle-orm';
import { biaBusinessTypeCode } from '../shared/bia-business-type';
import { biaAssetIndicators, currentBiaMonth, paidBiaReceipts, plannedBiaSales, type ValuationAsset } from '../shared/bia-automatic-indicators';
import { readBiaSetup, readResolvedBiaSetup } from './bia-setup';

export const BIA_RECEIPTS_QUERY = 'fields=id,bia,tipo,status,valor,data_pagamento,Categoria.categorias_id.*&filter[status][_eq]=pago&limit=-1';
/** The caller has already scoped the BIAs. No row-level financial or property data leaves this adapter. */
export async function withAutomaticBiaIndicators<T extends {id:unknown;acompanhamento?:any;moeda?:unknown}>(items:T[], deps:{
  permissions:(bia:T)=>Promise<{finance:boolean;assets:boolean}>;
  entries:(ids:string[])=>Promise<any[]>;
  assets:(bia:T)=>Promise<{plannedSales:number|null;assetValue:number|null;appreciation:number|null}>;
  now?:Date;
}) {
  const permissions = await Promise.all(items.map(b => deps.permissions(b)));
  const ids = items.filter((_,i) => permissions[i].finance).map(b => String(b.id));
  let entries:any[]|null = null;
  if(ids.length) { try { entries = await deps.entries(ids); } catch { /* Unavailable is not a zero balance. */ } }
  return Promise.all(items.map(async (bia,i) => {
    const code = biaBusinessTypeCode(bia as any);
    const selected = ['SHORT_STAY','HOSPITALITY_OPERATION'].includes(code) ? bia.acompanhamento?.byThesis?.[code]?.period : null;
    const period = typeof selected === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(selected) ? selected : currentBiaMonth(deps.now);
    let assets = {plannedSales:null,assetValue:null,appreciation:null} as Awaited<ReturnType<typeof deps.assets>>;
    if (permissions[i].assets) { try { assets = await deps.assets(bia); } catch { /* Never fall back to old manual tracking amounts. */ } }
    return {...bia,indicadores_automaticos:{period,...paidBiaReceipts(String(bia.id),permissions[i].finance?entries:null,period),...assets}};
  }));
}

export async function loadBiaAssetIndicators(db:any,bia:any,legacy:()=>Promise<any>) {
  // Legacy loading may acquire a connection from the same pool. Resolve it before
  // reserving a transaction, otherwise a list of legacy BIAs can exhaust the pool.
  const existing = await readBiaSetup(db,String(bia.id));
  const legacyData = existing ? null : await legacy();
  return db.transaction(async(tx:any) => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    const setup = (await readResolvedBiaSetup(tx,String(bia.id),async()=>legacyData)).dados;
    const currency = String(bia.moeda || 'BRL').toUpperCase();
    const rows = (await tx.execute(sql`SELECT o.imovel_id,i.data FROM bia_imovel_origens o JOIN inventario_imoveis i ON i.id=o.imovel_id WHERE o.bia_id=${String(bia.id)} AND o.status='ativa'`)).rows;
    const assets:ValuationAsset[] = rows.map((r:any) => ({id:`property:${r.imovel_id}`,value:r.data?.valor_atual,acquisition:r.data?.valor_pago,currency:String(r.data?.moeda || currency).toUpperCase(),share:100}));
    for(const a of setup.ativos) {
      if(a.carteiraImovelId && rows.some((r:any) => String(r.imovel_id) === a.carteiraImovelId)) continue;
      if(a.situacao === 'Alienado') continue;
      // Informative links do not authorize importing the owner's private valuation or imply ownership.
      assets.push({id:`setup:${a.id}`,value:a.tipo==='consorcio'?null:a.valorReferencia,acquisition:null,currency,share:!a.carteiraImovelId && ['Adquirido','Em operação'].includes(a.situacao)?a.participacaoBiaPercentual??null:null});
    }
    return {plannedSales:plannedBiaSales(setup),...biaAssetIndicators(assets,currency)};
  });
}
