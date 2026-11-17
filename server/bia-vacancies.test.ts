import assert from "node:assert/strict";
import test from "node:test";
import { calculateInitialMap, type InitialMapParticipantInput } from "../shared/member-portfolio";
import { biaAllowsFinance } from "../shared/bia-phase";
import { BIA_PARTICIPANT_ROLE_FIELDS, BIA_PARTICIPANT_ROLE_LABELS } from "../shared/bia-access";
import { validateInitialClassifications } from "../shared/initial-contributions";
import { assignMapVacancy, openMapVacancies } from "./bia-vacancies";

test("A aprovação ocupa a cota exata e preserva seus valores, com uma decisão por vaga",()=>{
  const first:InitialMapParticipantInput={participantId:"member:lead",memberId:"lead",nome:"Diretor",tipo:"guardiao",pesoCapital:50,indiceContribuicao:0};
  const vacancy:InitialMapParticipantInput={...first,participantId:"draft:vacancy",memberId:null,titular:"vaga",nome:"Cota disponível"};
  const external:InitialMapParticipantInput={...vacancy,participantId:"draft:external",titular:"externo",nome:"Pessoa externa"};
  assert.equal(openMapVacancies([first,vacancy,external]).length,1);
  assert.throws(()=>assignMapVacancy([first,vacancy],"draft:vacancy",{id:"lead",nome:"Diretor"}),/já consta/);
  const result=assignMapVacancy([first,vacancy],"draft:vacancy",{id:"winner",nome:"Sócia aprovada"});
  const before=calculateInitialMap(1000,[first,vacancy]);
  const after=calculateInitialMap(1000,result);
  assert.equal(after.participantes[1].memberId,"winner");
  assert.equal(after.participantes[1].participantId,vacancy.participantId);
  assert.equal(after.participantes[1].mapPercentual,before.participantes[1].mapPercentual);
  assert.equal(after.participantes[1].cppTotal,before.participantes[1].cppTotal);
  assert.throws(()=>assignMapVacancy(result,"draft:vacancy",{id:"other",nome:"Outro"}),/não está aberta/);
});


