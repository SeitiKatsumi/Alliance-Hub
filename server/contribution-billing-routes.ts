import { z } from "zod";
import type { ContributionBilling } from "./contribution-billing";
export function registerContributionBilling(app:any, service:ContributionBilling, authorize:(req:any,res:any,write:boolean)=>Promise<{biaId:string;manage:boolean;payerId:string|null;actorId:string}|null>) {
  const route=(write:boolean,work:(req:any,res:any,auth:any)=>Promise<any>)=>async(req:any,res:any)=>{
    res.setHeader("Cache-Control","no-store");
    try{const auth=await authorize(req,res,write);if(!auth)return;await service.requireReady();await work(req,res,auth);}
    catch(e:any){res.status(e instanceof z.ZodError?400:e.statusCode||503).json({error:e instanceof z.ZodError?"Dados inválidos":e.statusCode?e.message:"Não foi possível consultar/processar os aportes"});}
  };
  const base="/api/bias/:id/aportes-iniciais/cobrancas";
  app.get(base,route(false,async(_req,res,a)=>res.json(await service.dashboard(a.biaId,a.manage,a.payerId))));
  app.get(base+"/:chargeId/pagamento",route(false,async(req,res,a)=>res.json(await service.details(a.biaId,req.params.chargeId,a.manage,a.payerId))));
  app.put(base+"/lembretes",route(true,async(req,res,a)=>res.json(await service.saveSettings(a.biaId,req.body,a.actorId))));
  app.post(base+"/revisoes/previa",route(true,async(req,res,a)=>res.json(await service.preview(a.biaId,req.body))));
  app.post(base+"/revisoes",route(true,async(req,res,a)=>res.status(202).json(await service.revise(a.biaId,req.body,a.actorId))));
  app.post(base+"/preparar",route(true,async(_req,res,a)=>{await service.enqueue(a.biaId,true);res.status(202).json({queued:true});}));
}
