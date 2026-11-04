import type {Express} from 'express';
import { RoPulse } from './ro-pulse';
import { isolatedStage } from './isolated-stage';

export function registerRoPulseRoutes(app:Express,service:RoPulse,actor:(req:any)=>{userId:string;memberId:string|null;admin:boolean}){
 const route=(fn:(req:any,res:any,m:any,a:any)=>Promise<any>)=>async(req:any,res:any)=>{
  try{const a=actor(req);const m=await service.deps.meeting(String(req.params.id));if(!m)return res.status(404).json({error:'RO não encontrada.'});await fn(req,res,m,a);}catch(e:any){res.status(e.status||((e.name==='ZodError')?400:500)).json({error:e.status||e.name==='ZodError'?e.message:'Não foi possível consultar o Pulso. Tente novamente.'});}
 };
 const base='/api/reunioes-oportunidades/:id/pulso';
 app.get(base,route(async(_req,res,m,a)=>res.json(await service.read(m,a))));
 app.post(base,route(async(req,res,m,a)=>res.status(201).json(await service.start(m,a,req.body))));
 app.patch(base,route(async(req,res,m,a)=>res.json(await service.action(m,a,String(req.body?.action)))));
 app.get(base+'/convite',route(async(_req,res,m,a)=>res.json(await service.invitation(m,a))));
 const tick=()=>{if(!isolatedStage())void service.tick().catch(()=>console.warn('[ro-pulse] Não foi possível processar as ondas.'));};
 tick();const timer=setInterval(tick,60000);timer.unref?.();return timer;
}
