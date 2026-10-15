import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
import {biaTeamFromMapParticipants} from "../shared/bia-access";
import {sql} from "drizzle-orm";

const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
const directusRelationId=(value:any)=>value && typeof value==="object" ? String(value.id) : value ? String(value) : null;
const parseCode=source.slice(source.indexOf("  function parseBiaMemberList("),source.indexOf("  function resolveAnexosBia("));
const parseBiaMemberList=new Function("directusRelationId",transformSync(parseCode,{loader:"ts"}).code+";return parseBiaMemberList;")(directusRelationId);
function extract(name:string,next:string,scope:Record<string,any>){
  const code=source.slice(source.indexOf(`  async function ${name}(`),source.indexOf(`  ${next}`));
  return new Function(...Object.keys(scope),transformSync(code,{loader:"ts"}).code+`;return ${name};`)(...Object.values(scope));
}

test("seleção salva cancela convite de pessoa nunca efetivada e cria apenas selecionados sem duplicar",async()=>{
  const invitations:any[]=[{id:"old",bia_id:"bia",campo_socios:"socios_guardioes",socio_membro_id:"vinicius",status:"pendente"},
    {id:"keep",bia_id:"bia",campo_socios:"socios_guardioes",socio_membro_id:"eugenio",status:"pendente"},
    {id:"other",bia_id:"other",campo_socios:"socios_guardioes",socio_membro_id:"vinicius",status:"pendente"}];
  let created=0;
  const process=extract("processSocioSolicitacoes","async function syncFormationMapInvites",{
    SOCIO_SOLICITACAO_CONFIG:[{campoSocios:"socios_guardioes",papel:"Guardião"},{campoSocios:"socios_multiplicadores",papel:"Multiplicador"}],
    parseBiaMemberList:(value:any)=>value || [],hasBiaMouAceito:async(_bia:string,id:string)=>id==="accepted",
    storage:{getBiaSocioSolicitacoesPendentesByBia:async(id:string)=>invitations.filter(i=>i.bia_id===id&&i.status==="pendente"),
      updateBiaSocioSolicitacao:async(id:string,data:any)=>Object.assign(invitations.find(i=>i.id===id),data)},
    createSocioSolicitacao:async(p:any)=>{const i={id:`new${++created}`,bia_id:p.biaId,socio_membro_id:p.socioId,campo_socios:p.campoSocios,status:"pendente"};invitations.push(i);return i;},
  });
  const opts={biaId:"bia",biaNome:"Teste",currentBia:{socios_guardioes:["accepted"]},req:{},body:{socios_guardioes:["accepted","eugenio","new"],socios_multiplicadores:[]}};
  await process(opts);await process(opts);
  assert.equal(invitations[0].status,"cancelado");assert.ok(invitations[0].respondido_em);
  assert.equal(invitations[1].status,"pendente");assert.equal(invitations[2].status,"pendente");assert.equal(created,1);
  await process({...opts,body:{}});assert.equal(invitations[1].status,"pendente");
  await process({...opts,body:{socios_guardioes:[],socios_multiplicadores:["eugenio"]}});
  assert.equal(invitations[1].status,"cancelado");assert.equal(created,2);
  assert.equal(invitations.at(-1).campo_socios,"socios_multiplicadores");
});

test("sincronização usa composição persistida mais recente, recupera legado e preserva BIA ativa",async()=>{
  const participants=[{memberId:"selected",tipo:"guardiao",cargos:[]}];
  let latest:any={participantes:participants},active=false,fail=false;
  const seen:any[]=[];
  const sync=extract("syncFormationMapInvites","function normalizeText",{
    withMapLock:async(id:string,fn:any)=>{assert.equal(id,"bia");return fn({execute:async()=>({rows:[{snapshot:{base:{participantes:participants}}}]})},latest);},
    directusFetchOne:async()=>({id:"bia",nome_bia:"BIA",situacao:active?"ativa":"em_formacao"}),
    mapIsActive:(bia:any)=>bia.situacao==="ativa",biaTeamFromMapParticipants,sql,
    processSocioSolicitacoes:async(o:any)=>{if(fail)throw Error("offline");seen.push(o.body);},
    processDiretorSolicitacoes:async(o:any)=>{assert.deepEqual(o.payload,{});},DIRETOR_SOLICITACAO_CONFIG:[],
  });
  assert.equal(await sync("bia",{}),"ok");assert.deepEqual(seen[0].socios_guardioes,["selected"]);
  latest=null;assert.equal(await sync("bia",{}),"ok");assert.equal(seen.length,2);
  active=true;await sync("bia",{});assert.equal(seen.length,2);
  active=false;fail=true;assert.equal(await sync("bia",{}),"pending");
  for(const route of ["map-zero-legado","map-inicial"]){
    const block=source.slice(source.indexOf(`  app.put("/api/bias/:id/${route}"`));
    assert.ok(block.indexOf("syncFormationMapInvites(String(bia.id), req)")>block.indexOf("withMapLock"));
  }
});

