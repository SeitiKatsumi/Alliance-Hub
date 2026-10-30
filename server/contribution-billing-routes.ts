import { z } from "zod";
import type { ContributionBilling } from "./contribution-billing";
export function registerContributionBilling(app:any, service:ContributionBilling, authorize:(req:any,res:any,write:boolean)=>Promise<{biaId:string;manage:boolean;payerId:string|null;actorId:string;canEditPayers?:boolean;canViewBank?:boolean}|null>) {
  const route=(write:boolean,work:(req:any,res:any,auth:any)=>Promise<any>)=>async(req:any,res:any)=>{
    res.setHeader("Cache-Control","no-store");
    try{const auth=await authorize(req,res,write);if(!auth)return;await service.requireReady();await work(req,res,auth);}
    catch(e:any){res.status(e instanceof z.ZodError?400:e.statusCode||503).json({error:e instanceof z.ZodError?"Dados inválidos":e.statusCode?e.message:"Não foi possível consultar/processar os aportes"});}
  };
  const base="/api/bias/:id/aportes-iniciais/cobrancas";
  app.get(base+'/lancamentos/:flowId/lembretes',route(false,async(req,res,a)=>res.json(await service.reminders.read(a.biaId,String(req.params.flowId),a.manage,a.payerId))));
  app.put(base+'/lancamentos/:flowId/lembretes',route(true,async(req,res,a)=>{
    if(!a.manage)return res.status(403).json({error:'Somente gestores podem configurar lembretes.'});
    res.json(await service.reminders.save(a.biaId,String(req.params.flowId),req.body,a.actorId));
  }));
  app.post(base+'/lancamentos/:flowId/cancelar',route(true,async(req,res,a)=>{
    if(!a.manage)return res.status(403).json({error:'Somente gestores podem cancelar cobranças.'});
    const input=z.object({confirm:z.literal(true),chargeId:z.string().uuid()}).parse(req.body);
    res.json(await service.cancelFlow(a.biaId,String(req.params.flowId),a.actorId,input.chargeId));
  }));
  app.get(base+'/lancamentos/:flowId/pagamento',route(false,async(req,res,a)=>res.json(await service.flowPayment(a.biaId,String(req.params.flowId),a.manage,a.payerId,{canEditPayers:a.canEditPayers,canViewBank:a.canViewBank}))));
  app.post(base+'/lancamentos/:flowId/preparar',route(true,async(req,res,a)=>{
    if(req.body?.cashContribution!==true)return res.status(400).json({error:'Confirme que este lançamento é um aporte em dinheiro.'});
    const charge=await service.enqueueFlow(a.biaId,String(req.params.flowId));
    res.status(202).json({queued:true,chargeId:charge.id});
  }));
  app.get(base,route(false,async(_req,res,a)=>res.json(await service.dashboard(a.biaId,a.manage,a.payerId))));
  app.get(base+"/:chargeId/pagamento",route(false,async(req,res,a)=>res.json(await service.details(a.biaId,req.params.chargeId,a.manage,a.payerId))));
  app.put(base+"/lembretes",route(true,async(req,res,a)=>res.json(await service.saveSettings(a.biaId,req.body,a.actorId))));
  app.post(base+"/revisoes/previa",route(true,async(req,res,a)=>res.json(await service.preview(a.biaId,req.body))));
  app.post(base+"/revisoes",route(true,async(req,res,a)=>res.status(202).json(await service.revise(a.biaId,req.body,a.actorId))));
  app.post(base+"/preparar",route(true,async(_req,res,a)=>{await service.enqueue(a.biaId,true);res.status(202).json({queued:true});}));
}
