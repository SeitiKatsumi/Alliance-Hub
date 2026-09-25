import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { BIA_SETUP_SQL, registerBiaSetupRoutes, appendBiaSetup, assertBiaSetupStorage, canAccessSetupBank, validateBiaPortfolioLinks } from './bia-setup';
import { BIA_WORKFLOW_SQL } from './bia-workflow';
import { emptyBiaSetup, biaAssetFromPortfolio } from '../shared/bia-setup';
import { FULL_BIA_ACCESS, EMPTY_BIA_ACCESS } from '../shared/bia-access';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { transformSync } from 'esbuild';
import { readBiaSetup } from './bia-setup';
test('setup API: authorization, revision, bank redaction, immutability, governance and no activation effects',async()=>{
  const pg=new PGlite();await assert.rejects(assertBiaSetupStorage(drizzle(pg)),{statusCode:503});
  await pg.exec(BIA_SETUP_SQL+BIA_WORKFLOW_SQL+`CREATE TABLE bia_map_versoes (bia_id text, numero integer, criado_em timestamp, snapshot jsonb, tipo text)`);
  const db=drizzle(pg),app=express();app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={directusUserId:req.headers['x-user']};next();});
  const bia={id:'test',aliado_built:{id:'member'},diretor_alianca:'member',anexos:['doc-v1']};
  registerBiaSetupRoutes(app,{db,ensure:async()=>{},validateAssets:async(_req,data,prior)=>validateBiaPortfolioLinks(data,prior,async id=>id==='allowed'?{nivel:'proprietario',imovel:{status:'ativo'}}:null),legacy:async()=>({info_comercial:{conta:'SECRET'},valor_geral_venda_vgv:100}),lock:async(_id,fn)=>db.transaction(tx=>fn(tx,null)),access:async(req,res,id,key,level)=>{
    if(!req.session.directusUserId){res.status(401).json({error:'auth'});return null;}
    const permissions=req.session.directusUserId==='manager'?FULL_BIA_ACCESS:req.session.directusUserId==='config'?{...EMPTY_BIA_ACCESS,configuracao_bia:'edit'}:req.session.directusUserId==='governance'?{...EMPTY_BIA_ACCESS,diretoria:'edit'}:EMPTY_BIA_ACCESS;
    if(id!=='test' || permissions[key as keyof typeof permissions]==='none'){res.status(403).json({error:'denied'});return null;}
    return {bia,access:{permissions}};
  }});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const root=`http://127.0.0.1:${(server.address() as any).port}/api/bias/test`;
  const call=(path:string,method='GET',body?:any,user='manager')=>fetch(root+path,{method,headers:{'content-type':'application/json','x-user':user},body:body?JSON.stringify(body):undefined});
  try{
    assert.equal((await call('/estrutura','GET',undefined,'other')).status,403);
    assert.equal((await call('/estrutura','PUT')).status,400);
    assert.equal((await call('/governanca','PUT')).status,400);
    const initial=await (await call('/estrutura')).json();assert.equal(initial.dados.juridico.info.conta,'SECRET');
    const hidden=await (await call('/estrutura','GET',undefined,'config')).json();assert.equal(hidden.dados.juridico.info.conta,'');
    assert.equal(hidden.dados.indicadoresLegados.valor_geral_venda_vgv,null);
    const value=initial.dados;value.juridico.responsavel='Nome';
    value.ativosIndefinidos=false;value.ativos=[biaAssetFromPortfolio({id:'forbidden',nome:'Privado'})];
    assert.equal((await call('/estrutura','PUT',{dados:value,revisaoEsperada:0,motivo:'Ativo de terceiro'})).status,403);
    value.ativos=[biaAssetFromPortfolio({id:'allowed',nome:'Meu imóvel'})];
    assert.equal((await call('/estrutura','PUT',{dados:value,revisaoEsperada:0,motivo:'Cadastro'})).status,200);
    assert.equal((await (await call('/estrutura')).json()).dados.ativos[0].carteiraImovelId,'allowed');
    assert.equal((await call('/estrutura','PUT',{dados:value,revisaoEsperada:0,motivo:'Concorrente'})).status,409);
    const config=(await (await call('/estrutura','GET',undefined,'config')).json());assert.equal(JSON.stringify(config).includes('SECRET'),false);
    config.dados.juridico.info.conta='forged';
    assert.equal((await call('/estrutura','PUT',{dados:config.dados,revisaoEsperada:1,motivo:'Banco'},'config')).status,403);
    config.dados.juridico.info.conta='';
    assert.equal((await call('/estrutura','PUT',{dados:config.dados,revisaoEsperada:1,motivo:'Jurídico'},'config')).status,200);
    assert.equal((await (await call('/estrutura')).json()).dados.juridico.info.conta,'SECRET');
    const gov=await (await call('/governanca','GET',undefined,'governance')).json();assert.equal(JSON.stringify(gov).includes('SECRET'),false);assert.equal(gov.participantes[0].cargos.length,2);
    assert.equal((await call('/governanca','PUT',{revisaoEsperada:2,motivo:'Responsabilidades',governanca:[{memberId:'member',cargo:'Aliado BUILT',inicio:'2026-09-25',responsabilidades:'Acompanhar'}]},'governance')).status,200);
    assert.deepEqual((await readBiaSetup(db,'test')).contexto.documentos,['doc-v1']);
    assert.equal((await call('/governanca','PUT',{revisaoEsperada:3,motivo:'Fraude',governanca:[{memberId:'external',cargo:'Aliado BUILT'}]},'governance')).status,409);
    await pg.exec("INSERT INTO bia_estruturacao_rascunhos (bia_id,autor_id,dados) VALUES ('test','manager','{}')");
    assert.equal((await call('/governanca','PUT',{revisaoEsperada:3,motivo:'Rascunho',governanca:[]},'governance')).status,409);
    await assert.rejects(pg.exec("UPDATE bia_estrutura_versoes SET motivo='erase'"),/imutável/);
    await assert.rejects(pg.exec("DELETE FROM bia_estrutura_versoes"),/imutável/);
    const data=emptyBiaSetup();const input={biaId:'isolated',event:'submissao:1',data,context:{},reason:'Submissão',actor:{}};
    const a=await db.transaction(tx=>appendBiaSetup(tx,input)),b=await db.transaction(tx=>appendBiaSetup(tx,input));assert.equal(a.id,b.id);
    assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM bia_fase_eventos')).rows[0].n,0);
  }finally{await new Promise<void>(r=>server.close(()=>r()));await pg.close();}
});
test('activation snapshot recovers after remote phase change and deduplicates the original structure revision',async()=>{
  const pg=new PGlite();await pg.exec(BIA_SETUP_SQL+BIA_WORKFLOW_SQL+`CREATE TABLE bia_map_inicial_snapshots (bia_id text,ativado_em timestamp);CREATE TABLE bia_imovel_origens (id text,bia_id text,status text);INSERT INTO bia_map_inicial_snapshots VALUES ('recover',null)`);
  const db=drizzle(pg),setup=emptyBiaSetup();setup.juridico.responsavel='Original';
  await appendBiaSetup(db,{biaId:'recover',event:'submissao:1',data:setup,context:{documentos:['doc-v1']},reason:'Submissão',actor:{}});
  await pg.exec(`INSERT INTO bia_fase_eventos(bia_id,evento_id,fase_anterior,fase,motivo,autor,aplicado,criado_em) VALUES ('recover','aceites:1','em_captacao','em_execucao','Aceites','{"estruturaRevisao":1}',true,'2026-09-25T00:00:00')`);
  setup.juridico.responsavel='Alteração posterior';await appendBiaSetup(db,{biaId:'recover',event:'edit',data:setup,context:{},reason:'Alteração',actor:{}});
  const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);
  let fn='';function visit(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text==='reconcileBiaPhases')fn=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);
  const base={revisao:1,participantes:[]},bia={id:'recover',situacao:'em_execucao'};
  const scope={db,sql,phaseDeps:{fetch:async()=>bia},withMapLock:async(_id:any,callback:any)=>callback(db,base),readBiaSetup,appendBiaSetup,initialMapSnapshotView:(v:any)=>v};
  const reconcile=new Function(...Object.keys(scope),transformSync(fn,{loader:'ts'}).code+';return reconcileBiaPhases;')(...Object.values(scope));
  try{
    await reconcile('recover');await reconcile('recover');
    const result=(await pg.query<any>("SELECT * FROM bia_estrutura_versoes WHERE evento='ativacao:1'")).rows;
    assert.equal(result.length,1);assert.equal(result[0].dados.juridico.responsavel,'Original');assert.deepEqual(result[0].contexto.documentos,['doc-v1']);
    assert.equal(result[0].contexto.estruturaRevisao,1);
    const current=await readBiaSetup(db,'recover');assert.equal(current.dados.juridico.responsavel,'Alteração posterior');assert.equal(current.revisao,3);
    const updated=await appendBiaSetup(db,{biaId:'recover',expectedRevision:3,event:'next-edit',data:current.dados,context:{},reason:'Nova alteração',actor:{}});assert.equal(updated.revisao,4);
    assert.equal((await pg.query<any>("SELECT ativado_em=(SELECT criado_em FROM bia_fase_eventos WHERE evento_id='aceites:1') AS preserved FROM bia_map_inicial_snapshots")).rows[0].preserved,true);
  }finally{await pg.close();}
});
test('bank respects company access in addition to BIA access',()=>{
  assert.equal(canAccessSetupBank({companyEmployeeId:'employee',companyEmployeePermissions:{capital:'none'}},FULL_BIA_ACCESS,'view'),false);
  assert.equal(canAccessSetupBank({companyEmployeeId:'employee',companyEmployeePermissions:{capital:'view'}},FULL_BIA_ACCESS,'edit'),false);
  assert.equal(canAccessSetupBank({companyEmployeeId:'employee',companyEmployeePermissions:{capital:'view'}},FULL_BIA_ACCESS,'view'),true);
});