test("sócio vinculado não recebe novo convite quando MOU da revisão está pendente; papel novo continua convidado",async()=>{
  const invitations:any[]=[
    {id:"duplicate",bia_id:"bia",campo_socios:"socios_multiplicadores",socio_membro_id:"bernal",status:"pendente"},
    {id:"other",bia_id:"other",campo_socios:"socios_multiplicadores",socio_membro_id:"bernal",status:"pendente"},
  ];
  let created=0,mouChecks=0;
  const process=extract("processSocioSolicitacoes","async function syncFormationMapInvites",{
    SOCIO_SOLICITACAO_CONFIG:[{campoSocios:"socios_multiplicadores",papel:"Multiplicador"},{campoSocios:"socios_guardioes",papel:"Guardião"}],
    parseBiaMemberList,hasBiaMouAceito:async()=>{mouChecks++;return false;},
    storage:{getBiaSocioSolicitacoesPendentesByBia:async(id:string)=>invitations.filter(i=>i.bia_id===id&&i.status==="pendente"),
      updateBiaSocioSolicitacao:async(id:string,data:any)=>Object.assign(invitations.find(i=>i.id===id),data)},
    createSocioSolicitacao:async(p:any)=>{const i={id:`new${++created}`,bia_id:p.biaId,socio_membro_id:p.socioId,campo_socios:p.campoSocios,status:"pendente"};invitations.push(i);return i;},
  });
  const opts={biaId:"bia",biaNome:"Teste",req:{},payload:{} as any,
    currentBia:{socios_multiplicadores:[{cadastro_geral_id:{id:"bernal"}}]},body:{socios_multiplicadores:JSON.stringify(["bernal"])}};
  await process(opts);await process(opts);
  assert.equal(created,0);assert.equal(mouChecks,0);
  assert.equal(invitations[0].status,"cancelado");assert.equal(invitations[1].status,"pendente");
  assert.deepEqual(JSON.parse(opts.payload.socios_multiplicadores),["bernal"]);
  await process({...opts,body:{socios_guardioes:["bernal"]}});
  assert.equal(created,1);assert.equal(invitations.at(-1).campo_socios,"socios_guardioes");
  await process({...opts,body:{socios_multiplicadores:[]}});
  assert.deepEqual(JSON.parse(opts.payload.socios_multiplicadores),[]);
});

test("diretor vinculado é preservado sem novo convite e duplicata pendente é cancelada somente na mesma função/BIA",async()=>{
  const invitations:any[]=[
    {id:"duplicate",bia_id:"bia",campo_diretor:"diretor_tecnico",diretor_membro_id:"bernal",status:"pendente"},
    {id:"other",bia_id:"other",campo_diretor:"diretor_tecnico",diretor_membro_id:"bernal",status:"pendente"},
    {id:"other-role",bia_id:"bia",campo_diretor:"diretor_comercial",diretor_membro_id:"bernal",status:"pendente"},
  ];
  let created=0,mouChecks=0;
  const process=extract("processDiretorSolicitacoes","async function createSocioSolicitacao",{
    DIRETOR_SOLICITACAO_CONFIG:[{campoDiretor:"diretor_tecnico",campoPercentual:"pct_tecnico",papel:"Técnico"}],
    directusRelationId,normalizePercent:(v:any)=>v==null?null:String(v),hasBiaMouAceito:async()=>{mouChecks++;return false;},
    storage:{getBiaDiretorSolicitacoesPendentesByBia:async(id:string)=>invitations.filter(i=>i.bia_id===id&&i.status==="pendente"),
      cancelBiaDiretorSolicitacoes:async(bia:string,campo:string,except?:string)=>{for(const i of invitations){if(i.bia_id===bia&&i.campo_diretor===campo&&i.status==="pendente"&&i.diretor_membro_id!==except)i.status="cancelado";}}},
    createDiretorSolicitacao:async(p:any)=>{created++;return p;},
  });
  const opts={biaId:"bia",biaNome:"Teste",req:{},payload:{} as any,
    currentBia:{diretor_tecnico:{id:"bernal"}},body:{diretor_tecnico:"bernal",pct_tecnico:"2"}};
  await process(opts);await process(opts);
  assert.equal(created,0);assert.equal(mouChecks,0);
  assert.equal(opts.payload.diretor_tecnico,"bernal");assert.equal(opts.payload.pct_tecnico,"2");
  assert.equal(invitations[0].status,"cancelado");assert.equal(invitations[1].status,"pendente");assert.equal(invitations[2].status,"pendente");
  await process({...opts,body:{diretor_tecnico:"new",pct_tecnico:"1"}});
  assert.equal(created,1);
});
