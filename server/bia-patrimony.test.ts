import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {loadBiaPatrimony} from "./bia-patrimony";
import {readFileSync} from "node:fs";
import {transformSync} from "esbuild";
import {sql} from "drizzle-orm";

test("leitura SQL usa somente ativos da BIA, sem transferir propriedade por referência ou alterar fontes",async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE bia_estrutura_versoes(bia_id text,revisao int,dados jsonb);
   CREATE TABLE bia_imovel_origens(bia_id text,imovel_id text,status text);
   CREATE TABLE inventario_imoveis(id text,data jsonb);
   INSERT INTO inventario_imoveis VALUES ('one','{"valor_atual":1000,"divida_saldo":200,"private":"SECRET"}'),('other','{"valor_atual":999999}');
   INSERT INTO bia_imovel_origens VALUES ('bia','one','ativa'),('foreign','other','ativa');
   INSERT INTO bia_estrutura_versoes VALUES ('bia',1,'{"ativosIndefinidos":false,"ativos":[{"id":"copy","carteiraImovelId":"one","situacao":"Adquirido","valorReferencia":1000},{"id":"reference","carteiraImovelId":"other","situacao":"Adquirido","valorReferencia":999999}]}');`);
  const result=await loadBiaPatrimony(drizzle(pg),{id:'bia',moeda:'BRL'},[]);
  assert.equal(result.value,800);assert.equal(result.partial,true);assert.deepEqual(result.propertyIds,['one']);assert.doesNotMatch(JSON.stringify(result),/SECRET|999999/);
  assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM bia_estrutura_versoes')).rows[0].n,1);
  await pg.exec('DROP TABLE bia_imovel_origens');await assert.rejects(loadBiaPatrimony(drizzle(pg),{id:'bia'},[]));
 }finally{await pg.close();}
});

test("Carteira exige vínculo e leitura financeira antes das fontes, sem substituir falha por zero",async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function carteiraAlliancesForMember('),source.indexOf('  const MARKET_ESTIMATE_MAX_AGE_MS'));
 let allowed=false,reads=0,fail=false;
 const entries=[{tipo:'entrada',valor:100,status:'pago'},{tipo:'entrada',valor:1000,status:'pendente'},{tipo:'entrada',valor:100,status:'pago',finalidade:'integralizacao_inicial'},{tipo:'saida',valor:40,status:'pago'},{tipo:'saida',valor:60,status:'pendente'},{tipo:'saida',valor:1000,status:'cancelado'}];
 const scope={directusFetchScoped:async(collection:string)=>{if(collection==='bias_projetos')return [{id:'bia',moeda:'BRL'}];reads++;if(fail)throw new Error('indisponível');return entries;},isUserLinkedToBia:(_bia:any,id:string)=>id==='member',resolveBiaAccessForRequest:async()=>({permissions:{}}),hasBiaAccess:()=>allowed,getBiaAllocationMap:async()=>{reads++;return [{memberId:'member',percent:25,value:100}];},loadBiaPatrimony:async()=>{reads++;return {value:200,partial:true,calculatedAt:'2026-10-22T00:00:00Z',propertyIds:[]};},db:{},canDeleteBia:async()=>false,isCashEntry:()=>true,parseMarketValueServer:Number};
 const fn=new Function(...Object.keys(scope),transformSync(code,{loader:'ts'}).code+';return carteiraAlliancesForMember;')(...Object.values(scope));
 assert.deepEqual(await fn('member',{}),[]);assert.equal(reads,0);allowed=true;
 assert.deepEqual(await fn('other',{}),[]);assert.equal(reads,0);
 const result=await fn('member',{});assert.equal(result[0].valor_participacao,50);assert.equal(result[0].patrimonio_liquido_oficial,null);assert.equal(result[0].confirmado,false);
 assert.equal(result[0].receitas_participacao,25);assert.equal(result[0].despesas_participacao,10);assert.equal(result[0].contas_a_pagar_participacao,15);
 fail=true;await assert.rejects(fn('member',{}));
});

test("registro manual fica aposentado após autorização, histórico preservado por ID canônico",async()=>{
 const source=readFileSync(new URL('./routes.ts',import.meta.url),'utf8');
 const begin=source.indexOf('  app.get("/api/bias/:id/patrimonio"');
 const code=source.slice(begin,source.indexOf('  app.get("/api/bias/:id/aporte-solicitacoes"',begin));
 const handlers=new Map<string,any>();let allowed=false,reads=0,status=200;
 const scope={app:{get:(path:string,fn:any)=>handlers.set('GET',fn),post:(path:string,fn:any)=>handlers.set('POST',fn)},requireBiaModuleAccess:async()=>allowed?{bia:{id:'canonical'}}:null,db:{execute:async()=>{reads++;return {rows:[]};}},sql};
 new Function(...Object.keys(scope),transformSync(code,{loader:'ts'}).code)(...Object.values(scope));
 const res:any={json:()=>{},status:(value:number)=>{status=value;return res;}};
 await handlers.get('POST')({params:{id:'PUBLIC'}},res);assert.equal(reads,0);allowed=true;
 await handlers.get('POST')({params:{id:'PUBLIC'}},res);assert.equal(status,410);assert.equal(reads,0);
 await handlers.get('GET')({params:{id:'PUBLIC'}},res);assert.equal(reads,1);
 assert.match(code,/String\(auth.bia.id\)/);assert.doesNotMatch(code,/INSERT|UPDATE|DELETE/);
});