test("Decisão real da rota protege a diretoria e permite um vencedor por vaga",async()=>{
  const [{PGlite},{drizzle},{and,eq,sql},{default:express},{readFileSync},{transformSync},{opaInteresses},{randomUUID}] = await Promise.all([
    import("@electric-sql/pglite"),import("drizzle-orm/pglite"),import("drizzle-orm"),import("express"),import("node:fs"),import("esbuild"),import("../shared/schema"),import("node:crypto"),
  ]);
  const pg=new PGlite();
  await pg.exec("CREATE TABLE opa_interesses (id text primary key, opa_id text, user_id text, membro_id text, membro_nome text, mensagem text, multiplicador text, status_crm text default 'interesse_recebido', observacao_crm text, criado_em timestamp default now(), atualizado_em timestamp default now()); CREATE TABLE bia_map_inicial_snapshots (id text primary key, bia_id text default 'bia', participantes jsonb, snapshot_hash text, atualizado_em timestamp, ativado_em timestamp); CREATE TABLE bia_estruturacao_rascunhos (bia_id text primary key, dados jsonb, concluido boolean default false, conclusao_iniciada boolean default false, revisao integer default 1, atualizado_em timestamp)");
  await pg.exec(readFileSync(new URL("../migrations/20261116_oba_vacancies.sql",import.meta.url),"utf8"));
  const db=drizzle(pg);
  const slot:InitialMapParticipantInput={participantId:"draft:slot",memberId:null,titular:"vaga",nome:"Cota disponível",tipo:"guardiao",pesoCapital:100,indiceContribuicao:0};
  await pg.query("INSERT INTO bia_map_inicial_snapshots (id, participantes) VALUES ($1,$2)",["map",JSON.stringify([slot])]);
  await db.insert(opaInteresses).values(["a","b"].map(id=>({id,opa_id:"oba",user_id:id,membro_id:id,vaga_id:slot.participantId!,vaga_bia_id:"bia",vaga_status:"pendente"})));
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={directusUserId:"actor",membroId:String(req.headers["x-member"] || "director")};next();});
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const start=source.indexOf('  app.patch("/api/bias/:id/vagas-interesses/:interestId"');
  assert.ok(start>=0);
  const alertStart=source.indexOf("  async function vacancyAgendaAlerts(");
  assert.ok(alertStart>=0);
  const alert=source.slice(alertStart,source.indexOf('  app.get("/api/bias/:id/vagas-interesses"',alertStart));
  const route=source.slice(start,source.indexOf('  app.get("/api/oportunidades/:id/interesse"',start));
  const archived:unknown[]=[];
  let phase="em_captacao";
  const permissions=source.slice(source.indexOf("  function quotaApplicationsOpen("),source.indexOf("  async function opportunityVacancyContext("));
  const structure={modalidade:"recursos_proprios",totalCotas:1,instrumentos:[],integralizacao:{forma:"a_vista"}};
  const scope={app,db,sql,and,eq,opaInteresses,agendaAlertDate:(date:unknown)=>date,randomUUID,openMapVacancies,assignMapVacancy,calculateInitialMap,
    resolveBiaByIdOrPublicCode:async()=>({id:"bia",situacao:phase,diretor_alianca:"director",aliado_built:"ally",autor_bia:"author"}),
    biaAllowsFinance,BIA_PARTICIPANT_ROLE_FIELDS,BIA_PARTICIPANT_ROLE_LABELS,validateInitialClassifications,
    isBiaPlatformAdminRole:()=>false,directusRelationId:(id:string)=>id,
    withMapLock:(_id:string,work:any)=>db.transaction(async tx=>{
      const snap=(await tx.execute(sql.raw("SELECT * FROM bia_map_inicial_snapshots WHERE id='map' FOR UPDATE"))).rows[0];
      return work(tx,snap ? {...snap,modelo_calculo:1,valor_origem:1000,moeda:"BRL"} : null);
    }),
    directusFetchOne:async(_col:string,id:string)=>({id,nome:"Candidato "+id}),
    initialMapHash:()=>"new-hash",
    archiveMapBase:async(_tx:unknown,_bia:unknown,base:unknown)=>archived.push(base),
    notifyMapRevision:async()=>{},syncFormationMapInvites:async()=>"ok",syncActiveQuotaInvite:async()=>"ok",
    reconcilePendingMapEvents:async()=>{},assertInitialCommitmentsCompatible:async()=>{},directusFetchScoped:async()=>[],
    getBiaAllocationMap:async()=>[],captureCurrentMap:async()=>{},
  };
  const getAlerts=new Function(...Object.keys(scope),transformSync(permissions+alert+route,{loader:"ts"}).code+";return vacancyAgendaAlerts;")(...Object.values(scope));
  const server=app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const call=(id:string,actor="director",decisao="aprovar")=>fetch("http://127.0.0.1:"+(server.address() as any).port+"/api/bias/bia/vagas-interesses/"+id,{
    method:"PATCH",headers:{"content-type":"application/json","x-member":actor},body:JSON.stringify({decisao}),
  });
  try {
    assert.equal((await call("a","other")).status,403);
    assert.deepEqual(await getAlerts({session:{directusUserId:"actor",membroId:"other"}}),[]);
    const [alertItem]=await getAlerts({session:{directusUserId:"actor",membroId:"director"}});
    assert.equal(alertItem.title,"2 manifestações pendentes");
    assert.match(alertItem.href,/section=equipe&vaga=draft%3Aslot/);
    const statuses=(await Promise.all([call("a"),call("b")])).map(item=>item.status).sort();
    assert.deepEqual(statuses,[200,409]);
    const candidates=await db.select().from(opaInteresses);
    const [winner]=candidates.filter(item=>item.vaga_status==="aprovada");
    assert.equal(candidates.filter(item=>item.vaga_status==="vaga_preenchida").length,1);
    assert.equal((await call(winner.id)).status,200);
    assert.equal(archived.length,1);
    assert.deepEqual(await getAlerts({session:{membroId:"director"}}),[]);
    const actual=(await pg.query<{participantes:InitialMapParticipantInput[]}>("SELECT participantes FROM bia_map_inicial_snapshots")).rows[0].participantes[0];
    assert.equal(actual.memberId,winner.membro_id);
    assert.equal(actual.participantId,slot.participantId);
    phase="em_estruturacao";
    const draftSlot:InitialMapParticipantInput={...slot,modeloCalculo:5,cotasInvestimento:1,naturezaCapital:"caixa",tipoCppCapital:{id:"capital",nome:"Capital"},contribuicoes:[{cargo:"Contribuição individual",indice:0}]};
    await pg.exec("DELETE FROM bia_map_inicial_snapshots; DELETE FROM opa_interesses;");
    await pg.query("INSERT INTO bia_estruturacao_rascunhos (bia_id,dados) VALUES ($1,$2)",["bia",{moeda:"BRL",map_inicial:{modeloCalculo:5,valorOrigem:1000,estrutura:structure,participantes:[draftSlot]}}]);
    await db.insert(opaInteresses).values({id:"c",opa_id:"oba",user_id:"guest:c",membro_id:"c",vaga_id:slot.participantId!,vaga_bia_id:"bia",vaga_status:"pendente"});
    for(const role of ["director","author","ally"])assert.equal((await getAlerts({session:{directusUserId:"actor",membroId:role}})).length,1);
    assert.equal((await call("c","other")).status,403);
    await db.insert(opaInteresses).values({id:"rejected",opa_id:"oba",user_id:"other-buyer",membro_id:"other-buyer",vaga_id:slot.participantId!,vaga_bia_id:"bia",vaga_status:"pendente"});
    assert.equal((await call("rejected","ally","recusar")).status,200);
    assert.equal((await db.select().from(opaInteresses).where(eq(opaInteresses.id,"rejected")))[0].vaga_status,"recusada");
    const approved=await call("c","author");
    assert.equal(approved.status,200,await approved.clone().text());
    const draft=(await pg.query<{dados:any;revisao:number}>("SELECT dados,revisao FROM bia_estruturacao_rascunhos")).rows[0];
    assert.equal(draft.revisao,2);
    assert.equal(draft.dados.map_inicial.participantes[0].memberId,"c");
    assert.deepEqual(await getAlerts({session:{directusUserId:"actor",membroId:"ally"}}),[]);
    phase="em_execucao";
    await pg.query("INSERT INTO bia_map_inicial_snapshots (id,participantes,ativado_em) VALUES ($1,$2,now())",["map",JSON.stringify([slot])]);
    await db.insert(opaInteresses).values({id:"d",opa_id:"oba",user_id:"d",membro_id:"d",vaga_id:slot.participantId!,vaga_bia_id:"bia",vaga_status:"pendente"});
    assert.equal((await getAlerts({session:{directusUserId:"actor",membroId:"author"}})).length,1);
    assert.equal((await call("d","ally")).status,200);
    assert.deepEqual(await getAlerts({session:{directusUserId:"actor",membroId:"author"}}),[]);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await pg.close();
  }
});


