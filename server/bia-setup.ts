import { sql } from "drizzle-orm";
import { biaSetupSchema, legacyBiaSetup, BANK_FIELDS, ASSET_METRICS, type BiaSetup } from "../shared/bia-setup";
import { collectBiaParticipantRoles, BIA_PARTICIPANT_ROLE_LABELS, hasBiaAccess } from "../shared/bia-access";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { hasCompanyAccess } from "../shared/company-access";

export function canAccessSetupBank(session:any,permissions:any,level:'view'|'edit') {
  return hasBiaAccess(permissions,'capital_banco',level) && (!session?.companyEmployeeId || hasCompanyAccess(session.companyEmployeePermissions,'capital',level));
}
function canAccessSetupAnalysis(session:any,permissions:any,level:'view'|'edit') {
  return hasBiaAccess(permissions,'capital_analises',level) && (!session?.companyEmployeeId || hasCompanyAccess(session.companyEmployeePermissions,'capital',level));
}

export const BIA_SETUP_SQL = `CREATE TABLE IF NOT EXISTS bia_estrutura_versoes (
  id bigserial PRIMARY KEY, bia_id text NOT NULL, revisao integer NOT NULL,
  evento text NOT NULL, dados jsonb NOT NULL, contexto jsonb NOT NULL,
  motivo text NOT NULL, autor jsonb NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bia_id,revisao), UNIQUE(bia_id,evento)
);
CREATE OR REPLACE FUNCTION protect_bia_estrutura_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Histórico da estrutura da BIA é imutável'; END; $$;
DROP TRIGGER IF EXISTS bia_estrutura_immutable ON bia_estrutura_versoes;
CREATE TRIGGER bia_estrutura_immutable BEFORE UPDATE OR DELETE ON bia_estrutura_versoes
FOR EACH ROW EXECUTE FUNCTION protect_bia_estrutura_history();`;

export async function readBiaSetup(db:any,biaId:string) {
  const available=(await db.execute(sql`SELECT to_regclass('public.bia_estrutura_versoes') AS tabela`)).rows[0]?.tabela;
  if(!available)return null;
  const head=(await db.execute(sql`SELECT * FROM bia_estrutura_versoes WHERE bia_id=${biaId} ORDER BY revisao DESC LIMIT 1`)).rows[0] || null;
  if(!head || !String(head.evento).startsWith('ativacao:'))return head;
  // A recovered historical activation must not roll back edits made after that activation.
  const current=(await db.execute(sql`SELECT dados,contexto FROM bia_estrutura_versoes WHERE bia_id=${biaId} AND evento NOT LIKE 'ativacao:%' ORDER BY revisao DESC LIMIT 1`)).rows[0];
  return current?{...head,...current}:head;
}
export async function assertBiaSetupStorage(db:any) {
  if(!(await db.execute(sql`SELECT to_regclass('public.bia_estrutura_versoes') AS tabela`)).rows[0]?.tabela)throw Object.assign(new Error('Atualização da estrutura pendente de migração. Nenhum convite foi enviado por esta tentativa.'),{statusCode:503});
}
// Caller holds the BIA map transaction lock, shared with conclusion and activation.
export async function appendBiaSetup(tx:any,input:{biaId:string;expectedRevision?:number;event:string;data:BiaSetup;context:any;reason:string;actor:any}) {
  await assertBiaSetupStorage(tx);
  const existing=(await tx.execute(sql`SELECT * FROM bia_estrutura_versoes WHERE bia_id=${input.biaId} AND evento=${input.event}`)).rows[0];
  if(existing)return existing;
  const current=await readBiaSetup(tx,input.biaId);
  if(input.expectedRevision!==undefined && input.expectedRevision!==Number(current?.revisao || 0))throw Object.assign(new Error("A estrutura foi atualizada. Recarregue antes de salvar."),{statusCode:409});
  if(!input.reason.trim())throw Object.assign(new Error("Informe o motivo da alteração."),{statusCode:400});
  const data=biaSetupSchema.parse(input.data);
  return (await tx.execute(sql`INSERT INTO bia_estrutura_versoes (bia_id,revisao,evento,dados,contexto,motivo,autor) VALUES (${input.biaId},${Number(current?.revisao || 0)+1},${input.event},${JSON.stringify(data)}::jsonb,${JSON.stringify(input.context)}::jsonb,${input.reason},${JSON.stringify(input.actor)}::jsonb) RETURNING *`)).rows[0];
}

export async function validateBiaPortfolioLinks(next:BiaSetup|undefined,previous:BiaSetup|undefined,resolve:(id:string)=>Promise<{nivel:string;imovel:{status?:string}}|null>) {
  for(const asset of next?.ativos || []) {
    if(!asset.carteiraImovelId || previous?.ativos.some(a=>a.id===asset.id && a.carteiraImovelId===asset.carteiraImovelId))continue;
    const access=await resolve(asset.carteiraImovelId);
    if(!access || !['proprietario','administracao'].includes(access.nivel) || (access.imovel.status && access.imovel.status!=='ativo'))throw Object.assign(new Error('Ativo indisponível ou sem permissão de administração na Carteira. Selecione novamente.'),{statusCode:403});
  }
}

