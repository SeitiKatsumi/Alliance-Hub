import type {Express} from 'express';

// The actor is read from persistent storage on every request, not from a role sent by the client.
export function registerAdminMemberAccess(app:Express,deps:{actor:(req:any)=>Promise<any>; summary:(id:string)=>Promise<any>; professional?:(id:string,enabled:boolean,actor:any)=>Promise<boolean>}) {
  const authorize=async(req:any,res:any,next:any)=>{
    try {
      const actor=await deps.actor(req);
      if(!actor) return res.status(401).json({error:'Entre novamente para consultar os acessos.'});
      if(!actor.active || actor.employee || !['admin','superadmin'].includes(actor.role)) return res.status(403).json({error:'Somente a administração pode consultar os acessos de outra conta.'});
      req.memberAccessActor=actor;
      next();
    } catch {res.status(503).json({error:'Não foi possível verificar sua autorização.'});}
  };
  app.use('/api/users',authorize);
  app.put('/api/admin/member-access/:userId/professional',authorize,async(req:any,res)=>{
    if(typeof req.body?.enabled!=='boolean') return res.status(400).json({error:'Informe se o perfil profissional será habilitado.'});
    try {
      if(!deps.professional) return res.status(503).json({error:'Operação indisponível.'});
      if(!await deps.professional(String(req.params.userId),req.body.enabled,req.memberAccessActor)) return res.status(404).json({error:'Conta não encontrada.'});
      return res.json({ok:true});
    } catch {res.status(503).json({error:'Não foi possível salvar o perfil profissional.'});}
  });
  app.get('/api/admin/member-access/:userId',authorize,async(req,res)=>{
    try {
      const result=await deps.summary(String(req.params.userId));
      if(!result) return res.status(404).json({error:'Conta não encontrada.'});
      res.set('Cache-Control','no-store').json(result);
    } catch {res.status(503).json({error:'Não foi possível conferir os acessos. Tente novamente.'});}
  });
}