test('portfolio selection rechecks access on new links without breaking existing historical references',async()=>{
  const data={...emptyBiaSetup(),ativosIndefinidos:false,ativos:[biaAssetFromPortfolio({id:'inv-one',nome:'Ativo'})]};
  for(const nivel of ['proprietario','administracao'])await validateBiaPortfolioLinks(data,undefined,async()=>({nivel,imovel:{status:'ativo'}}));
  for(const nivel of ['leitura','colaboracao'])await assert.rejects(validateBiaPortfolioLinks(data,undefined,async()=>({nivel,imovel:{status:'ativo'}})),{statusCode:403});
  await assert.rejects(validateBiaPortfolioLinks(data,undefined,async()=>null),{statusCode:403});
  await assert.rejects(validateBiaPortfolioLinks(data,undefined,async()=>({nivel:'proprietario',imovel:{status:'arquivado'}})),{statusCode:403});
  await validateBiaPortfolioLinks(data,data,async()=>{throw new Error('Existing snapshot must not require private portfolio access');});
  await assert.rejects(validateBiaPortfolioLinks({...data,ativos:[{...data.ativos[0],carteiraImovelId:'foreign'}]},data,async()=>null),{statusCode:403});
  // Every persistence entry point uses the same guard; platform admin alone is not asset ownership.
  const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
  assert.match(source,/validateBiaAssetLinks\(req,data\.estrutura_bia\)/);
  assert.match(source,/validateBiaAssetLinks\(req,data\.estrutura_bia,current\.dados\.estrutura_bia\)/);
  assert.match(source,/validateAssets:validateBiaAssetLinks/);
  const ast=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);let guard='';
  function find(n:ts.Node){if(ts.isFunctionDeclaration(n)&&n.name?.text==='validateBiaAssetLinks')guard=n.getText(ast);ts.forEachChild(n,find);}find(ast);
  const scope={validateBiaPortfolioLinks,requireCarteiraActor:()=>({isPlatformAdmin:true,userId:'user'}),resolveCarteiraAccess:async(_id:string,actor:any)=>{assert.equal(actor.isPlatformAdmin,false);return null;}};
  const validate=new Function(...Object.keys(scope),transformSync(guard,{loader:'ts'}).code+';return validateBiaAssetLinks;')(...Object.values(scope));
  await assert.rejects(validate({},data),{statusCode:403});
});