export function registerBiaSetupRoutes(app:Express,deps:{db:any;ensure:()=>Promise<any>;access:(req:any,res:any,id:string,key:any,level:any)=>Promise<any>;lock:(id:string,fn:(tx:any,base:any)=>Promise<any>)=>Promise<any>;legacy:(id:string,bia:any)=>Promise<any>;validateAssets:(req:any,data:BiaSetup,prior:BiaSetup)=>Promise<void>}) {
  const actor=(req:any)=>({userId:req.session.directusUserId,memberId:req.session.membroId || null});
  const error=(res:any,e:any)=>res.status(e.statusCode || (e.name==='ZodError'?400:500)).json({error:e.name==='ZodError'?'Dados da estrutura inválidos.':e.statusCode?e.message:'Não foi possível consultar ou salvar a estrutura. Tente novamente.'});
  const roster=(bia:any)=>Array.from(collectBiaParticipantRoles(bia),([memberId,roles])=>({memberId,cargos:roles.map(r=>BIA_PARTICIPANT_ROLE_LABELS[r])}));
  const stripBank=(data:BiaSetup,canView:boolean)=>canView?data:{...data,juridico:{...data.juridico,info:{...data.juridico.info,...Object.fromEntries(BANK_FIELDS.map(k=>[k,""]))}}};
  const stripMetrics=(data:BiaSetup,canView:boolean)=>canView?data:{...data,indicadoresLegados:Object.fromEntries(ASSET_METRICS.map(([k])=>[k,null])),ativos:data.ativos.map(a=>({...a,indicadores:Object.fromEntries(ASSET_METRICS.map(([k])=>[k,null]))}))};
  async function load(tx:any,bia:any){return await readBiaSetup(tx,String(bia.id)) || {revisao:0,dados:legacyBiaSetup(await deps.legacy(String(bia.id),bia)),contexto:{participantes:roster(bia)},criado_em:null};}
  app.get('/api/bias/:id/estrutura',async(req,res)=>{try{
    const auth=await deps.access(req,res,String(req.params.id),'configuracao_bia','view');if(!auth)return;
    await deps.ensure();await assertBiaSetupStorage(deps.db);const row=await load(deps.db,auth.bia),bank=canAccessSetupBank(req.session,auth.access.permissions,'view');
    const history=(await deps.db.execute(sql`SELECT revisao,motivo,autor,criado_em,dados,contexto->'anterior' AS anterior FROM bia_estrutura_versoes WHERE bia_id=${String(auth.bia.id)} ORDER BY revisao DESC`)).rows;
    const metrics=canAccessSetupAnalysis(req.session,auth.access.permissions,'view'),visible=(data:BiaSetup)=>stripMetrics(stripBank(data,bank),metrics);
    res.json({...row,dados:visible(row.dados),contexto:undefined,participantes:roster(auth.bia),historico:history.map((h:any)=>({...h,dados:visible(h.dados),anterior:h.anterior?visible(h.anterior):null})),indicadoresVisiveis:metrics,indicadoresEditaveis:canAccessSetupAnalysis(req.session,auth.access.permissions,'edit'),bancoVisivel:bank,bancoEditavel:canAccessSetupBank(req.session,auth.access.permissions,'edit'),editavel:hasBiaAccess(auth.access.permissions,'configuracao_bia','edit')});
  }catch(e){error(res,e);}});
  app.put('/api/bias/:id/estrutura',async(req,res)=>{try{
    const auth=await deps.access(req,res,String(req.params.id),'configuracao_bia','edit');if(!auth)return;
    await deps.ensure();
    const result=await deps.lock(String(auth.bia.id),async(tx,base)=>{
      const draft=(await tx.execute(sql`SELECT concluido FROM bia_estruturacao_rascunhos WHERE bia_id=${String(auth.bia.id)}`)).rows[0];
      if(draft && !draft.concluido)throw Object.assign(new Error('Edite os dados pelo rascunho da BIA.'),{statusCode:409});
      const current=await load(tx,auth.bia),data=biaSetupSchema.parse(req.body?.dados);
      if(!Number.isInteger(req.body.revisaoEsperada))throw Object.assign(new Error('Informe a revisão esperada.'),{statusCode:400});
      if(typeof req.body.motivo!=='string' || !req.body.motivo.trim() || req.body.motivo.length>4000)throw Object.assign(new Error('Informe o motivo da alteração.'),{statusCode:400});
      await deps.validateAssets(req,data,current.dados);
      if(!canAccessSetupBank(req.session,auth.access.permissions,'edit'))for(const k of BANK_FIELDS){
        if(data.juridico.info[k] && data.juridico.info[k]!==current.dados.juridico.info[k])throw Object.assign(new Error('Sem permissão para alterar a conta bancária.'),{statusCode:403});
        data.juridico.info[k]=current.dados.juridico.info[k];
      }
      // Role assignment is exclusively the existing BEI/MAP operation, never this editor.
      if(!canAccessSetupAnalysis(req.session,auth.access.permissions,'edit')){
        if(current.dados.ativos.some((a:any)=>ASSET_METRICS.some(([k])=>a.indicadores[k]!=null) && !data.ativos.some(b=>b.id===a.id)))throw Object.assign(new Error('Sem permissão para remover ativo com indicadores financeiros.'),{statusCode:403});
        for(const a of data.ativos)for(const [k] of ASSET_METRICS){const prior=current.dados.ativos.find((b:any)=>b.id===a.id)?.indicadores[k] ?? null;if(a.indicadores[k]!=null && a.indicadores[k]!==prior)throw Object.assign(new Error('Sem permissão para alterar indicadores financeiros.'),{statusCode:403});a.indicadores[k]=prior;}
      }
      // Unallocated historical metrics cannot be reassigned or silently erased here.
      data.indicadoresLegados=current.dados.indicadoresLegados;
      data.governanca=current.dados.governanca;
      return appendBiaSetup(tx,{biaId:String(auth.bia.id),expectedRevision:req.body.revisaoEsperada,event:randomUUID(),data,context:{anterior:current.dados,participantes:roster(auth.bia),documentos:auth.bia.anexos || [],mapRevisao:base?.revisao || null},reason:req.body.motivo,actor:actor(req)});
    });res.json({revisao:result.revisao});
  }catch(e){error(res,e);}});
  app.get('/api/bias/:id/governanca',async(req,res)=>{try{
    const auth=await deps.access(req,res,String(req.params.id),'diretoria','view');if(!auth)return;
    await deps.ensure();await assertBiaSetupStorage(deps.db);const row=await readBiaSetup(deps.db,String(auth.bia.id));
    const history=(await deps.db.execute(sql`SELECT revisao,criado_em,motivo,autor,dados->'governanca' AS governanca,contexto->'participantes' AS participantes FROM bia_estrutura_versoes WHERE bia_id=${String(auth.bia.id)} ORDER BY revisao DESC`)).rows;
    const mapHistory=(await deps.db.execute(sql`SELECT numero,criado_em,snapshot FROM bia_map_versoes WHERE bia_id=${String(auth.bia.id)} AND tipo='zero' ORDER BY numero DESC`)).rows;
    res.json({revisao:row?.revisao || 0,participantes:roster(auth.bia),governanca:(row?.dados.governanca || []).filter((g:any)=>roster(auth.bia).some(p=>p.memberId===g.memberId && p.cargos.includes(g.cargo))),historico:history,mapHistorico:mapHistory.map((h:any)=>({numero:h.numero,criado_em:h.criado_em,participantes:(h.snapshot?.participantes || h.snapshot?.base?.participantes || []).map((p:any)=>({memberId:p.memberId,nome:p.nome,cargos:p.cargos}))})),editavel:hasBiaAccess(auth.access.permissions,'diretoria','edit')});
  }catch(e){error(res,e);}});
  app.put('/api/bias/:id/governanca',async(req,res)=>{try{
    const auth=await deps.access(req,res,String(req.params.id),'diretoria','edit');if(!auth)return;
    await deps.ensure();
    const result=await deps.lock(String(auth.bia.id),async(tx,base)=>{
      if(typeof req.body?.motivo!=='string' || !req.body.motivo.trim() || req.body.motivo.length>4000 || !Number.isInteger(req.body.revisaoEsperada))throw Object.assign(new Error('Informe revisão e motivo.'),{statusCode:400});
      const draft=(await tx.execute(sql`SELECT concluido FROM bia_estruturacao_rascunhos WHERE bia_id=${String(auth.bia.id)}`)).rows[0];
      if(draft && !draft.concluido)throw Object.assign(new Error('Conclua a estruturação antes de editar as responsabilidades no detalhe.'),{statusCode:409});
      const current=await load(tx,auth.bia),data=biaSetupSchema.parse({...current.dados,governanca:req.body.governanca}),people=roster(auth.bia);
      if(data.governanca.some(g=>!people.some(p=>p.memberId===g.memberId && p.cargos.includes(g.cargo))))throw Object.assign(new Error('A função ou o titular mudou. Recarregue a Governança.'),{statusCode:409});
      return appendBiaSetup(tx,{biaId:String(auth.bia.id),expectedRevision:req.body.revisaoEsperada,event:randomUUID(),data,context:{anterior:current.dados,participantes:people,documentos:auth.bia.anexos || current.contexto?.documentos || [],mapRevisao:base?.revisao || null},reason:req.body.motivo,actor:actor(req)});
    });res.json({revisao:result.revisao});
  }catch(e){error(res,e);}});
}
