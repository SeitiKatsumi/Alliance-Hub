import { sql } from "drizzle-orm";
import { estimateBiaPatrimony, setupPatrimonyAsset, type BiaPatrimonyAsset, type BiaPatrimonyEstimate } from "../shared/bia-patrimony";
import { readResolvedBiaSetup } from "./bia-setup";

/** Caller authorizes the BIA first. Only aggregate values leave this adapter, never private property records. */
export async function loadBiaPatrimony(db:any,bia:{id:string;moeda?:string},entries:any[],legacy:()=>Promise<any>=async()=>({})):Promise<BiaPatrimonyEstimate> {
  return db.transaction(async(tx:any)=>{
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    const setup=(await readResolvedBiaSetup(tx,String(bia.id),legacy)).dados;
    const origins=(await tx.execute(sql`SELECT o.imovel_id,i.data FROM bia_imovel_origens o JOIN inventario_imoveis i ON i.id=o.imovel_id WHERE o.bia_id=${String(bia.id)} AND o.status='ativa'`)).rows;
    const currency=String(bia.moeda||"BRL").toUpperCase();
    const number=(value:any)=>value===null||value===undefined||value===""?null:typeof value==="number"?value:Number(value);
    const assets:BiaPatrimonyAsset[]=origins.map((row:any)=>({id:`property:${row.imovel_id}`,name:row.data?.nome || 'Imóvel vinculado',value:number(row.data?.valor_atual),debt:number(row.data?.divida_saldo),currency:String(row.data?.moeda||currency).toUpperCase(),acquired:true,ownershipConfirmed:true,ownershipPercent:100}));
    for(const asset of setup?.ativos || []) {
      if(asset.carteiraImovelId && origins.some((o:any)=>String(o.imovel_id)===String(asset.carteiraImovelId)))continue;
      assets.push(setupPatrimonyAsset(asset,currency));
    }
    return estimateBiaPatrimony({assets,entries,currency,assetsUndefined:(!setup || setup.ativosIndefinidos===true) && origins.length===0,calculatedAt:new Date().toISOString()});
  });
}