test('portfolio picker endpoint lists only explicitly administered active assets and descriptive data',async()=>{
  const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
  const start=source.indexOf('  app.get("/api/carteira/imoveis",');
  const route=source.slice(start,source.indexOf('  app.get("/api/carteira/imoveis/:id",',start));
  let handler:any;
  const scope={app:{get:(_path:string,fn:any)=>{handler=fn;}},db:{execute:async()=>({rows:['owned','shared','read','archived','absent'].map(id=>({id}))})},sql,requireCarteiraActor:(req:any)=>{if(!req.user)throw Object.assign(new Error('auth'),{status:401});return {userId:'actor',isPlatformAdmin:true};},carteiraAccessibleWhere:()=>sql`true`,biaAssetFromPortfolio,
    resolveCarteiraAccess:async(id:string,actor:any)=>{assert.equal(actor.isPlatformAdmin,false);return id==='absent'?null:{nivel:id==='read'?'leitura':id==='shared'?'administracao':'proprietario',imovel:{id,nome:id,status:id==='archived'?'arquivado':'ativo',valor_atual:1000,divida_saldo:999,owner_user_id:'PRIVATE'}};},
    carteiraCardForRow:()=>{throw new Error('Do not load finances or documents for this picker');}};
  new Function(...Object.keys(scope),transformSync(route,{loader:'ts'}).code)(...Object.values(scope));
  let status=200,body:any;const res={status:(s:number)=>{status=s;return res;},json:(b:any)=>{body=b;return res;}};
  await handler({query:{para_bia:'1'}},res);assert.equal(status,401);
  status=200;await handler({user:true,query:{para_bia:'1'}},res);assert.equal(status,200);
  assert.deepEqual(body.map((a:any)=>a.carteiraImovelId),['owned','shared']);assert.equal(JSON.stringify(body).includes('PRIVATE'),false);assert.equal(body[0].valorReferencia,null);
});
