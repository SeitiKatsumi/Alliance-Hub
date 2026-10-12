import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
import {biaTeamFromMapParticipants} from "../shared/bia-access";
import {sql} from "drizzle-orm";

const source=readFileSync(new URL("./routes.ts",import.meta.url),"utf8");
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