test("A gestão pode criar OBA durante a estruturação e a captação",async()=>{
  const [{readFileSync},{transformSync},{biaAllowsFinance},{canCreateObaForBia}] = await Promise.all([
    import("node:fs"),import("esbuild"),import("../shared/bia-phase"),import("./bia-lifecycle"),
  ]);
  const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
  const start=source.indexOf("  async function ensureCanLinkOpaToBia(");
  assert.ok(start>=0);
  let phase="em_captacao", hasVacancy=true;
  const scope={openMapVacancies,biaAllowsFinance,canCreateObaForBia,directusRelationId:(id:unknown)=>id,
    canDecideVacancy:(req:any)=>req.session.membroId==="director",
    directusFetchOne:async(collection:string)=>collection==="bias_projetos"
      ? {id:"bia",situacao:phase,diretor_alianca:"director"} : {bia:"bia"},
    loadInitialMapSnapshot:async()=>({participantes:hasVacancy?[{participantId:"draft:slot",titular:"vaga"}]:[]}),
  };
  const route=source.slice(start,source.indexOf('  app.post("/api/oportunidades"',start));
  const canLink=new Function(...Object.keys(scope),transformSync(route,{loader:"ts"}).code+";return ensureCanLinkOpaToBia;")(...Object.values(scope));
  const director={session:{membroId:"director"}};
  await canLink(director,{bia:"bia"});
  await assert.rejects(()=>canLink({session:{membroId:"other"}},{bia:"bia"}),/estruturação, captação/);
  phase="em_estruturacao";
  await canLink(director,{bia:"bia"});
  await assert.rejects(()=>canLink({session:{membroId:"other"}},{bia:"bia"}),/estruturação, captação/);
  hasVacancy=false;
  await canLink(director,{bia:"bia"});
  phase="ativa";
  await canLink(director,{bia:"bia"});
});


test("aprovar outra cota compatível aumenta as CIs na mesma ficha",()=>{
  const person={participantId:"member:m",memberId:"m",nome:"Membro",tipo:"guardiao",cotasInvestimento:1,indiceContribuicao:0,pesoCapital:0} as const;
  const vacancy={...person,participantId:"draft:extra",memberId:null,titular:"vaga" as const,cotasInvestimento:2};
  assert.throws(()=>assignMapVacancy([person,vacancy],vacancy.participantId,{id:"m",nome:"Membro"}),/já consta/);
  assert.deepEqual(assignMapVacancy([person,vacancy],vacancy.participantId,{id:"m",nome:"Membro"},true),[{...person,cotasInvestimento:3}]);
  assert.throws(()=>assignMapVacancy([person,{...vacancy,tipo:"multiplicador"}],vacancy.participantId,{id:"m",nome:"Membro"},true),/condições diferentes/);
});
