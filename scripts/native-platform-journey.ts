// Operator-only creation journeys. Runs against the isolated clone, never production.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { emptyBiaSetup } from '../shared/bia-setup';
import { STRATEGIC_CELL_TYPES } from '../shared/strategic-cells';

const origin = 'http://127.0.0.1:3018';
const run = `qa-migration-${Date.now()}`;
const password = process.env.QA_JOURNEY_PASSWORD || `Qa-${randomUUID()}!`;
const results: {name:string; ok:boolean; detail?:string}[] = [];
let requests=0;
const fixtures: Record<string,any> = {run};
const db = new pg.Client({connectionString:process.env.DATABASE_URL});
class Session {
  cookie='';
  async call(method:string,path:string,body?:any,expected=200) {
    assert(path.startsWith('/api/'));
    requests++;
    const response=await fetch(origin+path,{method,headers:{cookie:this.cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(45000)});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const text=await response.text();let data:any;try{data=JSON.parse(text);}catch{data={error:'Non-JSON response'};}
    assert.equal(response.status,expected,`${method} ${path.split('?')[0]}: ${response.status}; ${String(data.error||'').slice(0,300)}`);
    return data;
  }
}
async function check(name:string,action:()=>Promise<void>) {
  try {await action();results.push({name,ok:true});console.log('PASS '+name);}
  catch(e:any){results.push({name,ok:false,detail:String(e.message).slice(0,500)});console.log('FAIL '+name+': '+String(e.message).slice(0,350));}
}
async function main() {
  assert.equal(process.env.BUILT_ISOLATED_STAGE,'1');
  assert.equal(process.env.BUILT_DATA_BACKEND,'postgres');
  assert.equal(process.env.DIRECTUS_URL,'http://native-data.invalid');
  await db.connect();
  assert.equal((await db.query("SELECT state FROM built_migration.control WHERE state='isolated-rehearsal'")).rowCount,1);
  const admin=new Session();
  await admin.call('POST','/api/login',{email:'migration-fixture@example.invalid',password:process.env.QA_ADMIN_PASSWORD});
  const me=await admin.call('GET','/api/me');
  const member=me.membro_directus_id;
  assert(member,'Fixture member required'); fixtures.adminMember=member;
  // This fixture is synthetic; no real member's consent or profile is changed.
  await admin.call('PATCH',`/api/membros/${member}`,{codigo_etica_aceito_em:new Date().toISOString(),codigo_etica_versao:'QA isolated only',politicas_participacao_aceito_em:new Date().toISOString(),politicas_participacao_versao:'QA isolated only',aceite_localizacao:{status:'capturada',latitude:0,longitude:0,accuracy:1,captured_at:new Date().toISOString()}});
  let community:any;
  await check('Community: create, nested member, edit, reload',async()=>{
    community=await admin.call('POST','/api/comunidades',{nome:run,aliado_id:member,membros_ids:[member]});fixtures.community=community.id;
    const updated=await admin.call('PATCH',`/api/comunidades/${community.id}`,{nome:run+' edited',membros_ids:[member,member]});
    assert.equal(updated.nome,run+' edited');
    const reload=await admin.call('GET',`/api/comunidades/${community.id}`);
    assert.equal(reload.membros.length,1,'Duplicate relationship');
  });
  if(!community?.id)throw new Error('Community prerequisite failed');
  await check('Community cells: official types, edit, duplicate guard',async()=>{
    const cells=await admin.call('GET',`/api/comunidades/${community.id}/celulas`);
    const rows=Array.isArray(cells)?cells:cells.cells;assert.equal(rows.length,STRATEGIC_CELL_TYPES.length);
    await admin.call('PATCH',`/api/comunidades/${community.id}/celulas/${rows[0].id}`,{description:run});
    await admin.call('POST',`/api/comunidades/${community.id}/celulas`,{},409);
  });
  for(const purpose of ['profissional','imoveis','capital']) await check(`Onboarding ${purpose}: invitation to completed profile`,async()=>{
    const invite=await admin.call('POST','/api/meu-convite',{force:true,tipo:'unificado',comunidade_id:community.id});
    assert.equal(String(invite.comunidade_id),String(community.id));
    const session=new Session(),email=`${run}-${purpose}@example.invalid`;
    const registration={nome:`QA Migration ${purpose}`,email,username:`${run}-${purpose}`,password,convite_token:invite.token};
    await session.call('POST','/api/register/start',registration);
    const journey=await session.call('GET','/api/onboarding');
    const newMember=journey.journey?.membro_id;assert(newMember,'Onboarding member');
    fixtures[purpose]={email,member:newMember};
    await session.call('PUT','/api/onboarding/etapas/pronto',{},409);
    await session.call('POST','/api/onboarding/finalizar-aceites',{termos_aceitos:{}},400);
    // Synthetic account and synthetic evidence in an isolated database, not a user's consent.
    await session.call('POST','/api/onboarding/finalizar-aceites',{termos_aceitos:{codigo_etica:true,politicas_participacao_protecao:true},aceite_localizacao:{status:'capturada',latitude:0,longitude:0,accuracy:1,captured_at:new Date().toISOString()}});
    await session.call('PUT','/api/onboarding/etapas/personalizacao',{purposes:[purpose],start_destination:'inicio'});
    for(const bad of ['++351912345678','+351912345678999999','+351 912345678 / +55 31999999999'])await session.call('PUT','/api/onboarding/etapas/perfil',{telefone:bad,professional:{role:'Consultoria'}},400);
    const phone=purpose==='profissional'?'+351 (912) 345-678':purpose==='imoveis'?'+55 (31) 99999-9999':'';
    await session.call('PUT','/api/onboarding/etapas/perfil?draft=1',{telefone:phone,professional:{role:'Consultoria'}});
    await session.call('POST','/api/logout',{});
    await session.call('POST','/api/login',{email,password});
    const resumed=await session.call('GET','/api/onboarding');assert.equal(resumed.journey.responses.perfil.telefone,phone);
    if(purpose==='profissional')for(const valid of ['+351 912 345 678','00351 912 345 678','351912345678','912345678']){
      await session.call('PUT','/api/onboarding/etapas/perfil',{telefone:valid,professional:{role:'Consultoria'}});
      const saved=await session.call('GET','/api/onboarding');assert.equal(saved.journey.responses.perfil.telefone,valid);
    }
    await session.call('PUT','/api/onboarding/etapas/perfil',{telefone:phone,professional:{role:'Consultoria',empresa:run}});
    const segment='Intermediação e consultoria internacional de imóveis, financiamento e investimentos — '.repeat(5);
    await session.call('PUT','/api/onboarding/etapas/configuracao',{visibility:'privado',segmento:segment,idiomas:['Português','Inglês']});
    await session.call('PUT','/api/onboarding/etapas/conexoes',{});
    await session.call('PUT','/api/onboarding/etapas/pronto',{});
    const finished=await session.call('GET','/api/onboarding');assert.equal(finished.journey.status,'concluido');
    const row=(await db.query('SELECT telefone, segmento, cpf FROM built_legacy.cadastro_geral WHERE id=$1',[newMember])).rows[0];
    assert.equal(row.telefone||'',phone.replace(/[^+\d]/g,''));assert.equal(row.segmento,segment.trim());assert(!row.cpf,'CPF must remain optional');
    await session.call('POST','/api/logout',{});await session.call('POST','/api/login',{email,password});
    const logged=await session.call('GET','/api/me');assert.equal(logged.onboarding_required,false);
    const dup=new Session();await dup.call('POST','/api/register/start',registration,403);
  });
  let bia:any;
  await check('BIA: create, edit, reload and MAP draft',async()=>{
    const cpp=await admin.call('POST','/api/tipos-cpp',{nome:run+' MAP'});fixtures.mapCpp=cpp.id;
    bia=await admin.call('POST','/api/bias',{nome_bia:run,valor_origem:1000,moeda:'BRL',aliado_built:member,diretor_alianca:member,
      map_inicial:{valorOrigem:1000,participantes:[{memberId:member,tipo:'guardiao',indiceContribuicao:10,pesoCapital:0,capitalComprometido:1000,naturezaCapital:'caixa',tipoCppCapital:{id:String(cpp.id)},tipoCppContribuicao:{id:String(cpp.id)}}]}});fixtures.bia=bia.id;
    assert(bia.id);assert(bia.codigo_publico);
    await admin.call('PATCH',`/api/bias/${bia.id}`,{nome_bia:run+' edited'});
    const reload=await admin.call('GET',`/api/bias/${bia.id}`);assert.equal(reload.nome_bia,run+' edited');
  });
  await check('Specialties: create and attach to member',async()=>{
    const specialty=await admin.call('POST','/api/especialidades',{nome_especialidade:run,categoria:'QA'});fixtures.specialty=specialty.id;
    const actor=await admin.call('POST','/api/membros',{nome:run,email:`${run}-member@example.invalid`,Especialidades:[{especialidades_id:specialty.id}]});fixtures.member=actor.id;
    const edited=await admin.call('PATCH',`/api/membros/${actor.id}`,{telefone:'+351912345678',segmento:run});assert.equal(edited.telefone,'+351912345678');
    const reload=await admin.call('GET',`/api/membros/${actor.id}`);assert.equal(reload.Especialidades[0].especialidades_id.id,specialty.id);
  });
  await check('External beneficiary and platform user: create, read, duplicate guard',async()=>{
    const beneficiary=await admin.call('POST','/api/membros/criar-favorecido',{nome:run+' external'});assert(beneficiary.id);fixtures.beneficiary=beneficiary.id;
    const data={username:run+'-local',nome:run,email:run+'-local@example.invalid',password,role:'user',membro_directus_id:fixtures.member};
    const user=await admin.call('POST','/api/users',data);assert(user.id);assert(!user.password);fixtures.localUser=user.id;
    await admin.call('POST','/api/users',data,409);
    const login=new Session();await login.call('POST','/api/login',{email:data.email,password});
    const me=await login.call('GET','/api/me');assert.equal(me.membro_directus_id,fixtures.member);
  });
  await check('Land bank: create, edit, native mirror and delete',async()=>{
    const asset=await admin.call('POST','/api/land-bank-assets',{title:run,nome:run,category:'land-bank',origem_tipo:'ativo_proprio',visibilidade:'privada'});fixtures.land=asset.id;
    await admin.call('PATCH',`/api/land-bank-assets/${asset.id}`,{nome:run+' edited'});
    const mirror=await db.query('SELECT id FROM built_legacy.land_bank_assets WHERE local_id=$1',[asset.id]);assert.equal(mirror.rowCount,1);
    await admin.call('DELETE',`/api/land-bank-assets/${asset.id}`);
    assert.equal((await db.query('SELECT id FROM built_legacy.land_bank_assets WHERE local_id=$1',[asset.id])).rowCount,0);
  });
  if(bia?.id)await check('Feasibility study: create, update, reload, delete',async()=>{
    const study=await admin.call('POST','/api/estudos-viabilidade',{bia_id:bia.id,descricao:run});fixtures.study=study.id;
    await admin.call('PATCH',`/api/estudos-viabilidade/${study.id}`,{descricao:run+' edited'});
    const list=await admin.call('GET',`/api/estudos-viabilidade?bia_id=${bia.id}`);assert(list.some((s:any)=>s.id===study.id&&s.descricao===run+' edited'));
    await admin.call('DELETE',`/api/estudos-viabilidade/${study.id}`);
  });
  let fileId='';
  await check('Files: upload, download and byte integrity',async()=>{
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=','base64');
    const form=new FormData();form.append('files',new Blob([bytes],{type:'image/png'}),run+'.png');
    const uploaded=await fetch(origin+'/api/upload',{method:'POST',headers:{cookie:admin.cookie},body:form});assert.equal(uploaded.status,200);
    const body:any=await uploaded.json();fileId=body.fileIds[0];fixtures.file=fileId;
    const downloaded=await fetch(origin+'/api/files/'+fileId,{headers:{cookie:admin.cookie}});assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
  });
  await check('BIA wizard: create draft, resume, edit, conclude, repeat',async()=>{
    const id=randomUUID(),setup=emptyBiaSetup();setup.juridico.modalidade='contratual';setup.juridico.responsavel='QA synthetic legal fixture';setup.juridico.oabResponsavel='QA 0000';
    const data={nome_bia:run+' wizard',moeda:'BRL',destinacao:'Residencial',business_type_code:'FLIPPING',localizacao:'Homologação',observacoes:'Synthetic migration fixture',imagem_directus_id:fileId,estrutura_bia:setup,
      map_inicial:{modeloCalculo:4,valorOrigem:1000,participantes:[{memberId:member,tipo:'guardiao',cargos:['Aliado BUILT','Diretor de Aliança'],contribuicoes:[{cargo:'Aliado BUILT',indice:5,tipoCpp:{id:String(fixtures.mapCpp),nome:run+' MAP'}},{cargo:'Diretor de Aliança',indice:5,tipoCpp:{id:String(fixtures.mapCpp),nome:run+' MAP'}}],indiceContribuicao:0,capitalComprometido:1000,naturezaCapital:'caixa',tipoCppCapital:{id:String(fixtures.mapCpp),nome:run+' MAP'}}]}};
    await admin.call('POST','/api/bias',{...data,_rascunho:true,chaveCriacao:id});fixtures.draftBia=id;
    const draft=await admin.call('GET',`/api/bias/${id}/rascunho`);assert.equal(draft.dados.nome_bia,data.nome_bia);assert(draft.codigo_publico);
    const edited=await admin.call('PUT',`/api/bias/${id}/rascunho`,{...data,observacoes:'Synthetic edited draft',revisaoEsperada:draft.revisao});
    await admin.call('PUT',`/api/bias/${id}/rascunho`,{...data,revisaoEsperada:draft.revisao},409);
    await admin.call('POST',`/api/bias/${id}/concluir-estruturacao`,{revisaoEsperada:edited.revisao});
    await admin.call('POST',`/api/bias/${id}/concluir-estruturacao`,{revisaoEsperada:edited.revisao});
    const saved=await admin.call('GET',`/api/bias/${id}/rascunho`);assert(saved.concluido);
    const official=await admin.call('GET',`/api/bias/${id}`);assert.equal(official.situacao,'em_captacao');
  });
  if(bia?.id){
    await check('BIA structure: asset creation, persistence, stale revision',async()=>{
      const current=await admin.call('GET',`/api/bias/${bia.id}/estrutura`);
      const data={...current.dados,ativosIndefinidos:false,ativos:[{id:randomUUID(),nome:run,situacao:'Adquirido',titular:run,dataVinculo:'2026-10-28',valorReferencia:1000,participacaoBiaPercentual:100,dividaSaldo:0,info:{ativo_qualificacao:'Casa',ativo_pais:'Portugal'},indicadores:{}}]};
      const payload={dados:data,revisaoEsperada:current.revisao,motivo:'Synthetic migration test'};
      await admin.call('PUT',`/api/bias/${bia.id}/estrutura`,payload);
      await admin.call('PUT',`/api/bias/${bia.id}/estrutura`,payload,409);
      const saved=await admin.call('GET',`/api/bias/${bia.id}/estrutura`);assert.equal(saved.dados.ativos[0].valorReferencia,1000);assert.equal(saved.dados.ativos[0].dividaSaldo,0);assert(saved.historico.length);
    });
    await check('BIA lifecycle: premature activation rejected',async()=>{await admin.call('POST',`/api/bias/${bia.id}/ativar`,{},409);});
    // Only this newly created fixture is made active to exercise financial CRUD independently of signatures.
    await db.query("UPDATE built_legacy.bias_projetos SET situacao='ativa' WHERE id=$1 AND nome_bia=$2",[bia.id,run+' edited']);
    await check('Community: BIA relationship and second community',async()=>{
      await admin.call('PATCH',`/api/comunidades/${community.id}`,{bias_ids:[bia.id]});
      const another=await admin.call('POST','/api/comunidades',{nome:run+' second',membros_ids:[member]});fixtures.secondCommunity=another.id;
      const list=await admin.call('GET',`/api/comunidades?membro_id=${member}`);assert(list.some((c:any)=>c.id===community.id));assert(list.some((c:any)=>c.id===another.id));
      const first=await admin.call('GET',`/api/comunidades/${community.id}`);assert.equal(first.bias[0].bias_projetos_id.id,bia.id);
    });
    await check('Initial contributions: schedule, confirm, repeat, settle',async()=>{
      const base=await admin.call('GET',`/api/bias/${bia.id}/aportes-iniciais`);
      const commitments=base.esperados.map((c:any)=>({...c,beneficiario:c.beneficiario||member,series:[{total:c.valor,quantidade:1,primeiroVencimento:'2026-11-28',meses:0}]}));
      const saved=await admin.call('PUT',`/api/bias/${bia.id}/aportes-iniciais`,{revisaoEsperada:base.revisao,revisaoMap:base.revisaoMap,modalidade:'capital_proprio',compromissos:commitments});
      await admin.call('POST',`/api/bias/${bia.id}/aportes-iniciais/confirmar`,{revisaoEsperada:saved.revisao});
      const first=await admin.call('GET',`/api/bias/${bia.id}/aportes-iniciais`);assert.equal(first.estado,'confirmado');assert(first.parcelas.length>=2);
      await admin.call('POST',`/api/bias/${bia.id}/aportes-iniciais/confirmar`,{revisaoEsperada:saved.revisao});
      const repeated=await admin.call('GET',`/api/bias/${bia.id}/aportes-iniciais`);assert.deepEqual(repeated.parcelas.map((p:any)=>p.id),first.parcelas.map((p:any)=>p.id));
      const parcel=first.parcelas.find((p:any)=>p.componente==='capital');
      await admin.call('PATCH',`/api/bias/${bia.id}/aportes-iniciais/parcelas/${parcel.id}`,{revisaoEsperada:saved.revisao,status:'pago',dataPagamento:'2026-10-28',motivo:'Synthetic settlement, no money moved'});
      const final=await admin.call('GET',`/api/bias/${bia.id}/aportes-iniciais`);assert(final.parcelas.find((p:any)=>p.id===parcel.id).liquidado);
    });
    await check('Expense and contributions: paid inheritance, retry, link protection',async()=>{
      const payload={requestId:randomUUID(),bia:bia.id,expense:{valor:10,data:'2026-10-28',descricao:run,membro_responsavel:member,status:'pago',data_vencimento:'2026-11-01',data_pagamento:'2026-10-28',Categoria:[],Favorecido:[member],anexos:[]},mode:'manual',participants:[{memberId:member,value:10}],mirrorExpenses:true,dueDate:'2026-11-01',cppType:null,expected:[{memberId:member,amount:10}]};
      const first=await admin.call('POST','/api/fluxo-caixa/despesa-aportes',payload);assert.equal(first.estado,'concluido');assert.equal(first.movimentos.length,2);assert(first.movimentos.every((m:any)=>m.status==='pago'&&m.data_pagamento==='2026-10-28'));
      const repeated=await admin.call('POST','/api/fluxo-caixa/despesa-aportes',payload);assert.deepEqual(repeated.movimentos.map((m:any)=>m.id),first.movimentos.map((m:any)=>m.id));
      await admin.call('DELETE',`/api/fluxo-caixa/${first.movimentos[0].id}`,{},409);
      const links=await admin.call('GET',`/api/fluxo-caixa/${first.movimentos[1].id}/vinculos`);assert.equal(links.movimentos.length,2);
    });
    await check('BIA authorization: unrelated user cannot read or change private BIA',async()=>{
      const outsider=new Session();await outsider.call('POST','/api/login',{email:fixtures.profissional.email,password});
      await outsider.call('PATCH',`/api/bias/${bia.id}`,{nome_bia:'unauthorized'},403);
      await outsider.call('GET',`/api/fluxo-caixa?bia_id=${bia.id}`,undefined,403);
    });
    await check('Finance: category, CPP, attachment, pending/paid, history, delete',async()=>{
      const category=await admin.call('POST','/api/categorias',{nome:run,tipo:'Entrada',bia_id:bia.id});
      const cpp=await admin.call('POST','/api/tipos-cpp',{nome:run});fixtures.category=category.id;fixtures.cpp=cpp.id;
      const entry=await admin.call('POST','/api/fluxo-caixa',{bia:bia.id,tipo:'entrada',valor:12.34,data:'2026-10-28',descricao:run,membro_responsavel:member,status:'pendente',data_vencimento:'2026-11-28',Categoria:[category.id],tipo_de_cpp:[cpp.id],Favorecido:[member],anexos:fileId?[fileId]:[]});fixtures.entry=entry.id;
      const reminderPath=`/api/bias/${bia.id}/aportes-iniciais/cobrancas/lancamentos/${entry.id}/lembretes`;
      const settings={enabled:true,month:true,week:true,day:true};
      await admin.call('PUT',reminderPath,settings);await admin.call('PUT',reminderPath,settings);
      const reminder=await admin.call('GET',reminderPath);assert.equal(reminder.settings.enabled,true);
      const tasks=await db.query("SELECT id FROM agenda_tarefas WHERE contexto_tipo='aporte_reminder' AND origem_tarefa_id=$1",[entry.id]);assert.equal(tasks.rowCount,1,'One calendar action per contribution');
      await admin.call('PATCH',`/api/fluxo-caixa/${entry.id}`,{descricao:run+' edited',status:'pago',data_pagamento:'2026-10-28'});
      const list=await admin.call('GET',`/api/fluxo-caixa?bia_id=${bia.id}`);const saved=list.find((e:any)=>String(e.id)===String(entry.id));assert(saved,'Saved entry');assert.equal(Number(saved.valor),12.34);assert.equal(saved.status,'pago');
      assert.equal(saved.data_vencimento,'2026-11-28');assert(saved.Categoria.length);assert(saved.tipo_de_cpp.length);
      const history=await admin.call('GET',`/api/fluxo-caixa/${entry.id}/historico`);assert(history.length>=2);
      await admin.call('DELETE',`/api/fluxo-caixa/${entry.id}`,undefined,409);
      await admin.call('DELETE',`/api/fluxo-caixa/${entry.id}`,{confirmar_exclusao_protegida:true});
    });
    await check('Contribution evidence: upload, approve, repeat without duplicate entry',async()=>{
      const form=new FormData();form.append('valor','3.25');form.append('observacao',run);form.append('comprovante',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),run+'.png');
      const response=await fetch(origin+`/api/bias/${bia.id}/aporte-solicitacoes`,{method:'POST',headers:{cookie:admin.cookie},body:form});assert.equal(response.status,201);const request:any=await response.json();
      const approve=await admin.call('PATCH',`/api/bias/${bia.id}/aporte-solicitacoes/${request.id}`,{action:'approve'});assert.equal(approve.status,'approved');assert(approve.fluxo_caixa_id);
      const repeat=await admin.call('PATCH',`/api/bias/${bia.id}/aporte-solicitacoes/${request.id}`,{action:'approve'});assert.equal(repeat.fluxo_caixa_id,approve.fluxo_caixa_id);
    });
    await check('Demand: create private draft and edit BIA relationship',async()=>{
      const demand=await admin.call('POST','/api/demandas',{titulo:run,bia_id:bia.id,contexto:'Synthetic migration QA',modalidade_distribuicao:'pulso',publicar:false},201);fixtures.demand=demand.id;assert(demand.id);
      await admin.call('PATCH',`/api/demandas/${demand.id}`,{titulo:run+' edited'});
      const detail=await admin.call('GET',`/api/demandas/${demand.id}`);assert.equal(detail.titulo,run+' edited');
    });
    await check('OBA: create, media relations, edit, reload, delete',async()=>{
      const opportunity=await admin.call('POST','/api/oportunidades',{nome_oportunidade:run,bia:bia.id,tipo:'Aporte Financeiro',descricao:run,Anexos:fileId?[fileId]:[]});fixtures.opportunity=opportunity.id;
      await admin.call('PATCH',`/api/oportunidades/${opportunity.id}`,{descricao:run+' edited'});
      const list=await admin.call('GET','/api/oportunidades');const saved=list.find((o:any)=>o.id===opportunity.id);assert.equal(saved.descricao,run+' edited');
      await admin.call('DELETE',`/api/oportunidades/${opportunity.id}`);
    });
    for(const endpoint of ['nucleo-tecnico-docs','alianca-docs'])await check(`Documents ${endpoint}: create, edit, reload, delete`,async()=>{
      const doc=await admin.call('POST',`/api/${endpoint}`,{bia_id:bia.id,modulo:endpoint==='alianca-docs'?'capital':undefined,tipo_documento:'QA',descricao:run,arquivo_ids:fileId?[fileId]:[],membro_responsavel:member});assert(!doc.fallback,'Must persist in database');
      await admin.call('PATCH',`/api/${endpoint}/${doc.id}`,{descricao:run+' edited'});
      const list=await admin.call('GET',`/api/${endpoint}?bia_id=${bia.id}${endpoint==='alianca-docs'?'&modulo=capital':''}`);assert(list.some((d:any)=>d.id===doc.id&&d.descricao===run+' edited'));
      await admin.call('DELETE',`/api/${endpoint}/${doc.id}`);
    });
    await check('MAP history: persisted version and PDF download',async()=>{
      const versions=await admin.call('GET',`/api/bias/${bia.id}/map/versoes`);assert(versions.length,'Version captured after financial movements');
      const version=await admin.call('GET',`/api/bias/${bia.id}/map/versoes/${versions[0].id}`);assert(version.hash);assert(version.snapshot.rows.length);
      const response=await fetch(origin+`/api/bias/${bia.id}/map/versoes/${versions[0].id}/pdf`,{headers:{cookie:admin.cookie},signal:AbortSignal.timeout(45000)});
      assert.equal(response.status,200);assert(response.headers.get('content-type')?.includes('pdf'));const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert(bytes.length>1000);
    });
  }
  await check('Property portfolio: create, ownership, edit, reload, delete',async()=>{
    const property=await admin.call('POST','/api/carteira/imoveis',{nome:run,tipo:'casa',valor:1000},201);fixtures.property=property.id;assert(property.is_owner);
    await admin.call('PATCH',`/api/carteira/imoveis/${property.id}`,{nome:run+' edited'});
    const saved=await admin.call('GET',`/api/carteira/imoveis/${property.id}`);assert.equal(saved.nome,run+' edited');
    await admin.call('DELETE',`/api/carteira/imoveis/${property.id}`);
  });
  await check('Unauthenticated writes rejected',async()=>{
    const anonymous=new Session();await anonymous.call('POST','/api/comunidades',{nome:run},401);await anonymous.call('POST','/api/land-bank-assets',{nome:run},401);
  });
}
main().catch(e=>{results.push({name:'prerequisite',ok:false,detail:String(e.message).slice(0,500)});console.error(String(e.message).slice(0,500));}).finally(async()=>{
  await db.end();
  writeFileSync('/tmp/native-platform-journey-results.json',JSON.stringify({run,requests,results,fixtures},null,2),{mode:0o600});
  console.log(JSON.stringify({requests,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length}));
  if(results.some(r=>!r.ok))process.exitCode=1;
});
