import type {Express} from 'express';
import {normalizeAccountRole} from '../shared/account-access-profiles';

type Account = {id:string;role?:string|null;ativo:boolean;permissions?:unknown;email?:string|null;membro_directus_id?:string|null;nome?:string};
export function registerLiveAccountAccess(app:Express,deps:{
  getUser:(id:string)=>Promise<Account|undefined|null>;
  getUsersByEmail:(email:string)=>Promise<Account[]>;
  getEmployee:(id:string)=>Promise<any>;
  applyEmployee:(req:any,employee:any,user:Account)=>void;
  bootstrap:(email?:string|null)=>boolean;
  adminPermissions:Record<string,string>;
}) {
  app.use('/api',async(req:any,res,next)=>{
    const session=req.session;
    const id=session?.directusUserId||session?.userId;
    const path=String(req.path||'');
    if(!id||['/login','/logout'].includes(path)||path.startsWith('/auth/')) return next();
    try {
      let user=await deps.getUser(String(session.accessUserId||id));
      // A Directus identity may map to a local account through its member relation.
      // Never select the first of several accounts sharing an email address.
      if(!user&&!session.accessUserId&&session.email) {
        const candidates=await deps.getUsersByEmail(String(session.email));
        const matches=candidates.filter(candidate=>session.membroId&&String(candidate.membro_directus_id||'')===String(session.membroId));
        if(matches.length===1) user=matches[0];
      }
      if(!user) {
        if(session.accessUserId) return res.status(401).json({error:'Esta conta não está mais disponível.'});
        return next(); // Directus-only accounts retain their existing authentication flow.
      }
      if(!user.ativo) return res.status(401).json({error:'Esta conta está inativa.'});
      session.accessUserId=String(user.id);
      req.currentAccessUser=user;
      const employee=await deps.getEmployee(String(user.id));
      if(employee) {
        if(employee.status!=='ativo'||employee.employee_ativo===false) return res.status(403).json({error:'Este acesso de funcionário está suspenso.',code:'COMPANY_ACCOUNT_SUSPENDED'});
        deps.applyEmployee(req,employee,user);
        return next();
      }
      // A removed employment link must not leave its owner identity in the session.
      delete session.companyEmployeeId;
      delete session.companyOwnerUserId;
      delete session.companyOwnerMembroId;
      delete session.companyEmployeePermissions;
      session.role=deps.bootstrap(user.email)?'admin':normalizeAccountRole(user.role);
      session.permissions=['admin','manager'].includes(session.role)?{...deps.adminPermissions}:{...(user.permissions as Record<string,string>||{})};
      session.membroId=user.membro_directus_id||null;
      session.email=user.email||null;
      session.nome=user.nome||session.nome;
      next();
    } catch {
      res.status(503).json({error:'Não foi possível atualizar seus acessos. Tente novamente.'});
    }
  });
}
