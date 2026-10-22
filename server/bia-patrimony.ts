import { sql } from "drizzle-orm";
import { estimateBiaPatrimony, type BiaPatrimonyAsset } from "../shared/bia-patrimony";

/** Caller authorizes the BIA first. Only aggregate values leave this adapter, never private property records. */
export async function loadBiaPatrimony(db:any,bia:{id:string;moeda?:string},entries:any[]) {
  return db.transaction(async(tx:any)=>{
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    const setup=(await tx.execute(sql`SELECT dados FROM bia_estrutura_versoes WHERE bia_id=${String(bia.id)} ORDER BY revisao DESC LIMIT 1`)).rows[0]?.dados;
    const origins=(await tx.execute(sql`SELECT o.imovel_id,i.data FROM bia_imovel_origens o JOIN inventario_imoveis i ON i.id=o.imovel_id WHERE o.bia_id=${String(bia.id)} AND o.status='ativa'`)).rows;
    const currency=String(bia.moeda||"BRL").toUpperCase();
    const number=(value:any)=>value===null||value===undefined||value===""?null:typeof value==="number"?value:Number(value);
    const assets:BiaPatrimonyAsset[]=origins.map((row:any)=>({id:`property:${row.imovel_id}`,value:number(row.data?.valor_atual),debt:number(row.data?.divida_saldo),currency:String(row.data?.moeda||currency).toUpperCase(),acquired:true,ownershipConfirmed:true}));
    for(const asset of setup?.ativos || []) {
      if(asset.carteiraImovelId && origins.some((o:any)=>String(o.imovel_id)===String(asset.carteiraImovelId)))continue;
      assets.push({id:asset.carteiraImovelId?`property:${asset.carteiraImovelId}`:`setup:${asset.id}`,value:asset.tipo==='consorcio'?null:number(asset.valorReferencia),debt:null,currency,
        acquired:["Adquirido","Em operação"].includes(asset.situacao),ownershipConfirmed:!asset.carteiraImovelId});
    }
    return estimateBiaPatrimony({assets,entries,currency,assetsUndefined:!setup || setup.ativosIndefinidos===true,calculatedAt:new Date().toISOString()});
  });
}
